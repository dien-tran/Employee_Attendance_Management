from __future__ import annotations

import hashlib
from datetime import date, datetime, time, timedelta
from typing import Any

from .config import WEEKDAY_LABELS

def _build_day_events_by_staff(
    rows: list[dict[str, Any]],
) -> dict[str, dict[date, dict[str, list[datetime]]]]:
    bucket: dict[str, dict[date, dict[str, list[datetime]]]] = {}
    for row in rows:
        staff_id = _clean_text(row.get("staff_id"))
        if not staff_id:
            continue
        event_date = _safe_date(row.get("attendance_date"))
        event_time = _safe_datetime(row.get("attendance_time"))
        if event_date is None or event_time is None:
            continue
        event_type = _clean_text(row.get("attendance_type")).lower()
        day_data = bucket.setdefault(staff_id, {}).setdefault(
            event_date,
            {"checkin": [], "checkout": []},
        )
        if event_type in day_data:
            day_data[event_type].append(event_time)
    return bucket


def _build_day_summaries(
    day_events_by_staff: dict[str, dict[date, dict[str, list[datetime]]]],
    late_threshold: time,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for staff_id, day_map in day_events_by_staff.items():
        for day, events in day_map.items():
            checkins = sorted(events["checkin"])
            checkouts = sorted(events["checkout"])
            first_checkin = checkins[0] if checkins else None
            last_checkout = checkouts[-1] if checkouts else None
            late_checkin = bool(first_checkin and first_checkin.time() > late_threshold)
            work_hours = None
            if first_checkin and last_checkout and last_checkout >= first_checkin:
                work_hours = round((last_checkout - first_checkin).total_seconds() / 3600, 2)
            rows.append(
                {
                    "staff_id": staff_id,
                    "date": day,
                    "checkin_count": len(checkins),
                    "checkout_count": len(checkouts),
                    "first_checkin": first_checkin,
                    "last_checkout": last_checkout,
                    "late_checkin": late_checkin,
                    "work_hours": work_hours,
                }
            )
    rows.sort(key=lambda x: (x["staff_id"], x["date"]))
    return rows


def _attach_staff(day_rows: list[dict[str, Any]], staff_by_id: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in day_rows:
        staff = staff_by_id.get(row["staff_id"], {})
        merged = dict(row)
        merged["employee_code"] = _clean_text(staff.get("employee_code"))
        merged["full_name"] = _clean_text(staff.get("full_name"))
        merged["department"] = _clean_text(staff.get("department")) or "Unknown"
        merged["position"] = _clean_text(staff.get("position")) or "Unknown"
        merged["status"] = _clean_text(staff.get("status"))
        merged["onboard_date"] = _safe_date(staff.get("onboard_date"))
        out.append(merged)
    return out


def _count_active_by_department(active_staffs: list[dict[str, Any]]) -> list[dict[str, str]]:
    counts: dict[str, int] = {}
    for s in active_staffs:
        dept = _clean_text(s.get("department")) or "Unknown"
        counts[dept] = counts.get(dept, 0) + 1
    rows = [{"department": dept, "active_staff_count": str(cnt)} for dept, cnt in counts.items()]
    rows.sort(key=lambda x: (-int(x["active_staff_count"]), x["department"]))
    return rows


def _count_active_inactive_by_department(staffs: list[dict[str, Any]]) -> list[dict[str, str]]:
    agg: dict[str, dict[str, int]] = {}
    for s in staffs:
        dept = _clean_text(s.get("department")) or "Unknown"
        slot = agg.setdefault(dept, {"active": 0, "inactive": 0})
        if _is_active(s.get("status")):
            slot["active"] += 1
        else:
            slot["inactive"] += 1
    rows: list[dict[str, str]] = []
    for dept, slot in agg.items():
        total = slot["active"] + slot["inactive"]
        inactive_rate = round((slot["inactive"] / total) * 100, 2) if total else 0.0
        rows.append(
            {
                "department": dept,
                "active_count": str(slot["active"]),
                "inactive_count": str(slot["inactive"]),
                "inactive_rate_pct": f"{inactive_rate:.2f}",
            }
        )
    rows.sort(key=lambda x: (-float(x["inactive_rate_pct"]), x["department"]))
    return rows


def _avg_age_by_department(active_staffs: list[dict[str, Any]], as_of: date) -> list[dict[str, str]]:
    ages: dict[str, list[int]] = {}
    for s in active_staffs:
        dob = _safe_date(s.get("date_of_birth"))
        if dob is None:
            continue
        age = _age_on(dob, as_of)
        dept = _clean_text(s.get("department")) or "Unknown"
        ages.setdefault(dept, []).append(age)
    rows: list[dict[str, str]] = []
    for dept, values in ages.items():
        avg_age = round(sum(values) / len(values), 2) if values else 0.0
        rows.append({"department": dept, "avg_age": f"{avg_age:.2f}"})
    rows.sort(key=lambda x: (-float(x["avg_age"]), x["department"]))
    return rows


def _late_ratio_by_department(
    day_rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
) -> list[dict[str, str]]:
    agg: dict[str, dict[str, int]] = {}
    for row in day_rows:
        if not _in_range(row["date"], start_date, end_date):
            continue
        if row["checkin_count"] == 0:
            continue
        dept = row["department"]
        slot = agg.setdefault(dept, {"late": 0, "total": 0})
        slot["total"] += 1
        if row["late_checkin"]:
            slot["late"] += 1
    return _ratio_table(agg, dim_name="department")


def _late_ratio_by_weekday(
    day_rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
    include_saturday: bool,
) -> list[dict[str, str]]:
    valid_weekdays = {0, 1, 2, 3, 4, 5} if include_saturday else {0, 1, 2, 3, 4}
    agg: dict[str, dict[str, int]] = {}
    for row in day_rows:
        if not _in_range(row["date"], start_date, end_date):
            continue
        if row["date"].weekday() not in valid_weekdays or row["checkin_count"] == 0:
            continue
        label = WEEKDAY_LABELS[row["date"].weekday()]
        slot = agg.setdefault(label, {"late": 0, "total": 0})
        slot["total"] += 1
        if row["late_checkin"]:
            slot["late"] += 1

    rows = _ratio_table(agg, dim_name="weekday")
    order = {name: idx for idx, name in enumerate(WEEKDAY_LABELS)}
    rows.sort(key=lambda x: order.get(x["weekday"], 99))
    return rows


def _late_frequency_by_position(
    day_rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
) -> list[dict[str, str]]:
    agg: dict[str, dict[str, int]] = {}
    for row in day_rows:
        if not _in_range(row["date"], start_date, end_date):
            continue
        if row["checkin_count"] == 0:
            continue
        pos = row["position"] or "Unknown"
        slot = agg.setdefault(pos, {"late": 0, "total": 0})
        slot["total"] += 1
        if row["late_checkin"]:
            slot["late"] += 1
    rows = _ratio_table(agg, dim_name="position")
    rows.sort(key=lambda x: (-float(x["late_ratio_pct"]), x["position"]))
    return rows


def _inactive_but_has_attendance_this_month(
    staffs: list[dict[str, Any]],
    day_rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
) -> list[dict[str, str]]:
    inactive_staffs = {_clean_text(s.get("id")): s for s in staffs if not _is_active(s.get("status"))}
    attendance_days: dict[str, set[date]] = {}
    for row in day_rows:
        sid = _clean_text(row.get("staff_id"))
        if sid not in inactive_staffs:
            continue
        if _in_range(row["date"], start_date, end_date):
            attendance_days.setdefault(sid, set()).add(row["date"])
    rows: list[dict[str, str]] = []
    for sid, days in attendance_days.items():
        s = inactive_staffs[sid]
        rows.append(
            {
                "employee_code": _clean_text(s.get("employee_code")),
                "full_name": _clean_text(s.get("full_name")),
                "department": _clean_text(s.get("department")) or "Unknown",
                "attendance_days_this_month": str(len(days)),
            }
        )
    rows.sort(key=lambda x: (-int(x["attendance_days_this_month"]), x["employee_code"]))
    return rows


def _attendance_before_onboard(
    staffs: list[dict[str, Any]],
    day_rows: list[dict[str, Any]],
) -> list[dict[str, str]]:
    onboard_by_staff = {_clean_text(s.get("id")): _safe_date(s.get("onboard_date")) for s in staffs}
    first_attendance: dict[str, date] = {}
    for row in day_rows:
        sid = _clean_text(row.get("staff_id"))
        if not sid:
            continue
        first_attendance[sid] = min(row["date"], first_attendance.get(sid, row["date"]))

    staff_by_id = {_clean_text(s.get("id")): s for s in staffs}
    rows: list[dict[str, str]] = []
    for sid, first_day in first_attendance.items():
        onboard = onboard_by_staff.get(sid)
        if onboard is None or first_day >= onboard:
            continue
        s = staff_by_id.get(sid, {})
        rows.append(
            {
                "employee_code": _clean_text(s.get("employee_code")),
                "full_name": _clean_text(s.get("full_name")),
                "department": _clean_text(s.get("department")) or "Unknown",
                "onboard_date": onboard.isoformat(),
                "first_attendance_date": first_day.isoformat(),
            }
        )
    rows.sort(key=lambda x: (x["first_attendance_date"], x["employee_code"]))
    return rows


def _avg_work_hours_by_department(day_rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    hours: dict[str, list[float]] = {}
    for row in day_rows:
        work_hours = row["work_hours"]
        if work_hours is None:
            continue
        dept = row["department"] or "Unknown"
        hours.setdefault(dept, []).append(float(work_hours))
    rows: list[dict[str, str]] = []
    for dept, values in hours.items():
        avg_hours = round(sum(values) / len(values), 2) if values else 0.0
        rows.append({"department": dept, "avg_work_hours_per_day": f"{avg_hours:.2f}"})
    rows.sort(key=lambda x: (-float(x["avg_work_hours_per_day"]), x["department"]))
    return rows


def _missing_checkout_trend(
    day_rows: list[dict[str, Any]],
    this_month_start: date,
    this_month_end: date,
    prev_month_start: date,
    prev_month_end: date,
) -> list[dict[str, str]]:
    this_stats: dict[str, dict[str, int]] = {}
    prev_stats: dict[str, dict[str, int]] = {}

    for row in day_rows:
        if row["checkin_count"] == 0:
            continue
        dept = row["department"] or "Unknown"
        target = None
        if _in_range(row["date"], this_month_start, this_month_end):
            target = this_stats.setdefault(dept, {"missing": 0, "total": 0})
        elif _in_range(row["date"], prev_month_start, prev_month_end):
            target = prev_stats.setdefault(dept, {"missing": 0, "total": 0})
        if target is None:
            continue
        target["total"] += 1
        if row["checkout_count"] == 0:
            target["missing"] += 1

    all_depts = sorted(set(this_stats.keys()) | set(prev_stats.keys()))
    rows: list[dict[str, str]] = []
    for dept in all_depts:
        t = this_stats.get(dept, {"missing": 0, "total": 0})
        p = prev_stats.get(dept, {"missing": 0, "total": 0})
        this_ratio = (t["missing"] / t["total"] * 100) if t["total"] else 0.0
        prev_ratio = (p["missing"] / p["total"] * 100) if p["total"] else 0.0
        delta = round(this_ratio - prev_ratio, 2)
        trend = "Tăng" if delta > 0 else ("Giảm" if delta < 0 else "Không đổi")
        rows.append(
            {
                "department": dept,
                "missing_ratio_this_month_pct": f"{this_ratio:.2f}",
                "missing_ratio_prev_month_pct": f"{prev_ratio:.2f}",
                "delta_pct_point": f"{delta:.2f}",
                "trend": trend,
            }
        )
    rows.sort(key=lambda x: (-float(x["missing_ratio_this_month_pct"]), x["department"]))
    return rows


def _headcount_trend_12_months(staffs: list[dict[str, Any]], month_keys: list[str]) -> list[dict[str, str]]:
    onboard_by_month: dict[str, int] = {k: 0 for k in month_keys}
    first_month_start = _month_key_to_start(month_keys[0])

    base_before_window = 0
    for s in staffs:
        onboard = _safe_date(s.get("onboard_date"))
        if onboard is None:
            continue
        month_key = onboard.strftime("%Y-%m")
        if month_key in onboard_by_month:
            onboard_by_month[month_key] += 1
        elif onboard < first_month_start:
            base_before_window += 1

    rows: list[dict[str, str]] = []
    cumulative = base_before_window
    for month in month_keys:
        new_onboard = onboard_by_month[month]
        cumulative += new_onboard
        rows.append(
            {
                "month": month,
                "new_onboard_count": str(new_onboard),
                "cumulative_headcount": str(cumulative),
            }
        )
    return rows


def _ratio_table(agg: dict[str, dict[str, int]], dim_name: str) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for dim, slot in agg.items():
        total = slot["total"]
        ratio = (slot["late"] / total * 100) if total else 0.0
        rows.append(
            {
                dim_name: dim,
                "late_checkin_days": str(slot["late"]),
                "total_checkin_days": str(total),
                "late_ratio_pct": f"{ratio:.2f}",
            }
        )
    rows.sort(key=lambda x: (-float(x["late_ratio_pct"]), x[dim_name]))
    return rows


def _compact_breakdown(
    rows: list[dict[str, str]],
    key_col: str,
    val_col: str,
    suffix: str = "",
) -> str:
    if not rows:
        return "(no data)"
    items = [
        _record_text({key_col: row[key_col], val_col: f"{row[val_col]}{suffix}"})
        for row in rows
    ]
    return "; ".join(items)


def _compact_active_inactive(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "(no data)"
    items = [
        _record_text(
            {
                "department": row["department"],
                "active_count": row["active_count"],
                "inactive_count": row["inactive_count"],
                "inactive_rate_pct": f"{row['inactive_rate_pct']}%",
            }
        )
        for row in rows
    ]
    return "; ".join(items)


def _age_gap_summary(rows: list[dict[str, str]]) -> tuple[str, str]:
    if not rows:
        return "N/A", "(no data)"
    top = rows[0]
    bottom = rows[-1]
    gap = round(float(top["avg_age"]) - float(bottom["avg_age"]), 2)
    answer = f"Lệch {gap:.2f} tuổi ({top['department']} vs {bottom['department']})"
    details = _compact_breakdown(rows, "department", "avg_age")
    return answer, details


def _compact_late_ratio(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "(no data)"
    items = [
        _record_text(
            {
                "department": row["department"],
                "late_ratio_pct": f"{row['late_ratio_pct']}%",
                "late_checkin_days": row["late_checkin_days"],
                "total_checkin_days": row["total_checkin_days"],
            }
        )
        for row in rows
    ]
    return "; ".join(items)


def _compact_people(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "Không có"
    items = [
        _record_text(
            {
                "employee_code": row["employee_code"],
                "department": row["department"],
            }
        )
        for row in rows
    ]
    return "; ".join(items)


def _compact_checkout_trend(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "(no data)"
    items = [
        _record_text(
            {
                "department": row["department"],
                "missing_ratio_this_month_pct": f"{row['missing_ratio_this_month_pct']}%",
                "missing_ratio_prev_month_pct": f"{row['missing_ratio_prev_month_pct']}%",
                "trend": row["trend"],
                "delta_pct_point": row["delta_pct_point"],
            }
        )
        for row in rows
    ]
    return "; ".join(items)


def _compact_headcount(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "(no data)"
    items = [
        _record_text(
            {
                "month": row["month"],
                "new_onboard_count": row["new_onboard_count"],
                "cumulative_headcount": row["cumulative_headcount"],
            }
        )
        for row in rows
    ]
    return "; ".join(items)


def _record_text(record: dict[str, Any]) -> str:
    parts = [f"{k}={v}" for k, v in record.items()]
    return "{ " + ", ".join(parts) + " }"


def _escape_md_cell(value: Any) -> str:
    return str(value or "").replace("|", r"\|").replace("\n", " ").strip()


def _safe_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip()).date()
        except ValueError:
            return None
    return None


def _safe_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return datetime.fromisoformat(value.strip())
        except ValueError:
            try:
                return datetime.strptime(value.strip(), "%Y-%m-%d %H:%M:%S")
            except ValueError:
                return None
    return None


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def _has_text(value: Any) -> bool:
    return bool(_clean_text(value))


def _is_active(status: Any) -> bool:
    return _clean_text(status).lower() == "active"


def _in_range(day: date | None, start_day: date, end_day: date) -> bool:
    return day is not None and start_day <= day <= end_day


def _age_on(dob: date, as_of: date) -> int:
    age = as_of.year - dob.year
    if (as_of.month, as_of.day) < (dob.month, dob.day):
        age -= 1
    return max(age, 0)


def _is_default_password_hash(staff: dict[str, Any]) -> bool:
    dob = _safe_date(staff.get("date_of_birth"))
    hash_value = _clean_text(staff.get("password_hash"))
    if dob is None or not hash_value:
        return False
    expected = hashlib.sha256(dob.isoformat().encode("utf-8")).hexdigest()
    return hash_value.lower() == expected.lower()


def _month_end(day: date) -> date:
    next_month = (day.replace(day=28) + timedelta(days=4)).replace(day=1)
    return next_month - timedelta(days=1)


def _previous_month_window(as_of: date) -> tuple[date, date]:
    this_month_start = as_of.replace(day=1)
    prev_month_end = this_month_start - timedelta(days=1)
    prev_month_start = prev_month_end.replace(day=1)
    return prev_month_start, prev_month_end


def _last_n_months(as_of: date, n: int) -> list[str]:
    months: list[str] = []
    cursor = as_of.replace(day=1)
    for _ in range(n):
        months.append(cursor.strftime("%Y-%m"))
        prev_end = cursor - timedelta(days=1)
        cursor = prev_end.replace(day=1)
    months.reverse()
    return months


def _month_key_to_start(month_key: str) -> date:
    return datetime.strptime(month_key, "%Y-%m").date().replace(day=1)
