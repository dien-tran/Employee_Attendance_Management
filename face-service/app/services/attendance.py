"""Attendance sync client for face check-in and checkout.

Face-service owns recognition and attendance timing decisions. The canonical
attendance rows live in core-service, so this module calls the internal M2M API
instead of writing MySQL directly.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import time as time_module
from dataclasses import dataclass
from datetime import date, datetime, time
from typing import Any, Literal, Mapping
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4
from zoneinfo import ZoneInfo


AttendanceType = Literal["checkin", "checkout"]
AttendanceDecisionCode = Literal[
    "ATTENDANCE_SUCCESS",
    "ALREADY_RECORDED",
    "CHECKOUT_WITHOUT_CHECKIN",
    "EMPLOYEE_INACTIVE",
    "EMPLOYEE_NOT_FOUND",
    "DB_ERROR",
]
PunctualityStatus = Literal["on_time", "late", "early", "unknown"]


@dataclass(frozen=True)
class AttendanceRecord:
    """Canonical attendance row returned by core-service."""

    staff_id: str
    type: str
    timestamp: datetime
    date: date
    on_time: bool
    id: str | None = None


@dataclass(frozen=True)
class AttendanceDecision:
    """Structured result returned to the check-in pipeline."""

    code: AttendanceDecisionCode
    success: bool
    message: str
    employee_id: str | None = None
    full_name: str | None = None
    attendance_type: AttendanceType | None = None
    check_time: datetime | None = None
    check_date: date | None = None
    on_time: bool | None = None
    punctuality_status: PunctualityStatus = "unknown"
    similarity_score: float | None = None
    attendance: AttendanceRecord | None = None


def resolve_local_now(timezone_name: str) -> datetime:
    """Return the current aware datetime in the configured timezone."""

    return datetime.now(ZoneInfo(timezone_name))


def get_check_date(now: datetime) -> date:
    """Extract the attendance date from a local datetime."""

    return now.date()


def parse_hhmm(value: str) -> time:
    """Parse an `HH:MM` config value into a `datetime.time`."""

    hour_text, minute_text = value.split(":", maxsplit=1)
    hour = int(hour_text)
    minute = int(minute_text)
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError(f"Invalid HH:MM time value: {value!r}")
    return time(hour=hour, minute=minute)


class AttendanceService:
    """Apply attendance timing rules and sync accepted records to core-service."""

    def __init__(
        self,
        attendance_config: Mapping[str, Any],
        core_service_config: Mapping[str, Any],
    ) -> None:
        self.timezone_name = str(attendance_config.get("timezone", "Asia/Ho_Chi_Minh"))
        self.checkin_deadline = parse_hhmm(str(attendance_config.get("checkin_deadline", "08:00")))
        self.checkout_start = parse_hhmm(str(attendance_config.get("checkout_start", "16:30")))
        self.sync_url = str(core_service_config["attendance_sync_url"])
        self.internal_jwt_signed_key = str(core_service_config.get("internal_jwt_signed_key", ""))
        self.internal_jwt_issuer = str(core_service_config.get("internal_jwt_issuer", "ai-service"))
        self.internal_jwt_audience = str(core_service_config.get("internal_jwt_audience", "core-service"))
        self.internal_jwt_scope = str(core_service_config.get("internal_jwt_scope", "attendance:sync"))
        self.request_timeout_sec = int(core_service_config.get("request_timeout_sec", 5))

    async def record_attendance(
        self,
        employee: str | None,
        attendance_type: AttendanceType,
        similarity_score: float | None,
        now: datetime | None = None,
    ) -> AttendanceDecision:
        """Sync a confirmed check-in or checkout decision to core-service."""

        if attendance_type not in {"checkin", "checkout"}:
            raise ValueError("attendance_type must be 'checkin' or 'checkout'")

        check_time = self._normalize_now(now)
        check_date = get_check_date(check_time)
        employee_id = employee.strip() if isinstance(employee, str) else None

        if not employee_id:
            return AttendanceDecision(
                code="EMPLOYEE_NOT_FOUND",
                success=False,
                message="Employee was not found for attendance recording.",
                employee_id=employee_id,
                attendance_type=attendance_type,
                check_time=check_time,
                check_date=check_date,
                similarity_score=similarity_score,
            )

        on_time, punctuality_status = self._calculate_punctuality(attendance_type, check_time)
        request_payload = {
            "staffId": employee_id,
            "type": _to_core_attendance_type(attendance_type),
            "timestamp": _to_core_local_datetime(check_time),
            "date": check_date.isoformat(),
            "onTime": on_time,
        }

        try:
            response = await asyncio.to_thread(self._post_sync_request, request_payload)
        except CoreAttendanceError as exc:
            return self._error_decision(
                exc,
                employee_id,
                attendance_type,
                check_time,
                check_date,
                similarity_score,
            )
        except Exception as exc:
            return AttendanceDecision(
                code="DB_ERROR",
                success=False,
                message=f"Core attendance sync failed: {exc}",
                employee_id=employee_id,
                attendance_type=attendance_type,
                check_time=check_time,
                check_date=check_date,
                similarity_score=similarity_score,
            )

        attendance = _attendance_record_from_core(response.get("result"))
        return AttendanceDecision(
            code="ATTENDANCE_SUCCESS",
            success=True,
            message="Attendance recorded successfully.",
            employee_id=employee_id,
            attendance_type=attendance_type,
            check_time=check_time,
            check_date=check_date,
            on_time=on_time,
            punctuality_status=punctuality_status,
            similarity_score=similarity_score,
            attendance=attendance,
        )

    def _post_sync_request(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        token = self._create_internal_jwt()
        request = Request(
            self.sync_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Token": f"Bearer {token}",
            },
            method="POST",
        )

        try:
            with urlopen(request, timeout=self.request_timeout_sec) as response:
                body = response.read().decode("utf-8")
                return json.loads(body) if body else {}
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise CoreAttendanceError.from_http_error(exc.code, body) from exc
        except URLError as exc:
            raise CoreAttendanceError("DB_ERROR", f"Core attendance API is unavailable: {exc}") from exc

    def _create_internal_jwt(self) -> str:
        if not self.internal_jwt_signed_key:
            raise CoreAttendanceError("DB_ERROR", "Internal JWT signed key is not configured")

        now = int(time_module.time())
        header = {"alg": "HS512", "typ": "JWT"}
        claims = {
            "iss": self.internal_jwt_issuer,
            "aud": self.internal_jwt_audience,
            "scope": self.internal_jwt_scope,
            "iat": now,
            "exp": now + 900,
            "jti": str(uuid4()),
        }
        signing_input = ".".join(
            [
                _base64url_json(header),
                _base64url_json(claims),
            ]
        )
        signature = hmac.new(
            self.internal_jwt_signed_key.encode("utf-8"),
            signing_input.encode("ascii"),
            hashlib.sha512,
        ).digest()
        return f"{signing_input}.{_base64url_bytes(signature)}"

    def _normalize_now(self, now: datetime | None) -> datetime:
        if now is None:
            return resolve_local_now(self.timezone_name)

        timezone = ZoneInfo(self.timezone_name)
        if now.tzinfo is None:
            return now.replace(tzinfo=timezone)
        return now.astimezone(timezone)

    def _calculate_punctuality(
        self,
        attendance_type: AttendanceType,
        check_time: datetime,
    ) -> tuple[bool, PunctualityStatus]:
        local_time = check_time.time().replace(tzinfo=None)
        if attendance_type == "checkin":
            if local_time > self.checkin_deadline:
                return False, "late"
            return True, "on_time"

        if local_time < self.checkout_start:
            return False, "early"
        return True, "on_time"

    @staticmethod
    def _error_decision(
        error: "CoreAttendanceError",
        employee_id: str,
        attendance_type: AttendanceType,
        check_time: datetime,
        check_date: date,
        similarity_score: float | None,
    ) -> AttendanceDecision:
        code = error.code
        if code not in {"ALREADY_RECORDED", "CHECKOUT_WITHOUT_CHECKIN", "EMPLOYEE_INACTIVE", "EMPLOYEE_NOT_FOUND"}:
            code = "DB_ERROR"

        return AttendanceDecision(
            code=code,
            success=False,
            message=error.message,
            employee_id=employee_id,
            attendance_type=attendance_type,
            check_time=check_time,
            check_date=check_date,
            similarity_score=similarity_score,
        )


class CoreAttendanceError(Exception):
    """Core-service error mapped into face-service attendance decisions."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    @classmethod
    def from_http_error(cls, status_code: int, body: str) -> "CoreAttendanceError":
        try:
            payload = json.loads(body) if body else {}
        except json.JSONDecodeError:
            payload = {}

        message = str(payload.get("message") or f"Core attendance API returned {status_code}")
        return cls(message, message)


def _to_core_attendance_type(attendance_type: AttendanceType) -> str:
    return "CHECK_IN" if attendance_type == "checkin" else "CHECK_OUT"


def _to_core_local_datetime(value: datetime) -> str:
    return value.replace(tzinfo=None).isoformat(timespec="seconds")


def _attendance_record_from_core(value: Any) -> AttendanceRecord | None:
    if not isinstance(value, Mapping):
        return None

    try:
        return AttendanceRecord(
            id=str(value["id"]) if value.get("id") is not None else None,
            staff_id=str(value["staffId"]),
            type=str(value["type"]),
            timestamp=datetime.fromisoformat(str(value["timestamp"])),
            date=date.fromisoformat(str(value["date"])),
            on_time=bool(value["onTime"]),
        )
    except (KeyError, TypeError, ValueError):
        return None


def _base64url_json(value: Mapping[str, Any]) -> str:
    data = json.dumps(value, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return _base64url_bytes(data)


def _base64url_bytes(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")
