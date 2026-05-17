from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal, Mapping

import cv2
import numpy as np


if TYPE_CHECKING:
    from app.services.detection import DetectedFace


# Quality gate chạy sau Detection + Anti-Spoofing, trước Embedding.
# Status này là lý do reject cụ thể để pipeline/WebSocket gửi feedback cho frontend.
QualityStatus = Literal[
    "OK",
    "BLUR",
    "TOO_DARK",
    "TOO_BRIGHT",
    "FACE_TOO_SMALL",
    "BAD_POSE",
]


@dataclass(frozen=True)
class QualityCheckResult:
    # status là kết luận chính: OK nghĩa là frame đạt chất lượng để đi tiếp.
    status: QualityStatus

    # passed là bool tiện dùng trong pipeline: True thì cho embed, False thì reject.
    passed: bool

    # message là câu mô tả có thể trả về frontend, ví dụ "Ảnh bị mờ".
    message: str

    # blur_score = variance of Laplacian. Số càng cao nghĩa là ảnh càng nét.
    blur_score: float

    # brightness = mean grayscale. Số thấp là tối, cao là quá sáng/cháy sáng.
    brightness: float

    # face_ratio = diện tích bbox mặt / diện tích toàn ảnh. Dùng để phát hiện mặt quá nhỏ.
    face_ratio: float

    # pitch/yaw lấy từ DetectedFace.pose theo format [pitch, yaw, roll].
    # Nếu InsightFace không trả pose thì hai field này là None và status sẽ BAD_POSE.
    pitch: float | None
    yaw: float | None


class QualityGateService:
    def __init__(self, quality_config: Mapping[str, Any]) -> None:
        # quality_config được truyền từ config["quality"]. Ví dụ:
        # QualityGateService(config["quality"])
        # result = quality_gate.check(image, detected_face)

        # blur_threshold: ảnh có Laplacian variance nhỏ hơn ngưỡng này bị coi là mờ.
        self.blur_threshold = float(quality_config["blur_threshold"])

        # min/max brightness: khoảng sáng hợp lệ trên ảnh grayscale.
        self.min_brightness = float(quality_config["min_brightness"])
        self.max_brightness = float(quality_config["max_brightness"])

        # min_face_ratio: bbox mặt phải chiếm ít nhất từng này diện tích ảnh.
        # Ví dụ 0.05 nghĩa là mặt phải chiếm >= 5% frame.
        self.min_face_ratio = float(quality_config["min_face_ratio"])

        # max_yaw/max_pitch: giới hạn góc quay ngang và cúi/ngẩng tính bằng độ.
        self.max_yaw_deg = float(quality_config["max_yaw_deg"])
        self.max_pitch_deg = float(quality_config["max_pitch_deg"])

    def check(self, image: np.ndarray, face: DetectedFace) -> QualityCheckResult:
        # image là 1 frame BGR HxWx3 từ decode_base64_image().
        # face là DetectedFace đã pass detection và anti-spoofing.
        self._validate_image(image)

        # OpenCV tính blur/brightness trên ảnh grayscale ổn định và rẻ hơn ảnh màu.
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

        # Variance of Laplacian đo mức thay đổi biên/cạnh. Ảnh mờ có ít cạnh sắc,
        # nên variance thấp. Đây là heuristic phổ biến để loại frame rung/mất nét.
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        # Mean brightness lấy trung bình pixel grayscale trong range 0..255.
        brightness = float(gray.mean())

        # face_ratio dùng bbox từ detection. Bbox nhỏ thường là user đứng quá xa.
        face_ratio = self._face_ratio(image, face.bbox)

        # pose thường là [pitch, yaw, roll]. Quality gate chỉ cần pitch/yaw.
        pitch, yaw = self._extract_pitch_yaw(face)

        # Thứ tự reject theo plan: blur -> brightness -> face size -> pose.
        if blur_score < self.blur_threshold:
            return self._result(
                "BLUR",
                "Ảnh bị mờ, vui lòng giữ yên camera",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        if brightness < self.min_brightness:
            return self._result(
                "TOO_DARK",
                "Ảnh quá tối, vui lòng tăng ánh sáng",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        if brightness > self.max_brightness:
            return self._result(
                "TOO_BRIGHT",
                "Ảnh quá sáng, vui lòng giảm ánh sáng trực tiếp",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        if face_ratio < self.min_face_ratio:
            return self._result(
                "FACE_TOO_SMALL",
                "Khuôn mặt quá xa camera, vui lòng lại gần hơn",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        if pitch is None or yaw is None:
            return self._result(
                "BAD_POSE",
                "Không đọc được góc mặt, vui lòng nhìn thẳng camera",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        if abs(pitch) > self.max_pitch_deg or abs(yaw) > self.max_yaw_deg:
            return self._result(
                "BAD_POSE",
                "Góc mặt chưa phù hợp, vui lòng nhìn thẳng camera",
                blur_score,
                brightness,
                face_ratio,
                pitch,
                yaw,
            )

        return self._result(
            "OK",
            "Frame đạt chất lượng",
            blur_score,
            brightness,
            face_ratio,
            pitch,
            yaw,
        )

    @staticmethod
    def _validate_image(image: np.ndarray) -> None:
        # Ảnh hợp lệ phải là numpy array màu BGR với shape HxWx3.
        if not isinstance(image, np.ndarray):
            raise TypeError("image must be a numpy.ndarray")
        if image.ndim != 3 or image.shape[2] != 3:
            raise ValueError("image must be a BGR image with shape HxWx3")
        if image.size == 0:
            raise ValueError("image must not be empty")

    @staticmethod
    def _face_ratio(image: np.ndarray, bbox: np.ndarray) -> float:
        # bbox từ DetectedFace có format [x1, y1, x2, y2].
        # Clamp bbox vào biên ảnh để ratio không âm hoặc vượt frame khi model trả
        # tọa độ hơi lệch ra ngoài mép ảnh.
        height, width = image.shape[:2]
        x1, y1, x2, y2 = (float(value) for value in bbox[:4])
        x1 = min(max(x1, 0.0), float(width - 1))
        x2 = min(max(x2, 0.0), float(width - 1))
        y1 = min(max(y1, 0.0), float(height - 1))
        y2 = min(max(y2, 0.0), float(height - 1))

        face_width = max(0.0, x2 - x1 + 1.0)
        face_height = max(0.0, y2 - y1 + 1.0)
        image_area = float(height * width)
        return (face_width * face_height) / image_area

    @staticmethod
    def _extract_pitch_yaw(face: DetectedFace) -> tuple[float | None, float | None]:
        # DetectedFace.pose được FaceDetector chuẩn hóa từ InsightFace:
        # pose[0] = pitch (cúi/ngẩng), pose[1] = yaw (quay trái/phải).
        if face.pose is None or len(face.pose) < 2:
            return None, None
        return float(face.pose[0]), float(face.pose[1])

    @staticmethod
    def _result(
        status: QualityStatus,
        message: str,
        blur_score: float,
        brightness: float,
        face_ratio: float,
        pitch: float | None,
        yaw: float | None,
    ) -> QualityCheckResult:
        return QualityCheckResult(
            status=status,
            passed=status == "OK",
            message=message,
            blur_score=blur_score,
            brightness=brightness,
            face_ratio=face_ratio,
            pitch=pitch,
            yaw=yaw,
        )
