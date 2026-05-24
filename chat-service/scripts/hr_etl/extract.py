from __future__ import annotations

from typing import Any


def extract_frames() -> dict[str, list[dict[str, Any]]]:
    """Load source datasets from MySQL."""
    from db import run_auth_select, run_core_select

    staffs_res = run_auth_select(
        """
        SELECT
            staff_id AS id,
            staff_id AS employee_code,
            name AS full_name,
            department,
            position,
            onboard_date,
            status,
            bank_account AS bank_account_number,
            identity_card AS citizen_id,
            dob AS date_of_birth,
            password AS password_hash,
            role,
            has_face
        FROM staffs
        ORDER BY employee_code ASC
        """
    )
    attendance_res = run_core_select(
        """
        SELECT
            staff_id,
            CASE
                WHEN type = 'CHECK_IN' THEN 'checkin'
                WHEN type = 'CHECK_OUT' THEN 'checkout'
                ELSE LOWER(type)
            END AS attendance_type,
            timestamp AS attendance_time,
            date AS attendance_date,
            on_time
        FROM attendances
        ORDER BY staff_id ASC, attendance_date ASC, attendance_time ASC
        """
    )
    return {"staffs": staffs_res["rows"], "attendances": attendance_res["rows"]}
