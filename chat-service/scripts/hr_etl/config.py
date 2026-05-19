from __future__ import annotations

from dataclasses import dataclass
from datetime import date, time
from pathlib import Path

CHECKIN_LATE_THRESHOLD = time(8, 30)
WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
DEFAULT_STAFF_SUMMARY_PATH = "scripts/wiki_exports/attendance_analytics/staff_summary.md"
DEFAULT_ATTENDANCE_SUMMARY_PATH = "scripts/wiki_exports/attendance_analytics/attendance_summary.md"


@dataclass
class UnifiedHRConfig:
    output_path: Path = Path(DEFAULT_ATTENDANCE_SUMMARY_PATH)
    staff_output_path: Path = Path(DEFAULT_STAFF_SUMMARY_PATH)
    attendance_output_path: Path = Path(DEFAULT_ATTENDANCE_SUMMARY_PATH)
    as_of_date: date | None = None
    checkin_late_threshold: time = CHECKIN_LATE_THRESHOLD
    include_saturday: bool = True
