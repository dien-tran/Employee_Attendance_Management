from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from .config import UnifiedHRConfig
from .metrics import (
    _age_gap_summary,
    _attach_staff,
    _attendance_before_onboard,
    _avg_age_by_department,
    _avg_work_hours_by_department,
    _build_day_events_by_staff,
    _build_day_summaries,
    _clean_text,
    _compact_active_inactive,
    _compact_breakdown,
    _compact_checkout_trend,
    _compact_headcount,
    _compact_late_ratio,
    _compact_people,
    _count_active_by_department,
    _count_active_inactive_by_department,
    _has_text,
    _headcount_trend_12_months,
    _inactive_but_has_attendance_this_month,
    _in_range,
    _is_active,
    _is_default_password_hash,
    _last_n_months,
    _late_frequency_by_position,
    _late_ratio_by_department,
    _late_ratio_by_weekday,
    _missing_checkout_trend,
    _month_end,
    _previous_month_window,
    _safe_date,
)

def transform(frames: dict[str, list[dict[str, Any]]], config: UnifiedHRConfig) -> dict[str, Any]:
    """Compute level 1-3 metrics and flatten to one QA table."""
    as_of = config.as_of_date or date.today()
    this_month_start = as_of.replace(day=1)
    this_month_end = _month_end(as_of)
    prev_month_start, prev_month_end = _previous_month_window(as_of)
    yesterday = as_of - timedelta(days=1)
    last_12_months = _last_n_months(as_of, 12)

    staffs = [dict(r) for r in frames.get("staffs", [])]
    attendance_rows = [dict(r) for r in frames.get("attendances", [])]

    staff_by_id = {_clean_text(r.get("id")): r for r in staffs if _clean_text(r.get("id"))}
    active_staffs = [s for s in staffs if _is_active(s.get("status"))]

    day_events_by_staff = _build_day_events_by_staff(attendance_rows)
    day_summaries = _build_day_summaries(day_events_by_staff, config.checkin_late_threshold)
    day_summaries_with_staff = _attach_staff(day_summaries, staff_by_id)

    level1 = _compute_level1(
        as_of=as_of,
        this_month_start=this_month_start,
        this_month_end=this_month_end,
        yesterday=yesterday,
        staffs=staffs,
        active_staffs=active_staffs,
        day_summaries_with_staff=day_summaries_with_staff,
    )
    level2 = _compute_level2(
        as_of=as_of,
        this_month_start=this_month_start,
        this_month_end=this_month_end,
        active_staffs=active_staffs,
        staffs=staffs,
        day_summaries_with_staff=day_summaries_with_staff,
        include_saturday=config.include_saturday,
    )
    level3 = _compute_level3(
        this_month_start=this_month_start,
        this_month_end=this_month_end,
        prev_month_start=prev_month_start,
        prev_month_end=prev_month_end,
        staffs=staffs,
        day_summaries_with_staff=day_summaries_with_staff,
        last_12_months=last_12_months,
    )

    qa_rows = _build_qa_rows(level1, level2, level3)

    return {
        "scenario_slug": "hr_scenario_pack_single_table",
        "generated_at": datetime.now(UTC).replace(microsecond=0).isoformat(),
        "as_of_date": as_of.isoformat(),
        "windows": {
            "this_month": f"{this_month_start.isoformat()} -> {this_month_end.isoformat()}",
            "previous_month": f"{prev_month_start.isoformat()} -> {prev_month_end.isoformat()}",
            "yesterday": yesterday.isoformat(),
            "last_12_months": f"{last_12_months[0]} -> {last_12_months[-1]}",
        },
        "qa_rows": qa_rows,
        "notes": [
            "Late checkin được suy ra từ first check-in time > threshold.",
            "Missing checkout = staff-day có checkin nhưng không có checkout.",
            "Default password hash check chỉ áp dụng khi dữ liệu password tuân theo SHA256(date_of_birth).",
            "Headcount trend 12 tháng là tích lũy theo onboard_date (không có ngày nghỉ việc).",
        ],
    }


def _build_qa_rows(
    level1: list[dict[str, str]],
    level2: dict[str, list[dict[str, str]]],
    level3: dict[str, list[dict[str, str]]],
) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []

    for item in level1:
        topic = "attendance" if item["group"] == "Chấm công vận hành" else "staff"
        rows.append(
            {
                "topic": topic,
                "level": "M1",
                "group": item["group"],
                "question": item["question"],
                "answer": item["answer"],
                "details": item["details"],
            }
        )

    active_dist = level2["active_distribution_by_department"]
    top_dept = active_dist[0] if active_dist else {"department": "N/A", "active_staff_count": "0"}
    rows.append(
        {
            "topic": "staff",
            "level": "M2",
            "group": "Phân tích Cơ cấu & Biến động",
            "question": "Số lượng nhân viên đang hoạt động phân bổ theo từng phòng ban như thế nào?",
            "answer": f"Cao nhất: {top_dept['department']} ({top_dept['active_staff_count']})",
            "details": _compact_breakdown(active_dist, "department", "active_staff_count"),
        }
    )
    rows.append(
        {
            "topic": "staff",
            "level": "M2",
            "group": "Phân tích Cơ cấu & Biến động",
            "question": "Phân bố của nhân viên theo phòng ban?",
            "answer": f"Cao nhất: {top_dept['department']} ({top_dept['active_staff_count']})",
            "details": _compact_breakdown(active_dist, "department", "active_staff_count"),
        }
    )

    active_inactive = level2["active_inactive_compare_by_department"]
    top_inactive = active_inactive[0] if active_inactive else {
        "department": "N/A",
        "inactive_rate_pct": "0.00",
        "inactive_count": "0",
        "active_count": "0",
    }
    rows.append(
        {
            "topic": "staff",
            "level": "M2",
            "group": "Phân tích Cơ cấu & Biến động",
            "question": "So sánh số lượng nhân viên Active và Inactive của từng phòng ban?",
            "answer": (
                f"Tỷ lệ Inactive cao nhất: {top_inactive['department']} "
                f"({top_inactive['inactive_rate_pct']}%)"
            ),
            "details": _compact_active_inactive(active_inactive),
        }
    )

    avg_age = level2["average_age_by_department"]
    age_answer, age_details = _age_gap_summary(avg_age)
    rows.append(
        {
            "topic": "staff",
            "level": "M2",
            "group": "Phân tích Cơ cấu & Biến động",
            "question": "Độ tuổi trung bình của nhân viên giữa các phòng ban có sự chênh lệch như thế nào?",
            "answer": age_answer,
            "details": age_details,
        }
    )

    late_dept = level2["late_ratio_by_department"]
    late_dept_top = late_dept[0] if late_dept else {
        "department": "N/A",
        "late_ratio_pct": "0.00",
        "late_checkin_days": "0",
        "total_checkin_days": "0",
    }
    rows.append(
        {
            "topic": "attendance",
            "level": "M2",
            "group": "So sánh & Phân tích Kỷ luật",
            "question": "Tỷ lệ đi muộn (on_time = FALSE) của phòng ban nào đang cao nhất trong tháng?",
            "answer": f"{late_dept_top['department']} ({late_dept_top['late_ratio_pct']}%)",
            "details": _compact_late_ratio(late_dept),
        }
    )

    late_weekday = level2["late_ratio_by_weekday"]
    late_weekday_top = sorted(
        late_weekday,
        key=lambda x: (-float(x.get("late_ratio_pct", "0")), x.get("weekday", "")),
    )[0] if late_weekday else {"weekday": "N/A", "late_ratio_pct": "0.00"}
    rows.append(
        {
            "topic": "attendance",
            "level": "M2",
            "group": "So sánh & Phân tích Kỷ luật",
            "question": "So sánh tỷ lệ đi muộn giữa các ngày trong tuần để tìm ngày lỏng lẻo nhất?",
            "answer": f"{late_weekday_top['weekday']} ({late_weekday_top['late_ratio_pct']}%)",
            "details": _compact_breakdown(late_weekday, "weekday", "late_ratio_pct", suffix="%"),
        }
    )

    late_pos = level2["late_frequency_by_position"]
    late_pos_top = late_pos[0] if late_pos else {"position": "N/A", "late_ratio_pct": "0.00"}
    rows.append(
        {
            "topic": "attendance",
            "level": "M2",
            "group": "So sánh & Phân tích Kỷ luật",
            "question": "Vị trí/Chức danh nào có tần suất đi muộn trung bình cao nhất công ty?",
            "answer": f"{late_pos_top['position']} ({late_pos_top['late_ratio_pct']}%)",
            "details": _compact_breakdown(late_pos, "position", "late_ratio_pct", suffix="%"),
        }
    )

    inactive_recent = level3["inactive_staff_with_recent_attendance"]
    rows.append(
        {
            "topic": "attendance",
            "level": "M3",
            "group": "Phát hiện Bất thường & Kiểm toán Dữ liệu",
            "question": "Tháng này có bao nhiêu trường hợp nhân viên Inactive nhưng vẫn phát sinh chấm công?",
            "answer": str(len(inactive_recent)),
            "details": _compact_people(inactive_recent),
        }
    )

    before_onboard = level3["attendance_before_onboard"]
    rows.append(
        {
            "topic": "attendance",
            "level": "M3",
            "group": "Phát hiện Bất thường & Kiểm toán Dữ liệu",
            "question": "Có nhân viên nào có ngày chấm công trước cả ngày onboard chính thức không?",
            "answer": str(len(before_onboard)),
            "details": _compact_people(before_onboard),
        }
    )

    avg_hours = level3["average_work_hours_by_department"]
    top_hours = avg_hours[0] if avg_hours else {"department": "N/A", "avg_work_hours_per_day": "0.00"}
    rows.append(
        {
            "topic": "attendance",
            "level": "M3",
            "group": "Hiệu suất & Xu hướng Vận hành",
            "question": "Tổng số giờ làm việc trung bình mỗi ngày của các phòng ban là bao nhiêu?",
            "answer": f"Cao nhất: {top_hours['department']} ({top_hours['avg_work_hours_per_day']}h)",
            "details": _compact_breakdown(avg_hours, "department", "avg_work_hours_per_day", suffix="h"),
        }
    )

    trend = level3["missing_checkout_trend_by_department"]
    top_trend = trend[0] if trend else {
        "department": "N/A",
        "missing_ratio_this_month_pct": "0.00",
        "delta_pct_point": "0.00",
        "trend": "Không đổi",
    }
    rows.append(
        {
            "topic": "attendance",
            "level": "M3",
            "group": "Hiệu suất & Xu hướng Vận hành",
            "question": "Phòng ban nào có tỷ lệ quên check-out cao nhất và xu hướng tăng/giảm so với tháng trước?",
            "answer": (
                f"{top_trend['department']} ({top_trend['missing_ratio_this_month_pct']}%, {top_trend['trend']}, "
                f"Δ {top_trend['delta_pct_point']}đ)"
            ),
            "details": _compact_checkout_trend(trend),
        }
    )

    headcount = level3["headcount_trend_12_months"]
    if headcount:
        start = int(headcount[0]["cumulative_headcount"])
        end = int(headcount[-1]["cumulative_headcount"])
        delta = end - start
        delta_txt = f"+{delta}" if delta >= 0 else str(delta)
        headcount_answer = f"{headcount[0]['month']}->{headcount[-1]['month']}: {start}->{end} ({delta_txt})"
    else:
        headcount_answer = "N/A"
    rows.append(
        {
            "topic": "staff",
            "level": "M3",
            "group": "Hiệu suất & Xu hướng Vận hành",
            "question": "Biến động tổng số nhân sự của công ty theo từng tháng trong 1 năm qua như thế nào?",
            "answer": headcount_answer,
            "details": _compact_headcount(headcount),
        }
    )

    return rows


def _compute_level1(
    *,
    as_of: date,
    this_month_start: date,
    this_month_end: date,
    yesterday: date,
    staffs: list[dict[str, Any]],
    active_staffs: list[dict[str, Any]],
    day_summaries_with_staff: list[dict[str, Any]],
) -> list[dict[str, str]]:
    total_active = len(active_staffs)
    active_with_bank = sum(1 for s in active_staffs if _has_text(s.get("bank_account_number")))
    active_missing_citizen = sum(1 for s in active_staffs if not _has_text(s.get("citizen_id")))
    distinct_departments = len({_clean_text(s.get("department")) for s in active_staffs if _has_text(s.get("department"))})
    distinct_positions = len({_clean_text(s.get("position")) for s in active_staffs if _has_text(s.get("position"))})
    onboard_this_month = sum(
        1
        for s in staffs
        if _in_range(_safe_date(s.get("onboard_date")), this_month_start, this_month_end)
    )
    default_password_count = sum(1 for s in staffs if _is_default_password_hash(s))

    today_checkins = sum(
        d["checkin_count"]
        for d in day_summaries_with_staff
        if d["date"] == as_of and d["checkin_count"] > 0
    )
    month_late_checkins = sum(
        1
        for d in day_summaries_with_staff
        if _in_range(d["date"], this_month_start, this_month_end) and d["late_checkin"]
    )
    yesterday_missing_checkout = sum(
        1
        for d in day_summaries_with_staff
        if d["date"] == yesterday and d["checkin_count"] > 0 and d["checkout_count"] == 0
    )

    return [
        {
            "group": "Hồ sơ & Định danh",
            "question": "Tổng số nhân viên hiện tại của công ty là bao nhiêu?",
            "answer": str(total_active),
            "details": "COUNT staff WHERE status = Active",
        },
        {
            "group": "Hồ sơ & Định danh",
            "question": "Có bao nhiêu nhân viên đã cập nhật số tài khoản ngân hàng?",
            "answer": str(active_with_bank),
            "details": "COUNT Active staff WHERE bank_account_number IS NOT NULL/empty",
        },
        {
            "group": "Hồ sơ & Định danh",
            "question": "Số lượng nhân sự chưa khai báo CCCD là bao nhiêu?",
            "answer": str(active_missing_citizen),
            "details": "COUNT Active staff WHERE citizen_id IS NULL/empty",
        },
        {
            "group": "Hồ sơ & Định danh",
            "question": "Hiện tại công ty có bao nhiêu phòng ban và bao nhiêu vị trí chức danh?",
            "answer": f"Phòng ban: {distinct_departments} | Vị trí: {distinct_positions}",
            "details": "COUNT DISTINCT department, position trên active staff",
        },
        {
            "group": "Hồ sơ & Định danh",
            "question": "Có bao nhiêu nhân sự onboard mới trong tháng này?",
            "answer": str(onboard_this_month),
            "details": f"COUNT staff WHERE onboard_date in {this_month_start} -> {this_month_end}",
        },
        {
            "group": "Hồ sơ & Định danh",
            "question": "Tổng số tài khoản nhân viên chưa thay đổi mật khẩu mặc định là bao nhiêu?",
            "answer": str(default_password_count),
            "details": "COUNT staff WHERE password_hash = SHA256(date_of_birth)",
        },
        {
            "group": "Chấm công vận hành",
            "question": "Hôm nay có tổng cộng bao nhiêu lượt check-in?",
            "answer": str(today_checkins),
            "details": "COUNT checkin events của hôm nay",
        },
        {
            "group": "Chấm công vận hành",
            "question": "Tổng số lượt đi muộn trong tháng này của toàn công ty là bao nhiêu?",
            "answer": str(month_late_checkins),
            "details": "COUNT staff-day có checkin đầu tiên > threshold trong tháng hiện tại",
        },
        {
            "group": "Chấm công vận hành",
            "question": "Có bao nhiêu lượt chấm công bị quên check-out trong ngày hôm qua?",
            "answer": str(yesterday_missing_checkout),
            "details": "COUNT staff-day hôm qua có checkin > 0 nhưng checkout = 0",
        },
    ]


def _compute_level2(
    *,
    as_of: date,
    this_month_start: date,
    this_month_end: date,
    active_staffs: list[dict[str, Any]],
    staffs: list[dict[str, Any]],
    day_summaries_with_staff: list[dict[str, Any]],
    include_saturday: bool,
) -> dict[str, list[dict[str, str]]]:
    active_by_dept = _count_active_by_department(active_staffs)
    active_inactive = _count_active_inactive_by_department(staffs)
    avg_age_by_dept = _avg_age_by_department(active_staffs, as_of)
    late_ratio_by_dept = _late_ratio_by_department(day_summaries_with_staff, this_month_start, this_month_end)
    late_ratio_by_weekday = _late_ratio_by_weekday(
        day_summaries_with_staff,
        this_month_start,
        this_month_end,
        include_saturday,
    )
    late_freq_by_position = _late_frequency_by_position(day_summaries_with_staff, this_month_start, this_month_end)

    return {
        "active_distribution_by_department": active_by_dept,
        "active_inactive_compare_by_department": active_inactive,
        "average_age_by_department": avg_age_by_dept,
        "late_ratio_by_department": late_ratio_by_dept,
        "late_ratio_by_weekday": late_ratio_by_weekday,
        "late_frequency_by_position": late_freq_by_position,
    }


def _compute_level3(
    *,
    this_month_start: date,
    this_month_end: date,
    prev_month_start: date,
    prev_month_end: date,
    staffs: list[dict[str, Any]],
    day_summaries_with_staff: list[dict[str, Any]],
    last_12_months: list[str],
) -> dict[str, list[dict[str, str]]]:
    inactive_with_attendance = _inactive_but_has_attendance_this_month(
        staffs,
        day_summaries_with_staff,
        this_month_start,
        this_month_end,
    )
    attendance_before_onboard = _attendance_before_onboard(staffs, day_summaries_with_staff)
    avg_hours_by_department = _avg_work_hours_by_department(day_summaries_with_staff)
    missing_checkout_trend = _missing_checkout_trend(
        day_summaries_with_staff,
        this_month_start,
        this_month_end,
        prev_month_start,
        prev_month_end,
    )
    headcount_trend = _headcount_trend_12_months(staffs, last_12_months)

    return {
        "inactive_staff_with_recent_attendance": inactive_with_attendance,
        "attendance_before_onboard": attendance_before_onboard,
        "average_work_hours_by_department": avg_hours_by_department,
        "missing_checkout_trend_by_department": missing_checkout_trend,
        "headcount_trend_12_months": headcount_trend,
    }
