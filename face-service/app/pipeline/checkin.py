from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Mapping, Protocol

import numpy as np

from app.core.exceptions import CheckinError, checkin_frame_error, checkin_internal_error
from app.core.exceptions import checkin_invalid_message
from app.core.exceptions import checkin_invalid_image, checkin_timeout_error
from app.schemas.checkin import AttendanceFrameMessage, AttendanceSessionResponse
from app.schemas.checkin import CheckinEmployeeOverlay, CheckinErrorResponse
from app.schemas.checkin import ProcessingFrameResponse, RejectedFrameResponse
from app.schemas.checkin import UnknownFaceResponse, parse_attendance_frame_message
from app.services.attendance import AttendanceDecision
from app.services.vector_db import FaceSearchHit
from app.utils.image import decode_base64_image


if TYPE_CHECKING:
    from app.services.anti_spoofing import AntiSpoofResult
    from app.services.detection import DetectedFace, FaceDetectionResult
    from app.services.preprocessing import QualityCheckResult


class FaceDetectorPort(Protocol):
    # Protocol giúp test pipeline bằng fake detector mà không load InsightFace.
    def detect_one(self, image: np.ndarray) -> FaceDetectionResult:
        ...


class AntiSpoofingPort(Protocol):
    # check_liveness luôn chạy để lấy advisory/debug score cho check-in.
    def check_liveness(self, image: np.ndarray, face: DetectedFace) -> AntiSpoofResult:
        ...


class QualityGatePort(Protocol):
    # Quality gate reject frame mờ/tối/góc mặt xấu trước khi search embedding.
    def check(self, image: np.ndarray, face: DetectedFace) -> QualityCheckResult:
        ...


class EmbeddingPort(Protocol):
    # extract lấy ArcFace normed embedding từ DetectedFace.
    def extract(self, face: DetectedFace) -> np.ndarray:
        ...


class VectorSearchPort(Protocol):
    # search_face trả các hit generic; pipeline chịu trách nhiệm validate payload.
    def search_face(
        self,
        embedding: np.ndarray,
        limit: int = 1,
        score_threshold: float | None = None,
    ) -> list[FaceSearchHit]:
        ...


class AttendancePort(Protocol):
    # record_attendance là async vì có thể ghi MySQL.
    async def record_attendance(
        self,
        employee: str | None,
        attendance_type: str,
        similarity_score: float | None,
        now: datetime | None = None,
    ) -> AttendanceDecision:
        ...


@dataclass
class CheckinSessionState:
    # started_at dùng để timeout toàn bộ WebSocket session.
    started_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    # attendance_type được set bởi frame đầu tiên; cùng session không được đổi
    # giữa checkin và checkout vì confidence counters đang tích lũy cho một hành động.
    attendance_type: str | None = None

    # candidate_employee_id là nhân viên đang được match gần nhất.
    candidate_employee_id: str | None = None

    # consecutive_high đếm số frame high-confidence liên tiếp của cùng candidate.
    consecutive_high: int = 0

    # low_vote_counts đếm số frame >= similarity_threshold theo từng employee_id.
    low_vote_counts: dict[str, int] = field(default_factory=dict)

    # completed=True sau khi attendance đã có quyết định cuối; API có thể đóng socket.
    completed: bool = False


class CheckinPipeline:
    """Stateful pipeline for one check-in/check-out WebSocket session.

    Each instance stores per-session state such as selected attendance type,
    current candidate employee, confidence counters, timeout, and completion
    flag. Heavy services are injected from dependencies.py and reused across
    sessions; this class must not instantiate AI models or database pools.
    """

    def __init__(
        self,
        detector: FaceDetectorPort,
        anti_spoofing: AntiSpoofingPort,
        quality_gate: QualityGatePort,
        embedding_service: EmbeddingPort,
        vector_db: VectorSearchPort,
        attendance_service: AttendancePort,
        checkin_config: Mapping[str, Any],
        model_config: Mapping[str, Any],
    ) -> None:
        """Initialize a check-in pipeline with injected shared services.

        Args:
            detector: Shared face detector service.
            anti_spoofing: Shared anti-spoofing service.
            quality_gate: Shared quality gate service.
            embedding_service: Shared embedding extractor.
            vector_db: Shared Qdrant search service.
            attendance_service: Shared attendance business service.
            checkin_config: Injected `checkin` config section.
            model_config: Injected `model` config section.

        Returns:
            None.

        Example:
            `pipeline = CheckinPipeline(..., checkin_config=config["checkin"], model_config=config["model"])`
        """

        self.detector = detector
        self.anti_spoofing = anti_spoofing
        self.quality_gate = quality_gate
        self.embedding_service = embedding_service
        self.vector_db = vector_db
        self.attendance_service = attendance_service

        self.similarity_threshold = float(checkin_config["similarity_threshold"])
        self.high_confidence_threshold = float(checkin_config["high_confidence_threshold"])
        self.required_consecutive_high = int(checkin_config["required_consecutive_high"])
        self.required_low_votes = int(checkin_config["required_low_votes"])
        self.session_timeout_sec = int(checkin_config["session_timeout_sec"])
        self.enforce_liveness = bool(checkin_config.get("enforce_liveness", False))

        self.anti_spoof_decision_mode = str(
            model_config.get("anti_spoof_decision_mode", "advisory")
        ).lower()
        self.state = CheckinSessionState()

    async def handle_frame_payload(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        """Process one raw WebSocket payload and return a JSON-safe response.

        Args:
            payload: Raw dict from `websocket.receive_json()`. Example:
                `{"action": "attendance_frame", "type": "checkin", "image": "data:image/jpeg;base64,/9j/..."}`

        Returns:
            JSON-safe dict ready for `websocket.send_json(...)`. Possible
            statuses include `PROCESSING`, `REJECTED`, `UNKNOWN_FACE`,
            `ATTENDANCE_SUCCESS`, `ALREADY_RECORDED`,
            `CHECKOUT_WITHOUT_CHECKIN`, `EMPLOYEE_INACTIVE`,
            `EMPLOYEE_NOT_FOUND`, and `ERROR`.

        Example:
            `response = await pipeline.handle_frame_payload(raw_payload)`
        """

        try:
            message = parse_attendance_frame_message(payload)
            response = await self.process_frame(message)
            return response.to_websocket_payload()
        except CheckinError as exc:
            return self._error_payload(exc)
        except Exception as exc:
            return self._error_payload(
                checkin_internal_error(
                    "Lỗi nội bộ khi xử lý check-in/check-out",
                    details={"error": str(exc)},
                )
            )

    async def process_frame(
        self,
        message: AttendanceFrameMessage,
    ) -> ProcessingFrameResponse | RejectedFrameResponse | UnknownFaceResponse | AttendanceSessionResponse:
        """Process one validated attendance frame.

        Args:
            message: Validated `AttendanceFrameMessage` from schema layer.

        Returns:
            Pydantic response model. Caller should serialize with
            `to_websocket_payload()`.

        Example:
            `response = await pipeline.process_frame(message)`
        """

        self._ensure_session_can_continue(message)
        image = self._decode_image(message.image)
        face = self._detect_face(image)
        anti_spoof_result = self._check_liveness(image, face)
        quality_result = self._check_quality(image, face)
        embedding = self.embedding_service.extract(face)
        hit = self._search_best_hit(embedding)
        face_bbox = self._bbox_to_payload(face)

        if hit is None or hit.score < self.similarity_threshold:
            self._reset_candidate()
            return UnknownFaceResponse(
                message="Không tìm thấy nhân viên phù hợp",
                face_bbox=face_bbox,
                similarity_score=float(hit.score) if hit is not None else None,
                details=self._frame_details(anti_spoof_result, quality_result, hit),
            )

        employee_id = self._employee_id_from_hit(hit)

        # Confidence accumulation:
        # - High score cùng employee đủ số frame liên tiếp thì confirm.
        # - Low-but-accepted score cùng employee đủ vote thì cũng confirm.
        # - Candidate đổi thì reset high counter cho candidate cũ.
        confirmed = self._accumulate_confidence(employee_id, float(hit.score))
        employee = self._employee_overlay_from_hit(hit)

        if not confirmed:
            return ProcessingFrameResponse(
                message="Đang xác nhận nhân viên",
                face_bbox=face_bbox,
                employee=employee,
                similarity_score=float(hit.score),
                details={
                    **self._frame_details(anti_spoof_result, quality_result, hit),
                    "candidate_employee_id": self.state.candidate_employee_id,
                    "consecutive_high": self.state.consecutive_high,
                    "low_vote_count": self.state.low_vote_counts.get(employee_id, 0),
                    "required_consecutive_high": self.required_consecutive_high,
                    "required_low_votes": self.required_low_votes,
                },
            )

        decision = await self.attendance_service.record_attendance(
            employee_id,
            message.type,
            float(hit.score),
        )
        self.state.completed = True
        return self._attendance_decision_response(decision, employee, face_bbox)

    def _ensure_session_can_continue(self, message: AttendanceFrameMessage) -> None:
        """Validate session state before processing a new frame."""

        if self.state.completed:
            raise checkin_invalid_message("Check-in/check-out session đã hoàn tất")

        elapsed = (datetime.now(timezone.utc) - self.state.started_at).total_seconds()
        if elapsed > self.session_timeout_sec:
            self.state.completed = True
            raise checkin_timeout_error(
                "Check-in/check-out session đã hết thời gian",
                details={
                    "elapsed_sec": elapsed,
                    "session_timeout_sec": self.session_timeout_sec,
                },
            )

        if self.state.attendance_type is None:
            self.state.attendance_type = message.type
            return

        if message.type != self.state.attendance_type:
            raise checkin_invalid_message(
                "Không được đổi loại chấm công trong cùng session",
                details={
                    "expected_type": self.state.attendance_type,
                    "received_type": message.type,
                },
            )

    @staticmethod
    def _decode_image(image_data: str) -> np.ndarray:
        """Decode frontend base64/data URL image into OpenCV BGR array."""

        try:
            return decode_base64_image(image_data)
        except ValueError as exc:
            raise checkin_invalid_image(
                "Ảnh check-in/check-out gửi lên không hợp lệ",
                details={"error": str(exc)},
            ) from exc

    def     _detect_face(self, image: np.ndarray) -> DetectedFace:
        """Detect exactly one acceptable face or raise a structured frame error."""

        detection_result = self.detector.detect_one(image)
        if detection_result.status == "OK" and detection_result.face is not None:
            return detection_result.face

        details: dict[str, Any] = {"face_count": detection_result.face_count}
        if detection_result.face is not None:
            details["det_score"] = detection_result.face.det_score
            details["face_bbox"] = self._bbox_to_payload(detection_result.face)

        raise checkin_frame_error(
            detection_result.status,
            detection_result.message,
            details=details,
        )

    def _check_liveness(self, image: np.ndarray, face: DetectedFace) -> AntiSpoofResult:
        """Run anti-spoofing advisory/strict policy for one detected face."""

        anti_spoof_result = self.anti_spoofing.check_liveness(image, face)

        # Anti-spoofing advisory:
        # The model always runs so frontend/debug tools can inspect live_score.
        # With enforce_liveness=false, low score does not reject the frame.
        # If later enforce_liveness=true, SPOOF_DETECTED becomes a frame reject.
        if anti_spoof_result.status == "OK" or not self.enforce_liveness:
            return anti_spoof_result

        raise checkin_frame_error(
            "INVALID_IMAGE",
            anti_spoof_result.message,
            details={
                "anti_spoof_status": anti_spoof_result.status,
                "live_score": anti_spoof_result.live_score,
                "predicted_label": anti_spoof_result.predicted_label,
                "model_scores": anti_spoof_result.model_scores,
                "crop_boxes": anti_spoof_result.crop_boxes,
                "debug_crop_paths": anti_spoof_result.debug_crop_paths,
                "source_frame_path": anti_spoof_result.source_frame_path,
                "image_shape": anti_spoof_result.image_shape,
                "crop_stats": anti_spoof_result.crop_stats,
                "face_bbox": self._bbox_to_payload(face),
                "enforce_liveness": self.enforce_liveness,
                "anti_spoof_decision_mode": self.anti_spoof_decision_mode,
            },
        )

    def _check_quality(self, image: np.ndarray, face: DetectedFace) -> QualityCheckResult:
        """Run quality checks before extracting/searching embedding."""

        quality_result = self.quality_gate.check(image, face)
        if quality_result.passed:
            return quality_result

        raise checkin_frame_error(
            quality_result.status,
            quality_result.message,
            details={
                "blur_score": quality_result.blur_score,
                "brightness": quality_result.brightness,
                "face_ratio": quality_result.face_ratio,
                "pitch": quality_result.pitch,
                "yaw": quality_result.yaw,
                "face_bbox": self._bbox_to_payload(face),
            },
        )

    def _search_best_hit(self, embedding: np.ndarray) -> FaceSearchHit | None:
        """Search Qdrant and return the best hit if one exists."""

        hits = self.vector_db.search_face(
            embedding,
            limit=1,
            score_threshold=None,
        )
        if not hits:
            return None
        return hits[0]

    def _accumulate_confidence(self, employee_id: str, score: float) -> bool:
        """Update candidate counters and return whether the employee is confirmed."""

        if self.state.candidate_employee_id != employee_id:
            self.state.candidate_employee_id = employee_id
            self.state.consecutive_high = 0

        if score >= self.high_confidence_threshold:
            self.state.consecutive_high += 1
        else:
            self.state.consecutive_high = 0

        self.state.low_vote_counts[employee_id] = self.state.low_vote_counts.get(employee_id, 0) + 1

        return (
            self.state.consecutive_high >= self.required_consecutive_high
            or self.state.low_vote_counts[employee_id] >= self.required_low_votes
        )

    def _reset_candidate(self) -> None:
        """Clear candidate counters after an unknown/low-similarity frame."""

        self.state.candidate_employee_id = None
        self.state.consecutive_high = 0

    @staticmethod
    def _employee_id_from_hit(hit: FaceSearchHit) -> str:
        """Read and validate `employee_id` from Qdrant payload."""

        employee_id = hit.payload.get("employee_id")
        if not isinstance(employee_id, str) or not employee_id.strip():
            raise checkin_internal_error(
                "Payload Qdrant thiếu employee_id",
                details={"point_id": hit.point_id, "payload_keys": sorted(hit.payload.keys())},
            )
        return employee_id.strip()

    @staticmethod
    def _employee_overlay_from_hit(hit: FaceSearchHit) -> CheckinEmployeeOverlay:
        """Build safe overlay employee data from Qdrant payload."""

        employee_id = CheckinPipeline._employee_id_from_hit(hit)
        full_name = hit.payload.get("full_name")
        return CheckinEmployeeOverlay(
            employee_id=employee_id,
            full_name=full_name if isinstance(full_name, str) and full_name.strip() else employee_id,
            department=hit.payload.get("department") if isinstance(hit.payload.get("department"), str) else None,
            position=hit.payload.get("position") if isinstance(hit.payload.get("position"), str) else None,
        )

    @staticmethod
    def _frame_details(
        anti_spoof_result: AntiSpoofResult,
        quality_result: QualityCheckResult,
        hit: FaceSearchHit | None,
    ) -> dict[str, Any]:
        """Collect frame debug details for processing/unknown responses."""

        details: dict[str, Any] = {
            "anti_spoof": {
                "is_live": anti_spoof_result.is_live,
                "live_score": anti_spoof_result.live_score,
                "predicted_label": anti_spoof_result.predicted_label,
                "model_scores": anti_spoof_result.model_scores,
                "crop_boxes": anti_spoof_result.crop_boxes,
                "debug_crop_paths": anti_spoof_result.debug_crop_paths or None,
                "source_frame_path": anti_spoof_result.source_frame_path,
                "image_shape": anti_spoof_result.image_shape,
                "crop_stats": anti_spoof_result.crop_stats,
                "message": anti_spoof_result.message,
            },
            "quality": {
                "blur_score": quality_result.blur_score,
                "brightness": quality_result.brightness,
                "face_ratio": quality_result.face_ratio,
                "pitch": quality_result.pitch,
                "yaw": quality_result.yaw,
            },
        }
        if hit is not None:
            details["search"] = {
                "point_id": hit.point_id,
                "score": hit.score,
                "payload": hit.payload,
            }
        return details

    @staticmethod
    def _bbox_to_payload(face: DetectedFace) -> tuple[float, float, float, float]:
        """Convert numpy bbox to JSON-safe float tuple."""

        x1, y1, x2, y2 = (float(value) for value in face.bbox[:4])
        return x1, y1, x2, y2

    def _attendance_decision_response(
        self,
        decision: AttendanceDecision,
        employee: CheckinEmployeeOverlay,
        face_bbox: tuple[float, float, float, float],
    ) -> AttendanceSessionResponse:
        """Convert AttendanceService decision into WebSocket response schema."""

        status = decision.code if decision.code != "DB_ERROR" else "ERROR"
        response_employee = employee
        if decision.employee_id is not None:
            response_employee = CheckinEmployeeOverlay(
                employee_id=decision.employee_id,
                full_name=decision.full_name or employee.full_name,
                department=employee.department,
                position=employee.position,
            )

        return AttendanceSessionResponse(
            status=status,
            success=decision.success,
            message=decision.message,
            attendance_type=decision.attendance_type,
            employee=response_employee,
            face_bbox=face_bbox,
            check_time=decision.check_time,
            check_date=decision.check_date,
            on_time=decision.on_time,
            attendance_status=decision.punctuality_status,
            similarity_score=decision.similarity_score,
            details={
                "attendance_code": decision.code,
                "completed": self.state.completed,
            },
        )

    @staticmethod
    def _error_payload(error: CheckinError) -> dict[str, Any]:
        """Convert CheckinError payload through response schemas for consistency."""

        payload = error.to_websocket_payload()
        if payload["status"] == "REJECTED":
            return RejectedFrameResponse.model_validate(payload).to_websocket_payload()
        if payload["status"] == "UNKNOWN_FACE":
            return UnknownFaceResponse(
                message=payload["message"],
                details=payload.get("details"),
            ).to_websocket_payload()
        return CheckinErrorResponse.model_validate(payload).to_websocket_payload()
