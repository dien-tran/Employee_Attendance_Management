from datetime import date, datetime
from pathlib import Path
import hashlib
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.hr_etl import (  # noqa: E402
    UnifiedHRConfig,
    filter_payload_by_topic,
    to_markdown,
    transform,
)


def test_transform_and_single_table_output():
    dob_active = date(1995, 1, 1)
    default_hash = hashlib.sha256(dob_active.isoformat().encode("utf-8")).hexdigest()
    frames = {
        "staffs": [
            {
                "id": 1,
                "employee_code": "EMP001",
                "full_name": "A",
                "department": "IT",
                "position": "Staff",
                "onboard_date": date(2026, 5, 2),
                "status": "Active",
                "bank_account_number": "111",
                "citizen_id": "",
                "date_of_birth": dob_active,
                "password_hash": default_hash,
            },
            {
                "id": 2,
                "employee_code": "EMP002",
                "full_name": "B",
                "department": "HR",
                "position": "Manager",
                "onboard_date": date(2026, 4, 1),
                "status": "Inactive",
                "bank_account_number": None,
                "citizen_id": "123",
                "date_of_birth": date(1990, 6, 1),
                "password_hash": "x",
            },
        ],
        "attendances": [
            {
                "staff_id": 1,
                "attendance_type": "Checkin",
                "attendance_time": datetime(2026, 5, 16, 8, 40),
                "attendance_date": date(2026, 5, 16),
            },
            {
                "staff_id": 1,
                "attendance_type": "Checkout",
                "attendance_time": datetime(2026, 5, 16, 17, 50),
                "attendance_date": date(2026, 5, 16),
            },
            {
                "staff_id": 1,
                "attendance_type": "Checkin",
                "attendance_time": datetime(2026, 5, 15, 8, 20),
                "attendance_date": date(2026, 5, 15),
            },
            {
                "staff_id": 2,
                "attendance_type": "Checkin",
                "attendance_time": datetime(2026, 5, 15, 8, 50),
                "attendance_date": date(2026, 5, 15),
            },
            {
                "staff_id": 2,
                "attendance_type": "Checkin",
                "attendance_time": datetime(2026, 3, 30, 8, 20),
                "attendance_date": date(2026, 3, 30),
            },
        ],
    }

    cfg = UnifiedHRConfig(output_path=Path("tmp.md"), as_of_date=date(2026, 5, 16))
    payload = transform(frames, cfg)

    assert payload["scenario_slug"] == "hr_scenario_pack_single_table"
    assert len(payload["qa_rows"]) == 21
    assert sum(1 for row in payload["qa_rows"] if row.get("topic") == "staff") == 11
    assert sum(1 for row in payload["qa_rows"] if row.get("topic") == "attendance") == 10
    assert payload["qa_rows"][0]["answer"] == "1"

    md = to_markdown(payload)
    assert "| level | group | question | answer | details |" in md
    assert "## Mức" not in md

    staff_payload = filter_payload_by_topic(payload, "staff")
    attendance_payload = filter_payload_by_topic(payload, "attendance")
    assert len(staff_payload["qa_rows"]) == 11
    assert len(attendance_payload["qa_rows"]) == 10
