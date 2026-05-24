from __future__ import annotations

import torch
import torch.nn.functional as F
from torch import nn


# File này là bản runtime tối thiểu của kiến trúc MiniFASNet trong repo
# Silent-Face-Anti-Spoofing. Tên module/layer được giữ gần upstream để khớp
# key trong file weights .pth đã tải về.


class Flatten(nn.Module):
    # Đổi feature map 4D [B, C, H, W] thành vector 2D [B, C*H*W].
    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return inputs.view(inputs.size(0), -1)


class ConvBlock(nn.Module):
    # Conv + BatchNorm + PReLU: block có activation, dùng ở các tầng feature.
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel: tuple[int, int] = (1, 1),
        stride: tuple[int, int] = (1, 1),
        padding: tuple[int, int] = (0, 0),
        groups: int = 1,
    ) -> None:
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=kernel,
            groups=groups,
            stride=stride,
            padding=padding,
            bias=False,
        )
        self.bn = nn.BatchNorm2d(out_channels)
        self.prelu = nn.PReLU(out_channels)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.prelu(self.bn(self.conv(inputs)))


class LinearBlock(nn.Module):
    # Conv + BatchNorm không activation. Dùng ở projection layer để đổi channel
    # mà không thêm phi tuyến, đúng kiểu mobile/face architecture.
    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel: tuple[int, int] = (1, 1),
        stride: tuple[int, int] = (1, 1),
        padding: tuple[int, int] = (0, 0),
        groups: int = 1,
    ) -> None:
        super().__init__()
        self.conv = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=kernel,
            groups=groups,
            stride=stride,
            padding=padding,
            bias=False,
        )
        self.bn = nn.BatchNorm2d(out_channels)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.bn(self.conv(inputs))


class DepthWise(nn.Module):
    # Bottleneck depthwise block:
    # 1x1 conv mở/rút channel -> depthwise conv theo không gian -> 1x1 project.
    # residual=True nghĩa là cộng skip connection nếu input/output cùng shape.
    def __init__(
        self,
        c1: tuple[int, int],
        c2: tuple[int, int],
        c3: tuple[int, int],
        residual: bool = False,
        kernel: tuple[int, int] = (3, 3),
        stride: tuple[int, int] = (2, 2),
        padding: tuple[int, int] = (1, 1),
        groups: int = 1,
    ) -> None:
        super().__init__()
        self.conv = ConvBlock(c1[0], c1[1], kernel=(1, 1))
        self.conv_dw = ConvBlock(
            c2[0],
            c2[1],
            groups=c2[0],
            kernel=kernel,
            padding=padding,
            stride=stride,
        )
        self.project = LinearBlock(c3[0], c3[1], kernel=(1, 1))
        self.residual = residual

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        outputs = self.project(self.conv_dw(self.conv(inputs)))
        if self.residual:
            return inputs + outputs
        return outputs


class Residual(nn.Module):
    # Gom nhiều DepthWise residual block liên tiếp thành một stage.
    def __init__(
        self,
        c1: list[tuple[int, int]],
        c2: list[tuple[int, int]],
        c3: list[tuple[int, int]],
        num_block: int,
        groups: int,
        kernel: tuple[int, int] = (3, 3),
        stride: tuple[int, int] = (1, 1),
        padding: tuple[int, int] = (1, 1),
    ) -> None:
        super().__init__()
        self.model = nn.Sequential(
            *[
                DepthWise(
                    c1[index],
                    c2[index],
                    c3[index],
                    residual=True,
                    kernel=kernel,
                    padding=padding,
                    stride=stride,
                    groups=groups,
                )
                for index in range(num_block)
            ]
        )

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.model(inputs)


class SEModule(nn.Module):
    # Squeeze-and-Excitation: học trọng số theo channel để nhấn mạnh feature tốt.
    # Chỉ dùng trong biến thể MiniFASNetV1SE.
    def __init__(self, channels: int, reduction: int) -> None:
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.fc1 = nn.Conv2d(channels, channels // reduction, kernel_size=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels // reduction)
        self.relu = nn.ReLU(inplace=True)
        self.fc2 = nn.Conv2d(channels // reduction, channels, kernel_size=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
        self.sigmoid = nn.Sigmoid()

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        weights = self.avg_pool(inputs)
        weights = self.relu(self.bn1(self.fc1(weights)))
        weights = self.sigmoid(self.bn2(self.fc2(weights)))
        return inputs * weights


class DepthWiseSE(DepthWise):
    # DepthWise có thêm SE ở nhánh residual. Giữ tên se_module để khớp weight key.
    def __init__(
        self,
        c1: tuple[int, int],
        c2: tuple[int, int],
        c3: tuple[int, int],
        residual: bool = False,
        kernel: tuple[int, int] = (3, 3),
        stride: tuple[int, int] = (2, 2),
        padding: tuple[int, int] = (1, 1),
        groups: int = 1,
        se_reduct: int = 8,
    ) -> None:
        super().__init__(c1, c2, c3, residual, kernel, stride, padding, groups)
        self.se_module = SEModule(c3[1], se_reduct)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        outputs = self.project(self.conv_dw(self.conv(inputs)))
        if self.residual:
            return inputs + self.se_module(outputs)
        return outputs


class ResidualSE(nn.Module):
    # Stage residual có SE ở block cuối, theo kiến trúc upstream V1SE.
    def __init__(
        self,
        c1: list[tuple[int, int]],
        c2: list[tuple[int, int]],
        c3: list[tuple[int, int]],
        num_block: int,
        groups: int,
        kernel: tuple[int, int] = (3, 3),
        stride: tuple[int, int] = (1, 1),
        padding: tuple[int, int] = (1, 1),
        se_reduct: int = 4,
    ) -> None:
        super().__init__()
        modules: list[nn.Module] = []
        for index in range(num_block):
            if index == num_block - 1:
                modules.append(
                    DepthWiseSE(
                        c1[index],
                        c2[index],
                        c3[index],
                        residual=True,
                        kernel=kernel,
                        padding=padding,
                        stride=stride,
                        groups=groups,
                        se_reduct=se_reduct,
                    )
                )
            else:
                modules.append(
                    DepthWise(
                        c1[index],
                        c2[index],
                        c3[index],
                        residual=True,
                        kernel=kernel,
                        padding=padding,
                        stride=stride,
                        groups=groups,
                    )
                )
        self.model = nn.Sequential(*modules)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        return self.model(inputs)


# KEEP_DICT là cấu hình số channel đã prune cho từng biến thể model upstream.
# Các con số này quyết định shape layer; chỉ cần lệch một giá trị là load_state_dict
# sẽ fail vì không khớp weights .pth.
KEEP_DICT = {
    "1.8M": [
        32,
        32,
        103,
        103,
        64,
        13,
        13,
        64,
        26,
        26,
        64,
        13,
        13,
        64,
        52,
        52,
        64,
        231,
        231,
        128,
        154,
        154,
        128,
        52,
        52,
        128,
        26,
        26,
        128,
        52,
        52,
        128,
        26,
        26,
        128,
        26,
        26,
        128,
        308,
        308,
        128,
        26,
        26,
        128,
        26,
        26,
        128,
        512,
        512,
    ],
    "1.8M_": [
        32,
        32,
        103,
        103,
        64,
        13,
        13,
        64,
        13,
        13,
        64,
        13,
        13,
        64,
        13,
        13,
        64,
        231,
        231,
        128,
        231,
        231,
        128,
        52,
        52,
        128,
        26,
        26,
        128,
        77,
        77,
        128,
        26,
        26,
        128,
        26,
        26,
        128,
        308,
        308,
        128,
        26,
        26,
        128,
        26,
        26,
        128,
        512,
        512,
    ],
}


class MiniFASNet(nn.Module):
    # Kiến trúc chính cho MiniFASNetV2. Output cuối là logits 3 class:
    # upstream dùng class 1 là real/live face.
    def __init__(
        self,
        keep: list[int],
        embedding_size: int = 128,
        conv6_kernel: tuple[int, int] = (7, 7),
        drop_p: float = 0.0,
        num_classes: int = 3,
        img_channel: int = 3,
    ) -> None:
        super().__init__()
        self.embedding_size = embedding_size
        self.conv1 = ConvBlock(img_channel, keep[0], kernel=(3, 3), stride=(2, 2), padding=(1, 1))
        self.conv2_dw = ConvBlock(keep[0], keep[1], kernel=(3, 3), padding=(1, 1), groups=keep[1])
        self.conv_23 = DepthWise((keep[1], keep[2]), (keep[2], keep[3]), (keep[3], keep[4]), groups=keep[3])
        self.conv_3 = Residual(
            [(keep[4], keep[5]), (keep[7], keep[8]), (keep[10], keep[11]), (keep[13], keep[14])],
            [(keep[5], keep[6]), (keep[8], keep[9]), (keep[11], keep[12]), (keep[14], keep[15])],
            [(keep[6], keep[7]), (keep[9], keep[10]), (keep[12], keep[13]), (keep[15], keep[16])],
            num_block=4,
            groups=keep[4],
        )
        self.conv_34 = DepthWise((keep[16], keep[17]), (keep[17], keep[18]), (keep[18], keep[19]), groups=keep[19])
        self.conv_4 = Residual(
            [
                (keep[19], keep[20]),
                (keep[22], keep[23]),
                (keep[25], keep[26]),
                (keep[28], keep[29]),
                (keep[31], keep[32]),
                (keep[34], keep[35]),
            ],
            [
                (keep[20], keep[21]),
                (keep[23], keep[24]),
                (keep[26], keep[27]),
                (keep[29], keep[30]),
                (keep[32], keep[33]),
                (keep[35], keep[36]),
            ],
            [
                (keep[21], keep[22]),
                (keep[24], keep[25]),
                (keep[27], keep[28]),
                (keep[30], keep[31]),
                (keep[33], keep[34]),
                (keep[36], keep[37]),
            ],
            num_block=6,
            groups=keep[19],
        )
        self.conv_45 = DepthWise((keep[37], keep[38]), (keep[38], keep[39]), (keep[39], keep[40]), groups=keep[40])
        self.conv_5 = Residual(
            [(keep[40], keep[41]), (keep[43], keep[44])],
            [(keep[41], keep[42]), (keep[44], keep[45])],
            [(keep[42], keep[43]), (keep[45], keep[46])],
            num_block=2,
            groups=keep[40],
        )
        self.conv_6_sep = ConvBlock(keep[46], keep[47], kernel=(1, 1))
        self.conv_6_dw = LinearBlock(keep[47], keep[48], groups=keep[48], kernel=conv6_kernel)
        self.conv_6_flatten = Flatten()
        self.linear = nn.Linear(512, embedding_size, bias=False)
        self.bn = nn.BatchNorm1d(embedding_size)
        self.drop = nn.Dropout(p=drop_p)
        self.prob = nn.Linear(embedding_size, num_classes, bias=False)

    def forward(self, inputs: torch.Tensor) -> torch.Tensor:
        # Forward giữ đúng thứ tự stage như upstream để weights đã train hoạt động.
        outputs = self.conv1(inputs)
        outputs = self.conv2_dw(outputs)
        outputs = self.conv_23(outputs)
        outputs = self.conv_3(outputs)
        outputs = self.conv_34(outputs)
        outputs = self.conv_4(outputs)
        outputs = self.conv_45(outputs)
        outputs = self.conv_5(outputs)
        outputs = self.conv_6_sep(outputs)
        outputs = self.conv_6_dw(outputs)
        outputs = self.conv_6_flatten(outputs)
        if self.embedding_size != 512:
            outputs = self.linear(outputs)
        outputs = self.bn(outputs)
        outputs = self.drop(outputs)
        return self.prob(outputs)


class MiniFASNetSE(MiniFASNet):
    # Biến thể MiniFASNetV1SE kế thừa base network nhưng thay các stage residual
    # bằng stage có Squeeze-and-Excitation.
    def __init__(
        self,
        keep: list[int],
        embedding_size: int = 128,
        conv6_kernel: tuple[int, int] = (7, 7),
        drop_p: float = 0.75,
        num_classes: int = 3,
        img_channel: int = 3,
    ) -> None:
        super().__init__(keep, embedding_size, conv6_kernel, drop_p, num_classes, img_channel)
        self.conv_3 = ResidualSE(
            [(keep[4], keep[5]), (keep[7], keep[8]), (keep[10], keep[11]), (keep[13], keep[14])],
            [(keep[5], keep[6]), (keep[8], keep[9]), (keep[11], keep[12]), (keep[14], keep[15])],
            [(keep[6], keep[7]), (keep[9], keep[10]), (keep[12], keep[13]), (keep[15], keep[16])],
            num_block=4,
            groups=keep[4],
        )
        self.conv_4 = ResidualSE(
            [
                (keep[19], keep[20]),
                (keep[22], keep[23]),
                (keep[25], keep[26]),
                (keep[28], keep[29]),
                (keep[31], keep[32]),
                (keep[34], keep[35]),
            ],
            [
                (keep[20], keep[21]),
                (keep[23], keep[24]),
                (keep[26], keep[27]),
                (keep[29], keep[30]),
                (keep[32], keep[33]),
                (keep[35], keep[36]),
            ],
            [
                (keep[21], keep[22]),
                (keep[24], keep[25]),
                (keep[27], keep[28]),
                (keep[30], keep[31]),
                (keep[33], keep[34]),
                (keep[36], keep[37]),
            ],
            num_block=6,
            groups=keep[19],
        )
        self.conv_5 = ResidualSE(
            [(keep[40], keep[41]), (keep[43], keep[44])],
            [(keep[41], keep[42]), (keep[44], keep[45])],
            [(keep[42], keep[43]), (keep[45], keep[46])],
            num_block=2,
            groups=keep[40],
        )


def get_kernel(height: int, width: int) -> tuple[int, int]:
    # conv_6_dw dùng kernel phụ thuộc input size. Với 80x80 thì ra (5, 5),
    # đúng metadata trong filename 80x80 của model anti-spoofing.
    return (height + 15) // 16, (width + 15) // 16


def create_minifasnet(model_type: str, input_size: tuple[int, int]) -> nn.Module:
    # Factory dựa trên model_type parse từ filename .pth. Hàm này là điểm duy nhất
    # anti_spoofing.py cần biết để dựng đúng kiến trúc trước khi load weights.
    conv6_kernel = get_kernel(*input_size)
    if model_type == "MiniFASNetV2":
        return MiniFASNet(KEEP_DICT["1.8M_"], conv6_kernel=conv6_kernel, drop_p=0.2)
    if model_type == "MiniFASNetV1SE":
        return MiniFASNetSE(KEEP_DICT["1.8M"], conv6_kernel=conv6_kernel, drop_p=0.75)
    raise ValueError(f"Unsupported anti-spoofing model type: {model_type}")
