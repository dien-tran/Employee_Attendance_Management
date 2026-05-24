from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Mapping, Protocol

import numpy as np

from app.core.exceptions import EnrollmentError, internal_error, invalid_image, invalid_message
from app.core.exceptions import timeout_error, vector_db_error
from app.schemas.enrollment import EnrollmentCaptureMessage, EnrollmentCompleteData
from app.schemas.enrollment import EnrollmentCompleteResponse, GoodFrameResponse
from app.schemas.enrollment import RejectedFrameResponse, EnrollmentErrorResponse
from app.schemas.enrollment import parse_enrollment_capture_message
from app.utils.image import decode_base64_image


if TYPE_CHECKING:
    from app.services.anti_spoofing import AntiSpoofResult
    from app.services.detection import DetectedFace, FaceDetectionResult
    from app.services.preprocessing import QualityCheckResult


class FaceDetectorPort(Protocol):
    # Protocol mô tả phần pipeline cần từ FaceDetector, giúp test bằng fake service
    # mà không phải load InsightFace thật.
    def detect_one(self, image: np.ndarray) -> FaceDetectionResult:
        ...


class AntiSpoofingPort(Protocol):
    # check_liveness nhận ảnh BGR và DetectedFace, trả OK hoặc SPOOF_DETECTED.
    def check_liveness(self, image: np.ndarray, face: DetectedFace) -> AntiSpoofResult:
        ...


class QualityGatePort(Protocol):
    # check chạy blur/brightness/face size/pose trước khi lấy embedding.
    def check(self, image: np.ndarray, face: DetectedFace) -> QualityCheckResult:
        ...


class EmbeddingPort(Protocol):
    # extract lấy face.normed_embedding từng frame; average_and_normalize tạo final embedding.
    def extract(self, face: DetectedFace) -> np.ndarray:
        ...

    def average_and_normalize(self, embeddings: list[np.ndarray]) -> np.ndarray:
        ...


class VectorDBPort(Protocol):
    # Vector DB chỉ nhận final embedding đã L2-normalized và metadata đã đủ field.
    def ensure_collection(self) -> None:
        ...

    def upsert_face_embedding(self, embedding: np.ndarray, metadata: Mapping[str, Any]) -> str:
        ...


class StaffStatusPort(Protocol):
    # Sau khi embedding lưu thành công, auth-service phải biết nhân viên đã có face.
    def mark_has_face(self, staff_id: str) -> None:
        ...


@dataclass
class EnrollmentSessionState:
    # total_frames là số frame hợp lệ schema đã đi vào pipeline trong WebSocket session.
    total_frames: int = 0

    # employee_metadata được set ở frame đầu tiên và phải giữ nguyên tới cuối session.
    employee_metadata: dict[str, str] | None = None

    # good_embeddings chỉ chứa embedding của frame đã pass toàn bộ:
    # Detection -> Anti-Spoofing -> Quality Gate.
    good_embeddings: list[np.ndarray] = field(default_factory=list)

    # anti_spoof_scores dùng để tính metadata anti_spoof_score_avg khi complete.
    anti_spoof_scores: list[float] = field(default_factory=list)

    # quality_scores hiện lưu det_score của các frame tốt. Plan gọi field này là
    # quality_score_avg, nhưng mô tả metadata là trung bình detection confidence.
    quality_scores: list[float] = field(default_factory=list)

    # completed=True sau khi đã average embedding và upsert Qdrant thành công.
    completed: bool = False


class EnrollmentPipeline:
    def __init__(
        self,
        detector: FaceDetectorPort,
        anti_spoofing: AntiSpoofingPort,
        quality_gate: QualityGatePort,
        embedding_service: EmbeddingPort,
        vector_db: VectorDBPort,
        staff_status: StaffStatusPort,
        enrollment_config: Mapping[str, Any],
        model_config: Mapping[str, Any],
    ) -> None:
        # Pipeline không tự khởi tạo model/service nặng. API/dependencies layer sẽ
        # tạo singleton rồi inject vào đây, để mỗi frame không load model lại.
        self.detector = detector
        self.anti_spoofing = anti_spoofing
        self.quality_gate = quality_gate
        self.embedding_service = embedding_service
        self.vector_db = vector_db
        self.staff_status = staff_status

        # required_good_frames: số frame tốt cần thu thập, ví dụ 10.
        self.required_good_frames = int(enrollment_config["required_good_frames"])

        # max_total_frames: giới hạn số frame frontend được gửi trong một session.
        self.max_total_frames = int(enrollment_config["max_total_frames"])

        # model_version lưu vào Qdrant metadata để sau này biết embedding sinh từ model nào.
        self.model_version = str(model_config.get("insightface_model_name", "unknown"))

        # Mỗi instance pipeline đại diện cho một enrollment session/WebSocket connection.
        self.state = EnrollmentSessionState()

    def handle_capture_payload(
        self,
        payload: Mapping[str, Any],
    ) -> dict[str, Any]:
        # Entry point tiện cho WebSocket endpoint sau này:
        # raw_payload = await websocket.receive_json()
        # response = pipeline.handle_capture_payload(raw_payload)
        # await websocket.send_json(response)
        #
        # Hàm này luôn trả dict JSON-safe, không để EnrollmentError thoát ra API layer.
        try:
            message = parse_enrollment_capture_message(payload)
            response = self.process_capture(message)
            return response.model_dump(exclude_none=True)
        except EnrollmentError as exc:
            return self._error_payload(exc)
        except Exception as exc:
            # Bắt lỗi bất ngờ để WebSocket vẫn nhận response có cấu trúc.
            # Endpoint sau này vẫn nên log exception đầy đủ ở API layer nếu cần.
            return self._error_payload(
                internal_error(
                    "Lỗi nội bộ khi xử lý enrollment",
                    details={"error": str(exc)},
                )
            )

    def process_capture(
        self,
        message: EnrollmentCaptureMessage,
    ) -> GoodFrameResponse | EnrollmentCompleteResponse:
        # process_capture xử lý đúng một frame. Nếu frame bị reject hoặc session lỗi,
        # hàm raise EnrollmentError để handle_capture_payload convert thành response.
        if self.state.completed:
            raise invalid_message("Enrollment session đã hoàn tất, không nhận thêm frame")

        self._remember_or_validate_employee(message)
        self.state.total_frames += 1

        if self.state.total_frames > self.max_total_frames:
            raise timeout_error(
                "Đã vượt quá số frame tối đa nhưng chưa đủ frame tốt",
                details={
                    "total_frames": self.state.total_frames,
                    "max_total_frames": self.max_total_frames,
                    "accepted_count": self.accepted_count,
                    "required_count": self.required_good_frames,
                },
            )

        image = self._decode_image(message.image)
        face = self._detect_face(image)
        anti_spoof_result = self._check_liveness(image, face)
        quality_result = self._check_quality(image, face)
        embedding = self.embedding_service.extract(face)

        # Tới đây frame đã đạt đủ điều kiện, nên mới được đưa vào list good_embeddings.
        self.state.good_embeddings.append(embedding)
        self.state.anti_spoof_scores.append(float(anti_spoof_result.live_score))
        self.state.quality_scores.append(float(face.det_score))

        if self.accepted_count >= self.required_good_frames:
            return self._complete_enrollment()

        return GoodFrameResponse(
            accepted_count=self.accepted_count,
            required_count=self.required_good_frames,
            anti_spoof_score=float(anti_spoof_result.live_score),
            face_bbox=self._bbox_to_payload(face),
            anti_spoof_predicted_label=int(anti_spoof_result.predicted_label),
            anti_spoof_model_scores=anti_spoof_result.model_scores,
            anti_spoof_crop_boxes=anti_spoof_result.crop_boxes,
            anti_spoof_debug_crop_paths=anti_spoof_result.debug_crop_paths or None,
            anti_spoof_source_frame_path=anti_spoof_result.source_frame_path,
            anti_spoof_image_shape=anti_spoof_result.image_shape,
            anti_spoof_crop_stats=anti_spoof_result.crop_stats,
            message=f"Frame đạt chất lượng ({self.accepted_count}/{self.required_good_frames})",
        )

    @property
    def accepted_count(self) -> int:
        # accepted_count là số frame tốt đã tích lũy trong session.
        return len(self.state.good_embeddings)

    def _remember_or_validate_employee(self, message: EnrollmentCaptureMessage) -> None:
        incoming_metadata = message.to_employee_metadata()
        if self.state.employee_metadata is None:
            self.state.employee_metadata = incoming_metadata
            return

        # Trong cùng một WebSocket enrollment session, frontend không được đổi nhân viên
        # giữa chừng. Nếu đổi employee_id/full_name/date_of_birth, final embedding sẽ
        # bị gắn sai metadata.
        if incoming_metadata != self.state.employee_metadata:
            raise invalid_message(
                "Thông tin nhân viên không nhất quán trong cùng enrollment session",
                details={
                    "expected": self.state.employee_metadata,
                    "received": incoming_metadata,
                },
            )

    @staticmethod
    def _decode_image(image_data: str) -> np.ndarray:
        # image_data là data URL/base64 từ schema. Ví dụ:
        # "data:image/jpeg;base64,/9j/..."
        try:
            return decode_base64_image(image_data)
        except ValueError as exc:
            raise invalid_image("Ảnh gửi lên không hợp lệ", details={"error": str(exc)}) from exc

    @staticmethod
    def _rejection_details(base: Mapping[str, Any]) -> dict[str, Any]:
        # Ép details về dict thường để payload trả WebSocket JSON-safe hơn.
        return dict(base)

    def _detect_face(self, image: np.ndarray) -> DetectedFace:
        detection_result = self.detector.detect_one(image)
        if detection_result.status == "OK" and detection_result.face is not None:
            return detection_result.face

        details: dict[str, Any] = {"face_count": detection_result.face_count}
        if detection_result.face is not None:
            details["det_score"] = detection_result.face.det_score
            details["face_bbox"] = self._bbox_to_payload(detection_result.face)

        raise EnrollmentError(
            code=detection_result.status,
            message=detection_result.message,
            details=self._rejection_details(details),
            per_frame=True,
        )

    def _check_liveness(self, image: np.ndarray, face: DetectedFace) -> AntiSpoofResult:
        anti_spoof_result = self.anti_spoofing.check_liveness(image, face)
        if anti_spoof_result.status == "OK":
            return anti_spoof_result

        raise EnrollmentError(
            code="SPOOF_DETECTED",
            message=anti_spoof_result.message,
            details={
                "live_score": anti_spoof_result.live_score,
                "predicted_label": anti_spoof_result.predicted_label,
                "model_scores": anti_spoof_result.model_scores,
                "crop_boxes": anti_spoof_result.crop_boxes,
                "debug_crop_paths": anti_spoof_result.debug_crop_paths,
                "source_frame_path": anti_spoof_result.source_frame_path,
                "image_shape": anti_spoof_result.image_shape,
                "crop_stats": anti_spoof_result.crop_stats,
                "face_bbox": self._bbox_to_payload(face),
            },
            per_frame=True,
        )

    def _check_quality(self, image: np.ndarray, face: DetectedFace) -> QualityCheckResult:
        quality_result = self.quality_gate.check(image, face)
        if quality_result.passed:
            return quality_result

        raise EnrollmentError(
            code=quality_result.status,
            message=quality_result.message,
            details={
                "blur_score": quality_result.blur_score,
                "brightness": quality_result.brightness,
                "face_ratio": quality_result.face_ratio,
                "pitch": quality_result.pitch,
                "yaw": quality_result.yaw,
                "face_bbox": self._bbox_to_payload(face),
            },
            per_frame=True,
        )

    @staticmethod
    def _bbox_to_payload(face: DetectedFace) -> tuple[float, float, float, float]:
        # Bbox từ InsightFace là numpy array [x1, y1, x2, y2] theo frame gốc.
        # Ép về tuple float thuần để Pydantic/WebSocket serialize JSON ổn định.
        x1, y1, x2, y2 = (float(value) for value in face.bbox[:4])
        return x1, y1, x2, y2

    def _complete_enrollment(self) -> EnrollmentCompleteResponse:
        if self.state.employee_metadata is None:
            raise internal_error("Thiếu metadata nhân viên khi hoàn tất enrollment")

        final_embedding = self.embedding_service.average_and_normalize(self.state.good_embeddings)
        metadata = self._build_qdrant_metadata()

        try:
            self.vector_db.ensure_collection()
            embedding_id = self.vector_db.upsert_face_embedding(final_embedding, metadata)
        except Exception as exc:
            raise vector_db_error(
                "Không thể lưu embedding vào Qdrant",
                details={"error": str(exc)},
            ) from exc

        try:
            self.staff_status.mark_has_face(str(metadata["employee_id"]))
        except Exception as exc:
            raise internal_error(
                "Đã lưu embedding nhưng không thể cập nhật has_face cho nhân viên",
                details={"employee_id": metadata["employee_id"], "error": str(exc)},
            ) from exc

        self.state.completed = True

        return EnrollmentCompleteResponse(
            message="Đăng ký khuôn mặt thành công",
            data=EnrollmentCompleteData(
                embedding_id=embedding_id,
                employee_id=metadata["employee_id"],
                full_name=metadata["full_name"],
                date_of_birth=metadata["date_of_birth"],
                num_frames_used=metadata["num_frames_used"],
                anti_spoof_score_avg=metadata["anti_spoof_score_avg"],
                quality_score_avg=metadata["quality_score_avg"],
            ),
        )

    def _build_qdrant_metadata(self) -> dict[str, Any]:
        # Metadata này là payload lưu cùng vector trong Qdrant.
        # employee_id/full_name/date_of_birth đến từ schema; các field còn lại
        # đến từ session sau khi đủ frame tốt.
        if self.state.employee_metadata is None:
            raise internal_error("Thiếu metadata nhân viên")

        anti_spoof_score_avg = float(np.mean(self.state.anti_spoof_scores))
        quality_score_avg = float(np.mean(self.state.quality_scores))

        return {
            **self.state.employee_metadata,
            "enrolled_at": datetime.now(timezone.utc).isoformat(),
            "num_frames_used": self.accepted_count,
            "anti_spoof_score_avg": anti_spoof_score_avg,
            "quality_score_avg": quality_score_avg,
            "model_version": self.model_version,
        }

    def _error_payload(self, error: EnrollmentError) -> dict[str, Any]:
        # Khi frame bị reject, frontend vẫn cần accepted_count/required_count để
        # progress bar không bị mất trạng thái hiện tại.
        payload = error.to_websocket_payload(
            accepted_count=self.accepted_count,
            required_count=self.required_good_frames,
        )

        if payload["status"] == "REJECTED":
            return RejectedFrameResponse.model_validate(payload).model_dump(exclude_none=True)

        return EnrollmentErrorResponse.model_validate(payload).model_dump(exclude_none=True)
