import os
from pathlib import Path
from typing import Any

import yaml


# app/core/config.py nằm trong app/core, nên parents[2] trỏ về root Face_Services.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG_PATH = PROJECT_ROOT / "config" / "config.yaml"


def load_config(config_path: str | Path = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    """Load YAML config once per caller and return it as a plain dict."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")

    # YAML giữ toàn bộ threshold/model/runtime ở ngoài code để không hardcode.
    with path.open("r", encoding="utf-8") as file:
        config = yaml.safe_load(file) or {}

    if not isinstance(config, dict):
        raise ValueError("Config root must be a YAML mapping")

    # Docker Compose cần backend gọi Qdrant bằng host service name "qdrant",
    # còn chạy local trên máy dev vẫn dùng "localhost". Env override giúp cùng
    # một config.yaml chạy được cả local lẫn container mà không phải copy file.
    _apply_env_overrides(config)
    return config


def _apply_env_overrides(config: dict[str, Any]) -> None:
    # Ví dụ docker-compose.yml set QDRANT_HOST=qdrant, RUNTIME_DEVICE=cpu.
    # Nếu env không tồn tại thì giữ nguyên giá trị trong config/config.yaml.
    _set_env(config, "qdrant", "host", "QDRANT_HOST")
    _set_env(config, "qdrant", "port", "QDRANT_PORT", int)
    _set_env(config, "qdrant", "collection_name", "QDRANT_COLLECTION_NAME")
    _set_env(config, "qdrant", "embedding_dim", "QDRANT_EMBEDDING_DIM", int)

    # Check-in/attendance env overrides let Docker or deployment-specific
    # settings tune thresholds and working hours without editing config.yaml.
    # Example: CHECKIN_SIMILARITY_THRESHOLD=0.6 or ATTENDANCE_TIMEZONE=Asia/Ho_Chi_Minh.
    _set_env(config, "checkin", "similarity_threshold", "CHECKIN_SIMILARITY_THRESHOLD", float)
    _set_env(config, "checkin", "high_confidence_threshold", "CHECKIN_HIGH_CONFIDENCE_THRESHOLD", float)
    _set_env(config, "checkin", "required_consecutive_high", "CHECKIN_REQUIRED_CONSECUTIVE_HIGH", int)
    _set_env(config, "checkin", "required_low_votes", "CHECKIN_REQUIRED_LOW_VOTES", int)
    _set_env(config, "checkin", "session_timeout_sec", "CHECKIN_SESSION_TIMEOUT_SEC", int)
    _set_env(config, "checkin", "frame_interval_ms", "CHECKIN_FRAME_INTERVAL_MS", int)
    _set_env(config, "checkin", "enforce_liveness", "CHECKIN_ENFORCE_LIVENESS", _parse_bool)

    _set_env(config, "attendance", "checkin_deadline", "ATTENDANCE_CHECKIN_DEADLINE")
    _set_env(config, "attendance", "checkout_start", "ATTENDANCE_CHECKOUT_START")
    _set_env(config, "attendance", "timezone", "ATTENDANCE_TIMEZONE")
    _set_env(
        config,
        "attendance",
        "require_checkin_before_checkout",
        "ATTENDANCE_REQUIRE_CHECKIN_BEFORE_CHECKOUT",
        _parse_bool,
    )

    _set_env(config, "core_service", "attendance_sync_url", "CORE_ATTENDANCE_SYNC_URL")
    _set_env(config, "core_service", "internal_jwt_signed_key", "INTERNAL_JWT_SIGNED_KEY")
    _set_env(config, "core_service", "internal_jwt_issuer", "INTERNAL_JWT_ISSUER")
    _set_env(config, "core_service", "internal_jwt_audience", "INTERNAL_JWT_AUDIENCE")
    _set_env(config, "core_service", "internal_jwt_scope", "INTERNAL_JWT_REQUIRED_SCOPE")
    _set_env(config, "core_service", "request_timeout_sec", "CORE_ATTENDANCE_SYNC_TIMEOUT_SEC", int)

    _set_env(config, "auth_service", "staff_lookup_url", "AUTH_STAFF_LOOKUP_URL")
    _set_env(config, "auth_service", "face_status_url", "AUTH_FACE_STATUS_URL")
    _set_env(config, "auth_service", "internal_jwt_signed_key", "INTERNAL_JWT_SIGNED_KEY")
    _set_env(config, "auth_service", "internal_jwt_issuer", "INTERNAL_JWT_ISSUER")
    _set_env(config, "auth_service", "internal_jwt_audience", "INTERNAL_JWT_AUTH_AUDIENCE")
    _set_env(config, "auth_service", "internal_jwt_scope", "INTERNAL_JWT_FACE_STATUS_SCOPE")
    _set_env(config, "auth_service", "request_timeout_sec", "AUTH_FACE_STATUS_TIMEOUT_SEC", int)

    _set_env(config, "runtime", "device", "RUNTIME_DEVICE")
    _set_env(config, "runtime", "gpu_id", "RUNTIME_GPU_ID", int)

    _set_env(config, "model", "insightface_root", "INSIGHTFACE_ROOT")
    _set_env(config, "model", "anti_spoof_model_dir", "ANTI_SPOOF_MODEL_DIR")
    _set_env(config, "model", "anti_spoof_decision_mode", "ANTI_SPOOF_DECISION_MODE")
    _set_env(config, "model", "anti_spoof_color_space", "ANTI_SPOOF_COLOR_SPACE")
    _set_env(config, "model", "anti_spoof_debug_save_crops", "ANTI_SPOOF_DEBUG_SAVE_CROPS", _parse_bool)
    _set_env(config, "model", "anti_spoof_debug_dir", "ANTI_SPOOF_DEBUG_DIR")


def _set_env(
    config: dict[str, Any],
    section: str,
    key: str,
    env_name: str,
    cast: type | None = None,
) -> None:
    value = os.getenv(env_name)
    if value is None:
        return

    section_config = config.setdefault(section, {})
    if not isinstance(section_config, dict):
        raise ValueError(f"Config section {section!r} must be a mapping")

    section_config[key] = cast(value) if cast is not None else value


def _parse_bool(value: str) -> bool:
    # Env trong Docker luôn là string. Các giá trị này giúp compose dùng
    # ANTI_SPOOF_DEBUG_SAVE_CROPS=true/false rõ ràng thay vì hardcode trong YAML.
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"Invalid boolean env value: {value!r}")
