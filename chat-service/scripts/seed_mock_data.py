from __future__ import annotations

import hashlib
import os
import random
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import mysql.connector
from dotenv import load_dotenv
from faker import Faker


STAFF_TARGET = 100
ATTENDANCE_TARGET = 5000
REPORT_PATH = Path("MOCK_DATA_REPORT.md")

DEPARTMENTS = [
    "IT",
    "HR",
    "Finance",
    "Marketing",
    "Sales",
    "Operations",
    "Admin",
]

POSITIONS = [
    "Intern",
    "Staff",
    "Senior Staff",
    "Team Lead",
    "Manager",
]

BANKS = [
    "Vietcombank",
    "Techcombank",
    "BIDV",
    "VietinBank",
    "ACB",
    "MB Bank",
]


@dataclass
class SeedSummary:
    inserted_staff: int
    inserted_attendance: int
    total_staff: int
    total_attendance: int
    active_staff: int
    inactive_staff: int
    top_departments: list[tuple[str, int]]
    attendance_type_counts: list[tuple[str, int]]


def _auth_db_config() -> dict[str, Any]:
    return {
        "host": os.getenv("AUTH_DB_HOST", "localhost"),
        "port": int(os.getenv("AUTH_DB_PORT", "3306")),
        "user": os.getenv("AUTH_DB_USER", os.getenv("AUTH_DB_USERNAME", "auth_user")),
        "password": os.getenv("AUTH_DB_PASSWORD", ""),
        "database": os.getenv("AUTH_DB_NAME", "auth_db"),
    }


def _core_db_config() -> dict[str, Any]:
    return {
        "host": os.getenv("CORE_DB_HOST", "localhost"),
        "port": int(os.getenv("CORE_DB_PORT", "3306")),
        "user": os.getenv("CORE_DB_USER", os.getenv("CORE_DB_USERNAME", "core_user")),
        "password": os.getenv("CORE_DB_PASSWORD", ""),
        "database": os.getenv("CORE_DB_NAME", "core_db"),
    }


def _get_connection(config: dict[str, Any]):
    return mysql.connector.connect(**config)


def _scalar(cursor, sql: str, params: tuple[Any, ...] | None = None) -> Any:
    cursor.execute(sql, params or ())
    row = cursor.fetchone()
    return row[0] if row else None


def _build_staff_rows(fake: Faker, count: int, existing_staff_count: int) -> list[tuple[Any, ...]]:
    rows: list[tuple[Any, ...]] = []
    base_index = existing_staff_count + 1

    for i in range(count):
        idx = base_index + i
        dob = fake.date_of_birth(minimum_age=22, maximum_age=45)
        dob_text = dob.strftime("%Y-%m-%d")
        password_hash = hashlib.sha256(dob_text.encode("utf-8")).hexdigest()

        staff_id = f"NV{idx:06d}"
        name = fake.name()
        department = random.choice(DEPARTMENTS)
        position = random.choice(POSITIONS)
        onboard_date = fake.date_between(start_date="-5y", end_date="today")
        status = random.choices(["ACTIVE", "INACTIVE"], weights=[85, 15], k=1)[0]
        phone = fake.msisdn()[:10]
        email = f"{fake.user_name()}.{idx}@example.com"
        identity_card = f"{random.randint(10**11, (10**12)-1)}"
        bank_account = f"{random.randint(10**11, (10**12)-1)}"
        bank_name = random.choice(BANKS)
        role = random.choices(["USER", "ADMIN"], weights=[97, 3], k=1)[0]
        has_face = random.choices([True, False], weights=[35, 65], k=1)[0]

        rows.append(
            (
                uuid.uuid4().bytes,
                staff_id,
                name,
                department,
                position,
                onboard_date,
                status,
                phone,
                email,
                identity_card,
                bank_account,
                bank_name,
                dob,
                password_hash,
                role,
                has_face,
            )
        )
    return rows


def _build_attendance_rows(fake: Faker, staff_ids: list[str], count: int) -> list[tuple[Any, ...]]:
    rows: list[tuple[Any, ...]] = []
    for _ in range(count):
        staff_id = random.choice(staff_ids)
        attendance_date = fake.date_between(start_date="-180d", end_date="today")
        attendance_type = random.choice(["CHECK_IN", "CHECK_OUT"])

        if attendance_type == "CHECK_IN":
            hour = random.randint(7, 10)
            minute = random.randint(0, 59)
        else:
            hour = random.randint(16, 21)
            minute = random.randint(0, 59)

        attendance_time = datetime.combine(attendance_date, datetime.min.time()) + timedelta(
            hours=hour,
            minutes=minute,
            seconds=random.randint(0, 59),
        )
        on_time = attendance_type != "CHECK_IN" or attendance_time.time() <= datetime.strptime(
            "08:30:00", "%H:%M:%S"
        ).time()

        rows.append(
            (
                uuid.uuid4().bytes,
                staff_id,
                attendance_type,
                attendance_time,
                attendance_date,
                on_time,
            )
        )

    return rows


def _write_report(summary: SeedSummary) -> None:
    content = f"""# Mock Data Report

Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Seed Summary
- Inserted staffs: **{summary.inserted_staff}**
- Inserted attendance events: **{summary.inserted_attendance}**

## Current Totals In Database
- Total staffs: **{summary.total_staff}**
- Active staffs: **{summary.active_staff}**
- Inactive staffs: **{summary.inactive_staff}**
- Total attendance events: **{summary.total_attendance}**

## Top Departments By Staff Count
"""
    for dept, cnt in summary.top_departments:
        content += f"- {dept}: **{cnt}**\n"

    content += "\n## Attendance Type Distribution\n"
    for attendance_type, cnt in summary.attendance_type_counts:
        content += f"- {attendance_type}: **{cnt}**\n"

    REPORT_PATH.write_text(content, encoding="utf-8")


def seed_mock_data(*, staff_target: int = STAFF_TARGET, attendance_target: int = ATTENDANCE_TARGET) -> SeedSummary:
    random.seed(42)
    fake = Faker("vi_VN")
    Faker.seed(42)

    auth_conn = _get_connection(_auth_db_config())
    core_conn = _get_connection(_core_db_config())
    auth_cursor = auth_conn.cursor()
    core_cursor = core_conn.cursor()

    try:
        existing_staff_count = int(_scalar(auth_cursor, "SELECT COUNT(*) FROM staffs") or 0)
        staff_rows = _build_staff_rows(fake, staff_target, existing_staff_count)

        staff_insert_sql = """
            INSERT INTO staffs (
                id, staff_id, name, department, position, onboard_date, status, phone,
                email, identity_card, bank_account, bank_name, dob, password, role, has_face
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        auth_cursor.executemany(staff_insert_sql, staff_rows)
        auth_conn.commit()

        auth_cursor.execute("SELECT staff_id FROM staffs ORDER BY staff_id DESC LIMIT %s", (staff_target,))
        inserted_staff_ids = [str(row[0]) for row in auth_cursor.fetchall()]

        attendance_rows = _build_attendance_rows(fake, inserted_staff_ids, attendance_target)
        attendance_insert_sql = """
            INSERT INTO attendances (
                id, staff_id, type, timestamp, date, on_time
            ) VALUES (%s, %s, %s, %s, %s, %s)
        """
        core_cursor.executemany(attendance_insert_sql, attendance_rows)
        core_conn.commit()

        total_staff = int(_scalar(auth_cursor, "SELECT COUNT(*) FROM staffs") or 0)
        total_attendance = int(_scalar(core_cursor, "SELECT COUNT(*) FROM attendances") or 0)

        auth_cursor.execute("SELECT status, COUNT(*) FROM staffs GROUP BY status")
        status_counts = dict(auth_cursor.fetchall())

        auth_cursor.execute(
            """
            SELECT department, COUNT(*) AS c
            FROM staffs
            GROUP BY department
            ORDER BY c DESC
            LIMIT 5
            """
        )
        top_departments = [(str(dept), int(cnt)) for dept, cnt in auth_cursor.fetchall()]

        core_cursor.execute(
            """
            SELECT type, COUNT(*) AS c
            FROM attendances
            GROUP BY type
            ORDER BY c DESC
            """
        )
        attendance_type_counts = [(str(atype), int(cnt)) for atype, cnt in core_cursor.fetchall()]

        summary = SeedSummary(
            inserted_staff=staff_target,
            inserted_attendance=attendance_target,
            total_staff=total_staff,
            total_attendance=total_attendance,
            active_staff=int(status_counts.get("ACTIVE", 0)),
            inactive_staff=int(status_counts.get("INACTIVE", 0)),
            top_departments=top_departments,
            attendance_type_counts=attendance_type_counts,
        )
        _write_report(summary)
        return summary
    finally:
        auth_cursor.close()
        core_cursor.close()
        auth_conn.close()
        core_conn.close()


def seed_if_first_run() -> SeedSummary | None:
    core_conn = _get_connection(_core_db_config())
    core_cursor = core_conn.cursor()
    try:
        existing_attendance = int(_scalar(core_cursor, "SELECT COUNT(*) FROM attendances") or 0)
    finally:
        core_cursor.close()
        core_conn.close()

    if existing_attendance > 0:
        return None

    return seed_mock_data()


def main() -> None:
    load_dotenv()
    summary = seed_if_first_run()
    if summary is None:
        print("Seed skipped: attendances table already has data.")
        return
    print("Seeding completed successfully.")
    print(f"Inserted staffs: {summary.inserted_staff}")
    print(f"Inserted attendances: {summary.inserted_attendance}")
    print(f"Report written to: {REPORT_PATH}")


if __name__ == "__main__":
    main()
