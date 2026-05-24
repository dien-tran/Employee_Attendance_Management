from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, Mapping

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from torch import nn

from app.core.runtime import RuntimeConfig, resolve_runtime
from app.services.minifasnet import create_minifasnet


if TYPE_CHECKING:
    from app.services.detection import DetectedFace


# Trạng thái trả về từ riêng bước anti-spoofing. Pipeline sẽ gọi service này
# sau khi detection đã OK, nên ở đây chỉ quan tâm thật/giả.
AntiSpoofStatus = Literal["OK", "SPOOF_DETECTED"]


@dataclass(frozen=True)
class AntiSpoofModelSpec:
    # path là file weight .pth thực tế, dùng làm key debug trong model_scores.
    path: Path

    # input_size lấy từ tên file, ví dụ 80x80. Mỗi model có thể yêu cầu size khác.
    input_size: tuple[int, int]

    # model_type lấy từ tên file, ví dụ MiniFASNetV2 hoặc MiniFASNetV1SE.
    model_type: str

    # scale là hệ số mở rộng bbox quanh mặt trước khi crop. Nếu filename bắt đầu
    # bằng "org" thì dùng nguyên ảnh, còn 2.7/4.0 nghĩa là crop rộng hơn bbox.
    scale: float | None


@dataclass(frozen=True)
class AntiSpoofResult:
    # status là kết luận chính để pipeline quyết định reject frame hay đi tiếp.
    status: AntiSpoofStatus

    # is_live là bool tiện dụng: True khi label là real và score vượt threshold.
    is_live: bool

    # live_score là xác suất lớp real/live sau khi average kết quả các model.
    live_score: float

    # predicted_label là class có xác suất cao nhất. Theo upstream: label 1 = real.
    predicted_label: int

    # model_scores giữ softmax của từng file model để debug khi threshold khó chỉnh.
    model_scores: dict[str, list[float]]

    # crop_boxes cho biết mỗi model đã crop vùng nào từ frame gốc:
    # {"model.pth": [left, top, right, bottom]}. Field này rất hữu ích khi
    # live_score thấp bất thường, vì chỉ cần crop lệch/sát mặt là model dễ báo fake.
    crop_boxes: dict[str, list[int]]

    # debug_crop_paths chỉ có dữ liệu khi config bật anti_spoof_debug_save_crops.
    # Ví dụ đường dẫn: log/crop/20260513T120000_2.7_80x80....jpg
    debug_crop_paths: dict[str, str]

    # source_frame_path là frame BGR 480x640 mà backend nhận sau decode base64.
    # Nếu preview frontend đẹp nhưng file này xấu/lệch/màu sai thì lỗi nằm ở input.
    source_frame_path: str | None

    # image_shape giúp xác nhận backend thật sự đang nhận frame HxWxC như kỳ vọng,
    # ví dụ [640, 480, 3] cho canvas portrait.
    image_shape: list[int]

    # crop_stats thống kê nhanh từng crop model nhận: shape, min/max, mean BGR.
    # Giá trị này giúp thấy crop có quá tối, ám màu, hoặc gần như đồng nhất không.
    crop_stats: dict[str, dict[str, Any]]

    # message là câu mô tả có thể trả về frontend hoặc log.
    message: str


class AntiSpoofingService:
    def __init__(
        self,
        model_config: Mapping[str, Any],
        runtime_config: Mapping[str, Any] | RuntimeConfig,
    ) -> None:
        # model_config đến từ config["model"], gồm anti_spoof_model_dir và threshold.
        self.threshold = float(model_config["anti_spoof_threshold"])
        self.model_dir = Path(str(model_config["anti_spoof_model_dir"]))
        self.decision_mode = str(model_config.get("anti_spoof_decision_mode", "strict")).lower()
        if self.decision_mode not in {"strict", "advisory"}:
            raise ValueError('anti_spoof_decision_mode must be "strict" or "advisory"')

        # anti_spoof_color_space quyết định crop BGR từ OpenCV có được đổi sang RGB
        # trước khi thành tensor hay không. Upstream dùng cv2.imread nên mặc định
        # là "bgr"; field này chỉ để debug/calibrate khi webcam cho score lạ.
        self.color_space = str(model_config.get("anti_spoof_color_space", "bgr")).lower()
        if self.color_space not in {"bgr", "rgb"}:
            raise ValueError('anti_spoof_color_space must be "bgr" or "rgb"')

        # Khi score live cực thấp, bật flag này để lưu crop 80x80/patch thực tế
        # mà từng MiniFASNet nhận. Mặc định tắt để không ghi ảnh mặt ra ổ đĩa.
        self.debug_save_crops = bool(model_config.get("anti_spoof_debug_save_crops", False))
        self.debug_dir = Path(str(model_config.get("anti_spoof_debug_dir", "./log/crop")))
        if self.debug_save_crops:
            self.debug_dir.mkdir(parents=True, exist_ok=True)

        # runtime_config đến từ config["runtime"]. Service dùng chung cơ chế CPU/GPU
        # với detection, nhưng ở đây cần torch_device thay vì onnx provider.
        self.runtime = (
            runtime_config
            if isinstance(runtime_config, RuntimeConfig)
            else resolve_runtime(runtime_config)
        )

        # Fail sớm nếu user chọn GPU nhưng PyTorch/CUDA chưa sẵn sàng. Lỗi này
        # dễ hiểu hơn nhiều so với để model load/inference crash sâu bên trong.
        if self.runtime.device == "gpu":
            if not torch.cuda.is_available():
                raise RuntimeError('runtime.device is "gpu" but torch.cuda is not available')
            if self.runtime.gpu_id >= torch.cuda.device_count():
                raise RuntimeError(f"GPU id {self.runtime.gpu_id} is not available")

        self.device = torch.device(self.runtime.torch_device)

        # Load model một lần khi khởi tạo service; pipeline không nên load lại
        # weights mỗi frame vì enrollment gửi nhiều frame liên tục qua WebSocket.
        self.models = self._load_models(self.model_dir)

    def check_liveness(self, image: np.ndarray, face: DetectedFace) -> AntiSpoofResult:
        # image là frame BGR đã decode, face là kết quả từ FaceDetector.detect_one().
        self._validate_image(image)

        # prediction_sum dùng để cộng softmax của nhiều model rồi average.
        prediction_sum: np.ndarray | None = None
        model_scores: dict[str, list[float]] = {}
        crop_boxes: dict[str, list[int]] = {}
        debug_crop_paths: dict[str, str] = {}
        crop_stats: dict[str, dict[str, Any]] = {}
        source_frame_path = self._save_debug_frame(image) if self.debug_save_crops else None

        for spec, model in self.models:
            # Mỗi weight có scale/input size riêng ghi trong filename, nên mỗi
            # model tự crop/resize frame theo spec trước khi inference.
            crop, crop_box = self._crop_face(image, face.bbox, spec)
            crop_boxes[spec.path.name] = list(crop_box)
            crop_stats[spec.path.name] = self._crop_stats(crop)
            if self.debug_save_crops:
                debug_crop_paths[spec.path.name] = self._save_debug_crop(crop, spec)
            tensor = self._to_tensor(crop).to(self.device)

            with torch.no_grad():
                # logits shape: [1, 3]. Ba class theo upstream; class 1 là real.
                logits = model(tensor)
                probabilities = F.softmax(logits, dim=1).cpu().numpy()[0]

            model_scores[spec.path.name] = probabilities.astype(float).tolist()
            prediction_sum = probabilities if prediction_sum is None else prediction_sum + probabilities

        assert prediction_sum is not None
        averaged_prediction = prediction_sum / len(self.models)
        predicted_label = int(np.argmax(averaged_prediction))

        # Upstream Silent-Face-Anti-Spoofing dùng label 1 là real/live face.
        live_score = float(averaged_prediction[1])
        is_live = predicted_label == 1 and live_score >= self.threshold

        if is_live or self.decision_mode == "advisory":
            return AntiSpoofResult(
                status="OK",
                is_live=is_live,
                live_score=live_score,
                predicted_label=predicted_label,
                model_scores=model_scores,
                crop_boxes=crop_boxes,
                debug_crop_paths=debug_crop_paths,
                source_frame_path=source_frame_path,
                image_shape=list(image.shape),
                crop_stats=crop_stats,
                message=(
                    "Khuôn mặt thật đạt ngưỡng anti-spoofing"
                    if is_live
                    else "Anti-spoofing đang ở chế độ advisory: score thấp nhưng không chặn frame"
                ),
            )

        return AntiSpoofResult(
            status="SPOOF_DETECTED",
            is_live=False,
            live_score=live_score,
            predicted_label=predicted_label,
            model_scores=model_scores,
            crop_boxes=crop_boxes,
            debug_crop_paths=debug_crop_paths,
            source_frame_path=source_frame_path,
            image_shape=list(image.shape),
            crop_stats=crop_stats,
            message="Phát hiện nghi ngờ giả mạo khuôn mặt",
        )

    def _load_models(self, model_dir: Path) -> list[tuple[AntiSpoofModelSpec, nn.Module]]:
        # models/anti_spoof phải có ít nhất một file .pth. Hiện project đã tải
        # 2 weights MiniFASNet, và sorted() giúp thứ tự load ổn định.
        if not model_dir.exists():
            raise FileNotFoundError(f"Anti-spoofing model directory not found: {model_dir}")

        model_paths = sorted(model_dir.glob("*.pth"))
        if not model_paths:
            raise FileNotFoundError(f"No anti-spoofing .pth files found in: {model_dir}")

        loaded_models: list[tuple[AntiSpoofModelSpec, nn.Module]] = []
        for model_path in model_paths:
            # Filename chứa metadata runtime, ví dụ:
            # 2.7_80x80_MiniFASNetV2.pth -> scale=2.7, size=80x80, type=V2.
            spec = self._parse_model_name(model_path)
            model = create_minifasnet(spec.model_type, spec.input_size).to(self.device)
            state_dict = torch.load(model_path, map_location=self.device)

            # Weights upstream thường được train bằng DataParallel nên key có
            # prefix "module.". Model local không bọc DataParallel nên cần strip.
            model.load_state_dict(self._strip_module_prefix(state_dict))

            # eval() tắt dropout/batchnorm training behavior để inference ổn định.
            model.eval()
            loaded_models.append((spec, model))

        return loaded_models

    @staticmethod
    def _parse_model_name(model_path: Path) -> AntiSpoofModelSpec:
        # Format upstream: <scale>_<height>x<width>_<ModelType>.pth
        # Ví dụ: 2.7_80x80_MiniFASNetV2.pth.
        name_parts = model_path.name.split(".pth")[0].split("_")
        if len(name_parts) < 2:
            raise ValueError(f"Invalid anti-spoofing model filename: {model_path.name}")

        model_type = name_parts[-1]
        input_token = name_parts[-2]
        try:
            height, width = (int(value) for value in input_token.split("x", 1))
        except ValueError as exc:
            raise ValueError(f"Invalid input size in model filename: {model_path.name}") from exc

        scale = None if name_parts[0] == "org" else float(name_parts[0])
        return AntiSpoofModelSpec(
            path=model_path,
            input_size=(height, width),
            model_type=model_type,
            scale=scale,
        )

    @staticmethod
    def _strip_module_prefix(state_dict: Mapping[str, torch.Tensor]) -> OrderedDict[str, torch.Tensor]:
        # Chuyển "module.conv1..." thành "conv1..." nếu cần.
        cleaned_state_dict: OrderedDict[str, torch.Tensor] = OrderedDict()
        for key, value in state_dict.items():
            cleaned_key = key[7:] if key.startswith("module.") else key
            cleaned_state_dict[cleaned_key] = value
        return cleaned_state_dict

    @staticmethod
    def _validate_image(image: np.ndarray) -> None:
        # OpenCV image hợp lệ phải là numpy array HxWx3, dtype thường là uint8.
        if not isinstance(image, np.ndarray):
            raise TypeError("image must be a numpy.ndarray")
        if image.ndim != 3 or image.shape[2] != 3:
            raise ValueError("image must be a BGR image with shape HxWx3")
        if image.size == 0:
            raise ValueError("image must not be empty")

    @classmethod
    def _crop_face(
        cls,
        image: np.ndarray,
        xyxy_bbox: np.ndarray,
        spec: AntiSpoofModelSpec,
    ) -> tuple[np.ndarray, tuple[int, int, int, int]]:
        height, width = image.shape[:2]
        bbox = cls._xyxy_to_xywh(xyxy_bbox)

        if spec.scale is None:
            # Một số model upstream có thể dùng "org" để lấy nguyên ảnh.
            crop = image
            crop_box = (0, 0, width - 1, height - 1)
        else:
            # Bbox từ InsightFace là [x1, y1, x2, y2]. MiniFASNet upstream crop
            # theo [x, y, w, h] rồi scale rộng ra để lấy cả vùng quanh mặt.
            crop_box = cls._scaled_box(width, height, bbox, spec.scale)
            left, top, right, bottom = crop_box
            crop = image[top : bottom + 1, left : right + 1]

        if crop.size == 0:
            raise ValueError("Anti-spoofing face crop is empty")

        out_h, out_w = spec.input_size
        resized_crop = cv2.resize(crop, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
        return resized_crop, crop_box

    @staticmethod
    def _xyxy_to_xywh(xyxy_bbox: np.ndarray) -> tuple[float, float, float, float]:
        # InsightFace dùng [x1, y1, x2, y2], còn crop logic upstream dùng
        # [x, y, width, height]. +1 giữ cách tính inclusive pixel box.
        x1, y1, x2, y2 = (float(value) for value in xyxy_bbox[:4])
        return x1, y1, max(1.0, x2 - x1 + 1.0), max(1.0, y2 - y1 + 1.0)

    @staticmethod
    def _scaled_box(
        image_width: int,
        image_height: int,
        bbox: tuple[float, float, float, float],
        scale: float,
    ) -> tuple[int, int, int, int]:
        x, y, box_w, box_h = bbox

        # Không cho scale vượt kích thước ảnh, nếu không crop sẽ đi ra ngoài biên.
        scale = min((image_height - 1) / box_h, (image_width - 1) / box_w, scale)
        new_width = box_w * scale
        new_height = box_h * scale
        center_x = x + box_w / 2
        center_y = y + box_h / 2

        # Mở rộng bbox quanh tâm mặt.
        left = center_x - new_width / 2
        top = center_y - new_height / 2
        right = center_x + new_width / 2
        bottom = center_y + new_height / 2

        # Nếu box vượt biên, đẩy ngược lại để vẫn giữ vùng crop lớn nhất có thể.
        if left < 0:
            right -= left
            left = 0
        if top < 0:
            bottom -= top
            top = 0
        if right > image_width - 1:
            left -= right - image_width + 1
            right = image_width - 1
        if bottom > image_height - 1:
            top -= bottom - image_height + 1
            bottom = image_height - 1

        left = max(0, int(left))
        top = max(0, int(top))
        right = min(image_width - 1, int(right))
        bottom = min(image_height - 1, int(bottom))
        return left, top, right, bottom

    def _to_tensor(self, image: np.ndarray) -> torch.Tensor:
        # OpenCV giữ ảnh BGR HxWxC uint8. MiniFASNet nhận tensor CxHxW float
        # trong range 0..1, giống transform ToTensor của upstream.
        if self.color_space == "rgb":
            # Browser/camera thường nghĩ theo RGB; nếu cần kiểm chứng domain màu,
            # đổi BGR -> RGB tại đây rồi chạy lại để so score hai chế độ.
            image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        tensor = torch.from_numpy(image.transpose(2, 0, 1)).float() / 255.0
        return tensor.unsqueeze(0)

    def _save_debug_crop(self, crop: np.ndarray, spec: AntiSpoofModelSpec) -> str:
        # Lưu đúng crop resized mà model nhận. File này chỉ dùng debug local,
        # không trả ảnh base64 qua WebSocket để tránh payload lớn và lộ dữ liệu mặt.
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        debug_name = f"{timestamp}_{spec.path.stem}.jpg"
        debug_path = self.debug_dir / debug_name
        cv2.imwrite(str(debug_path), crop)
        return str(debug_path)

    def _save_debug_frame(self, image: np.ndarray) -> str:
        # Lưu nguyên frame BGR sau decode base64, trước crop anti-spoofing.
        # Đây là ảnh quan trọng nhất để kiểm tra frontend gửi vào backend có đúng
        # preview không: đúng tỉ lệ, đúng màu, đúng độ sáng, không bị padding/crop lạ.
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        debug_path = self.debug_dir / f"{timestamp}_source_frame.jpg"
        cv2.imwrite(str(debug_path), image)
        return str(debug_path)

    def _crop_stats(self, crop: np.ndarray) -> dict[str, Any]:
        # Thống kê trên crop BGR resized 80x80 trước khi thành tensor. Nếu dùng
        # color_space="rgb", tensor sẽ đảo kênh sau bước này; field color_space
        # cho biết model đang nhận mode nào.
        channel_mean = crop.mean(axis=(0, 1))
        channel_min = crop.min(axis=(0, 1))
        channel_max = crop.max(axis=(0, 1))
        return {
            "shape": list(crop.shape),
            "color_space": self.color_space,
            "bgr_mean": [float(value) for value in channel_mean],
            "bgr_min": [int(value) for value in channel_min],
            "bgr_max": [int(value) for value in channel_max],
        }
