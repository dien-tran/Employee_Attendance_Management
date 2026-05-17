from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal, Mapping

import numpy as np
from insightface.app import FaceAnalysis

from app.core.runtime import RuntimeConfig, resolve_runtime


# Các trạng thái detection mà pipeline/WebSocket có thể map thành feedback
# realtime cho frontend. Ở bước này chỉ kiểm tra "có đúng 1 mặt đủ tin cậy"
# chứ chưa kiểm tra anti-spoofing hay quality.
DetectionStatus = Literal[
    "OK",
    "NO_FACE",
    "MULTIPLE_FACES",
    "LOW_CONFIDENCE",
    "FACE_OUT_OF_FRAME",
]


@dataclass(frozen=True)
class DetectedFace:
    # bbox là khung mặt theo format [x1, y1, x2, y2] trên ảnh gốc.
    # Bước anti-spoofing kế tiếp sẽ dùng bbox để crop vùng mặt.
    bbox: np.ndarray

    # det_score là confidence của RetinaFace detector trong InsightFace.
    # Nếu thấp hơn det_score_threshold thì frame bị trả LOW_CONFIDENCE.
    det_score: float

    # landmarks/kps là các điểm đặc trưng như mắt, mũi, miệng.
    # Hiện chưa dùng trực tiếp, nhưng hữu ích cho align hoặc quality nâng cao.
    landmarks: np.ndarray | None

    # pose thường là [pitch, yaw, roll]. Quality gate sẽ dùng pitch/yaw
    # để loại frame cúi/ngẩng hoặc quay mặt quá nhiều.
    pose: tuple[float, float, float] | None

    # normed_embedding là vector ArcFace 512-D đã L2-normalize do buffalo_l trả.
    # Enrollment sẽ gom các embedding tốt rồi average + normalize lần cuối.
    normed_embedding: np.ndarray | None

    # raw giữ object gốc từ InsightFace để debug hoặc mở rộng mà không cần
    # chạy lại model. Code pipeline nên ưu tiên dùng các field chuẩn bên trên.
    raw: Any


@dataclass(frozen=True)
class FaceDetectionResult:
    # status cho biết frame này qua được bước detection hay bị reject vì lý do gì.
    status: DetectionStatus

    # face_count là số mặt InsightFace tìm thấy, giúp frontend/pipeline báo lỗi rõ.
    face_count: int

    # message là thông báo người đọc được; API có thể trả thẳng về frontend.
    message: str

    # face chỉ có dữ liệu khi tìm thấy đúng 1 candidate; các bước sau sẽ đọc
    # bbox/det_score/pose/embedding từ đây.
    face: DetectedFace | None = None


class FaceDetector:
    def __init__(
        self,
        model_config: Mapping[str, Any],
        runtime_config: Mapping[str, Any] | RuntimeConfig,
    ) -> None:
        # model_config được truyền từ config["model"], ví dụ:
        # insightface_model_name, insightface_root, det_size, threshold...
        # Không đọc YAML trực tiếp ở đây để service dễ test và dễ inject config.
        self.det_score_threshold = float(model_config["det_score_threshold"])
        self.min_bbox_inside_ratio = float(model_config.get("det_min_bbox_inside_ratio", 0.92))

        # det_candidate_threshold là ngưỡng thấp hơn để InsightFace giữ lại
        # candidate ban đầu. det_score_threshold mới là ngưỡng chấp nhận frame.
        # Nhờ vậy pipeline vẫn phân biệt được LOW_CONFIDENCE với NO_FACE.
        self.det_candidate_threshold = float(
            model_config.get("det_candidate_threshold", self.det_score_threshold)
        )

        # det_size là kích thước input detector, lấy từ config để dễ đổi
        # giữa độ chính xác và tốc độ mà không sửa code Python.
        self.det_size = tuple(int(value) for value in model_config["det_size"])

        # runtime_config được truyền từ config["runtime"]. Nếu caller đã resolve
        # thành RuntimeConfig thì dùng luôn; nếu chưa thì resolve CPU/GPU tại đây.
        self.runtime = (
            runtime_config
            if isinstance(runtime_config, RuntimeConfig)
            else resolve_runtime(runtime_config)
        )

        # FaceAnalysis tự load ./models/buffalo_l/*.onnx theo name + root trong config.
        self.app = FaceAnalysis(
            name=str(model_config["insightface_model_name"]),
            root=str(model_config["insightface_root"]),

            # providers quyết định ONNX Runtime chạy CPU hay CUDA. CPU mode ép
            # CPUExecutionProvider để máy không có CUDA không bị cố load GPU DLL.
            providers=list(self.runtime.onnx_providers),
        )

        # ctx_id = -1 là CPU; ctx_id = gpu_id là GPU. det_candidate_threshold
        # chỉ lấy các candidate đủ đáng tin để tránh nhiễu, còn det_score_threshold
        # phía dưới mới quyết định frame được nhận hay trả LOW_CONFIDENCE.
        self.app.prepare(
            ctx_id=self.runtime.insightface_ctx_id,
            det_thresh=self.det_candidate_threshold,
            det_size=self.det_size,
        )

    def detect_one(self, image: np.ndarray) -> FaceDetectionResult:
        """Detect exactly one face from a decoded OpenCV BGR image."""
        # image là 1 frame đã decode từ base64 frontend sang numpy array BGR.
        # Validate sớm để lỗi input rõ ràng trước khi đưa vào model nặng.
        self._validate_image(image)

        # image đã là 1 frame BGR từ decode_base64_image(); app.get chạy detect,
        # landmark, pose và recognition embedding của buffalo_l trên cùng frame.
        faces = self.app.get(image)
        face_count = len(faces)

        # Không có mặt: reject frame ngay, frontend có thể nhắc user vào khung hình.
        if face_count == 0:
            return FaceDetectionResult(
                status="NO_FACE",
                face_count=0,
                message="Không phát hiện khuôn mặt trong ảnh",
            )

        # Nhiều mặt: reject vì enrollment chỉ được gắn với đúng 1 nhân viên.
        if face_count > 1:
            return FaceDetectionResult(
                status="MULTIPLE_FACES",
                face_count=face_count,
                message="Ảnh chỉ được có đúng 1 khuôn mặt",
            )

        # Tới đây chỉ còn 1 face candidate. Chuyển object InsightFace sang
        # dataclass nội bộ để các bước sau không phụ thuộc trực tiếp vào API động.
        face = self._to_detected_face(faces[0])

        # Có mặt nhưng confidence thấp: trả LOW_CONFIDENCE để pipeline/frontend
        # phân biệt với NO_FACE và có thể nhắc user giữ mặt rõ hơn.
        if face.det_score < self.det_score_threshold:
            return FaceDetectionResult(
                status="LOW_CONFIDENCE",
                face_count=1,
                message="Độ tin cậy phát hiện khuôn mặt quá thấp",
                face=face,
            )

        if self._bbox_inside_ratio(image, face.bbox) < self.min_bbox_inside_ratio:
            return FaceDetectionResult(
                status="FACE_OUT_OF_FRAME",
                face_count=1,
                message="Khuôn mặt chưa nằm trọn trong khung hình",
                face=face,
            )

        # Detection pass: đúng 1 mặt và confidence đạt ngưỡng. Frame vẫn phải
        # đi tiếp qua anti-spoofing và quality gate trước khi dùng embedding.
        return FaceDetectionResult(
            status="OK",
            face_count=1,
            message="Phát hiện đúng 1 khuôn mặt",
            face=face,
        )

    @staticmethod
    def _validate_image(image: np.ndarray) -> None:
        # Backend xử lý ảnh OpenCV màu BGR, nên shape hợp lệ phải là H x W x 3.
        # H = height, W = width, 3 = ba kênh màu BGR. Đây là format cv2.imdecode
        # trả về trong app/utils/image.py.
        if not isinstance(image, np.ndarray):
            raise TypeError("image must be a numpy.ndarray")
        if image.ndim != 3 or image.shape[2] != 3:
            raise ValueError("image must be a BGR image with shape HxWx3")
        if image.size == 0:
            raise ValueError("image must not be empty")

    @staticmethod
    def _to_detected_face(face: Any) -> DetectedFace:
        # InsightFace trả object động; mình gom các field cần cho những bước sau:
        # bbox cho anti-spoof crop, det_score để lọc, pose cho quality, embedding cho ArcFace.
        pose = getattr(face, "pose", None)
        return DetectedFace(
            # Ép dtype float32 để thống nhất với OpenCV/numpy/model pipeline.
            bbox=np.asarray(face.bbox, dtype=np.float32),
            det_score=float(face.det_score),

            # kps có thể không tồn tại tùy model/module, nên luôn đọc an toàn.
            landmarks=(
                np.asarray(face.kps, dtype=np.float32)
                if getattr(face, "kps", None) is not None
                else None
            ),

            # pose cũng có thể vắng mặt; nếu có thì chuyển sang tuple float thuần
            # để serialization/debug dễ hơn numpy scalar.
            pose=tuple(float(value) for value in pose) if pose is not None else None,

            # normed_embedding là output recognition. Nếu detection pass và frame
            # sau này pass quality thì embedding này sẽ được dùng cho enrollment.
            normed_embedding=(
                np.asarray(face.normed_embedding, dtype=np.float32)
                if getattr(face, "normed_embedding", None) is not None
                else None
            ),
            raw=face,
        )

    @staticmethod
    def _bbox_inside_ratio(image: np.ndarray, bbox: np.ndarray) -> float:
        height, width = image.shape[:2]
        x1, y1, x2, y2 = (float(value) for value in bbox[:4])

        bbox_width = max(0.0, x2 - x1 + 1.0)
        bbox_height = max(0.0, y2 - y1 + 1.0)
        bbox_area = bbox_width * bbox_height
        if bbox_area <= 0.0:
            return 0.0

        clipped_x1 = min(max(x1, 0.0), float(width - 1))
        clipped_x2 = min(max(x2, 0.0), float(width - 1))
        clipped_y1 = min(max(y1, 0.0), float(height - 1))
        clipped_y2 = min(max(y2, 0.0), float(height - 1))
        clipped_width = max(0.0, clipped_x2 - clipped_x1 + 1.0)
        clipped_height = max(0.0, clipped_y2 - clipped_y1 + 1.0)
        return (clipped_width * clipped_height) / bbox_area
