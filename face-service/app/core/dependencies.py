from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Any

from app.core.config import load_config
from app.core.runtime import RuntimeConfig, resolve_runtime


if TYPE_CHECKING:
    from app.pipeline.enrollment import EnrollmentPipeline
    from app.pipeline.checkin import CheckinPipeline
    from app.services.anti_spoofing import AntiSpoofingService
    from app.services.attendance import AttendanceService
    from app.services.detection import FaceDetector
    from app.services.embedding import EmbeddingService
    from app.services.preprocessing import QualityGateService
    from app.services.vector_db import VectorDBService


@dataclass(frozen=True)
class ServiceContainer:
    # config là dict YAML đã load một lần từ config/config.yaml.
    # Các service bên dưới đều lấy threshold/path/runtime từ dict này.
    config: dict[str, Any]

    # runtime là cấu hình CPU/GPU đã resolve, ví dụ:
    # CPU -> insightface_ctx_id=-1, torch_device="cpu"
    # GPU -> insightface_ctx_id=gpu_id, torch_device="cuda:<gpu_id>"
    runtime: RuntimeConfig

    # detector load InsightFace buffalo_l một lần để dùng lại cho nhiều session.
    detector: FaceDetector

    # anti_spoofing load toàn bộ MiniFASNet weights một lần.
    anti_spoofing: AntiSpoofingService

    # quality_gate không nặng, nhưng vẫn để chung container để pipeline inject đồng nhất.
    quality_gate: QualityGateService

    # embedding_service validate/extract/average embedding; không tự load model.
    embedding_service: EmbeddingService

    # vector_db giữ Qdrant client config. Collection chỉ được ensure khi complete enrollment.
    vector_db: VectorDBService


@lru_cache(maxsize=1)
def get_app_config() -> dict[str, Any]:
    # Load YAML một lần cho process FastAPI. Nếu sửa config khi server đang chạy,
    # cần restart server hoặc gọi reset_dependency_cache() trong test/dev.
    return load_config()


@lru_cache(maxsize=1)
def get_runtime_config() -> RuntimeConfig:
    # Resolve runtime một lần để mọi service thống nhất CPU/GPU.
    # Ví dụ:
    # runtime = get_runtime_config()
    # runtime.torch_device -> "cpu" hoặc "cuda:0"
    config = get_app_config()
    return resolve_runtime(config.get("runtime", {}))


@lru_cache(maxsize=1)
def get_service_container() -> ServiceContainer:
    # Hàm này là nơi duy nhất khởi tạo các service nặng trong backend.
    # Lazy imports nằm trong hàm để import app.core.dependencies không tự load
    # insightface/torch/qdrant trước khi backend thật sự cần dùng.
    from app.services.anti_spoofing import AntiSpoofingService
    from app.services.detection import FaceDetector
    from app.services.embedding import EmbeddingService
    from app.services.preprocessing import QualityGateService
    from app.services.vector_db import VectorDBService

    config = get_app_config()
    runtime = get_runtime_config()

    # Mỗi service chỉ nhận đúng phần config nó cần. Không hardcode threshold/path ở đây.
    detector = FaceDetector(config["model"], runtime)
    anti_spoofing = AntiSpoofingService(config["model"], runtime)
    quality_gate = QualityGateService(config["quality"])
    embedding_service = EmbeddingService(config["qdrant"])
    vector_db = VectorDBService(config["qdrant"])

    return ServiceContainer(
        config=config,
        runtime=runtime,
        detector=detector,
        anti_spoofing=anti_spoofing,
        quality_gate=quality_gate,
        embedding_service=embedding_service,
        vector_db=vector_db,
    )


@lru_cache(maxsize=1)
def get_attendance_service() -> AttendanceService:
    """Return the singleton core-service attendance sync client."""

    from app.services.attendance import AttendanceService

    config = get_app_config()
    return AttendanceService(
        attendance_config=config["attendance"],
        core_service_config=config["core_service"],
    )


def create_enrollment_pipeline() -> EnrollmentPipeline:
    # Mỗi WebSocket connection cần một EnrollmentPipeline mới vì pipeline giữ
    # session state: accepted_count, good_embeddings, employee_metadata...
    #
    # Nhưng các model service bên trong pipeline là singleton từ ServiceContainer,
    # nên không bị load lại theo từng connection/frame.
    # Ví dụ trong API:
    # pipeline = create_enrollment_pipeline()
    # response = pipeline.handle_capture_payload(raw_payload)
    from app.pipeline.enrollment import EnrollmentPipeline

    services = get_service_container()
    return EnrollmentPipeline(
        detector=services.detector,
        anti_spoofing=services.anti_spoofing,
        quality_gate=services.quality_gate,
        embedding_service=services.embedding_service,
        vector_db=services.vector_db,
        enrollment_config=services.config["enrollment"],
        model_config=services.config["model"],
    )


def create_checkin_pipeline() -> CheckinPipeline:
    """Create one check-in/check-out pipeline for a WebSocket connection.

    Args:
        None.

    Returns:
        `CheckinPipeline` with shared AI/vector/database services injected.

    Example:
        `pipeline = create_checkin_pipeline()`
    """

    # Mỗi WebSocket connection cần một CheckinPipeline mới vì pipeline giữ state
    # như candidate_employee_id, consecutive_high, low_vote_counts và timeout.
    #
    # Các service nặng như detector, anti_spoofing, embedding và vector_db vẫn
    # dùng singleton từ ServiceContainer để không load model lại theo connection
    # hoặc theo từng frame.
    from app.pipeline.checkin import CheckinPipeline

    services = get_service_container()
    return CheckinPipeline(
        detector=services.detector,
        anti_spoofing=services.anti_spoofing,
        quality_gate=services.quality_gate,
        embedding_service=services.embedding_service,
        vector_db=services.vector_db,
        attendance_service=get_attendance_service(),
        checkin_config=services.config["checkin"],
        model_config=services.config["model"],
    )


def reset_dependency_cache() -> None:
    # Helper cho test/dev: xóa cache để lần gọi sau load lại config/service.
    # Không nên gọi trong request bình thường vì sẽ unload/load lại model rất tốn.
    get_attendance_service.cache_clear()
    get_service_container.cache_clear()
    get_runtime_config.cache_clear()
    get_app_config.cache_clear()
