from __future__ import annotations

import unittest
from datetime import datetime

from app.services.attendance import AttendanceService, CoreAttendanceError


ATTENDANCE_CONFIG = {
    "checkin_deadline": "08:00",
    "checkout_start": "16:30",
    "timezone": "Asia/Ho_Chi_Minh",
}

CORE_CONFIG = {
    "attendance_sync_url": "http://core-service:8082/api/internal/attendance/sync",
    "internal_jwt_signed_key": "test-internal-signing-key-for-hs512-must-be-at-least-64-bytes-long",
    "internal_jwt_issuer": "ai-service",
    "internal_jwt_audience": "core-service",
    "internal_jwt_scope": "attendance:sync",
    "request_timeout_sec": 5,
}


class FakeAttendanceService(AttendanceService):
    def __init__(self, response=None, error=None):
        super().__init__(ATTENDANCE_CONFIG, CORE_CONFIG)
        self.response = response or {
            "result": {
                "id": "a7f0d7d0-d9fd-4c4a-8239-bf1435a448f5",
                "staffId": "NV000001",
                "type": "CHECK_IN",
                "timestamp": "2026-05-17T07:59:00",
                "date": "2026-05-17",
                "onTime": True,
            }
        }
        self.error = error
        self.last_payload = None

    def _post_sync_request(self, payload):
        self.last_payload = dict(payload)
        if self.error is not None:
            raise self.error
        return self.response


class AttendanceServiceTest(unittest.IsolatedAsyncioTestCase):
    async def test_sync_success_maps_payload_for_core(self):
        service = FakeAttendanceService()

        decision = await service.record_attendance(
            "NV000001",
            "checkin",
            0.88,
            now=datetime(2026, 5, 17, 7, 59, 0),
        )

        self.assertTrue(decision.success)
        self.assertEqual(decision.code, "ATTENDANCE_SUCCESS")
        self.assertEqual(decision.punctuality_status, "on_time")
        self.assertEqual(
            service.last_payload,
            {
                "staffId": "NV000001",
                "type": "CHECK_IN",
                "timestamp": "2026-05-17T07:59:00",
                "date": "2026-05-17",
                "onTime": True,
            },
        )

    async def test_duplicate_core_error_maps_to_attendance_decision(self):
        service = FakeAttendanceService(error=CoreAttendanceError("ALREADY_RECORDED", "ALREADY_RECORDED"))

        decision = await service.record_attendance(
            "NV000001",
            "checkin",
            0.88,
            now=datetime(2026, 5, 17, 8, 5, 0),
        )

        self.assertFalse(decision.success)
        self.assertEqual(decision.code, "ALREADY_RECORDED")

    async def test_checkout_without_checkin_maps_to_attendance_decision(self):
        service = FakeAttendanceService(
            error=CoreAttendanceError("CHECKOUT_WITHOUT_CHECKIN", "CHECKOUT_WITHOUT_CHECKIN")
        )

        decision = await service.record_attendance(
            "NV000001",
            "checkout",
            0.88,
            now=datetime(2026, 5, 17, 17, 30, 0),
        )

        self.assertFalse(decision.success)
        self.assertEqual(decision.code, "CHECKOUT_WITHOUT_CHECKIN")

    def test_internal_jwt_is_hs512_token(self):
        service = AttendanceService(ATTENDANCE_CONFIG, CORE_CONFIG)

        token = service._create_internal_jwt()

        self.assertEqual(len(token.split(".")), 3)


if __name__ == "__main__":
    unittest.main()
