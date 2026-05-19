# HR Attendance Summary

- scenario: `hr_scenario_pack_single_table_attendance`
- generated_at: 2026-05-17T09:48:07+00:00
- as_of_date: 2026-05-17
- window_this_month: 2026-05-01 -> 2026-05-31
- window_previous_month: 2026-04-01 -> 2026-04-30
- window_yesterday: 2026-05-16
- window_last_12_months: 2025-06 -> 2026-05

| level | group | question | answer | details |
| --- | --- | --- | --- | --- |
| M1 | Chấm công vận hành | Hôm nay có tổng cộng bao nhiêu lượt check-in? | 0 | COUNT checkin events của hôm nay |
| M1 | Chấm công vận hành | Tổng số lượt đi muộn trong tháng này của toàn công ty là bao nhiêu? | 73 | COUNT staff-day có checkin đầu tiên > threshold trong tháng hiện tại |
| M1 | Chấm công vận hành | Có bao nhiêu lượt chấm công bị quên check-out trong ngày hôm qua? | 0 | COUNT staff-day hôm qua có checkin > 0 nhưng checkout = 0 |
| M2 | So sánh & Phân tích Kỷ luật | Tỷ lệ đi muộn (on_time = FALSE) của phòng ban nào đang cao nhất trong tháng? | HR (66.67%) | { department=HR, late_ratio_pct=66.67%, late_checkin_days=8, total_checkin_days=12 }; { department=IT, late_ratio_pct=64.71%, late_checkin_days=11, total_checkin_days=17 }; { department=Admin, late_ratio_pct=61.90%, late_checkin_days=13, total_checkin_days=21 }; { department=Finance, late_ratio_pct=60.00%, late_checkin_days=9, total_checkin_days=15 }; { department=Operations, late_ratio_pct=52.17%, late_checkin_days=12, total_checkin_days=23 }; { department=Sales, late_ratio_pct=52.00%, late_checkin_days=13, total_checkin_days=25 }; { department=Marketing, late_ratio_pct=50.00%, late_checkin_days=7, total_checkin_days=14 } |
| M2 | So sánh & Phân tích Kỷ luật | So sánh tỷ lệ đi muộn giữa các ngày trong tuần để tìm ngày lỏng lẻo nhất? | Wed (77.78%) | { weekday=Mon, late_ratio_pct=59.09% }; { weekday=Tue, late_ratio_pct=38.46% }; { weekday=Wed, late_ratio_pct=77.78% }; { weekday=Thu, late_ratio_pct=38.89% }; { weekday=Fri, late_ratio_pct=61.90% }; { weekday=Sat, late_ratio_pct=58.33% } |
| M2 | So sánh & Phân tích Kỷ luật | Vị trí/Chức danh nào có tần suất đi muộn trung bình cao nhất công ty? | Team Lead (65.52%) | { position=Team Lead, late_ratio_pct=65.52% }; { position=Staff, late_ratio_pct=65.22% }; { position=Intern, late_ratio_pct=56.00% }; { position=Senior Staff, late_ratio_pct=55.56% }; { position=Manager, late_ratio_pct=46.88% } |
| M3 | Phát hiện Bất thường & Kiểm toán Dữ liệu | Tháng này có bao nhiêu trường hợp nhân viên Inactive nhưng vẫn phát sinh chấm công? | 7 | { employee_code=EMP00049, department=Finance }; { employee_code=EMP00040, department=Marketing }; { employee_code=EMP00009, department=Admin }; { employee_code=EMP00022, department=Operations }; { employee_code=EMP00081, department=Operations }; { employee_code=EMP00067, department=Marketing }; { employee_code=EMP00085, department=Finance } |
| M3 | Phát hiện Bất thường & Kiểm toán Dữ liệu | Có nhân viên nào có ngày chấm công trước cả ngày onboard chính thức không? | 5 | { employee_code=EMP00020, department=Admin }; { employee_code=EMP00023, department=Sales }; { employee_code=EMP00093, department=HR }; { employee_code=EMP00086, department=Operations }; { employee_code=EMP00043, department=Sales } |
| M3 | Hiệu suất & Xu hướng Vận hành | Tổng số giờ làm việc trung bình mỗi ngày của các phòng ban là bao nhiêu? | Cao nhất: Finance (10.63h) | { department=Finance, avg_work_hours_per_day=10.63h }; { department=IT, avg_work_hours_per_day=10.48h }; { department=Admin, avg_work_hours_per_day=10.41h }; { department=Sales, avg_work_hours_per_day=10.21h }; { department=HR, avg_work_hours_per_day=10.20h }; { department=Operations, avg_work_hours_per_day=10.06h }; { department=Marketing, avg_work_hours_per_day=10.05h } |
| M3 | Hiệu suất & Xu hướng Vận hành | Phòng ban nào có tỷ lệ quên check-out cao nhất và xu hướng tăng/giảm so với tháng trước? | Admin (100.00%, Tăng, Δ 19.61đ) | { department=Admin, missing_ratio_this_month_pct=100.00%, missing_ratio_prev_month_pct=80.39%, trend=Tăng, delta_pct_point=19.61 }; { department=HR, missing_ratio_this_month_pct=91.67%, missing_ratio_prev_month_pct=94.34%, trend=Giảm, delta_pct_point=-2.67 }; { department=IT, missing_ratio_this_month_pct=88.24%, missing_ratio_prev_month_pct=86.79%, trend=Tăng, delta_pct_point=1.44 }; { department=Sales, missing_ratio_this_month_pct=88.00%, missing_ratio_prev_month_pct=86.36%, trend=Tăng, delta_pct_point=1.64 }; { department=Finance, missing_ratio_this_month_pct=86.67%, missing_ratio_prev_month_pct=92.68%, trend=Giảm, delta_pct_point=-6.02 }; { department=Operations, missing_ratio_this_month_pct=73.91%, missing_ratio_prev_month_pct=88.04%, trend=Giảm, delta_pct_point=-14.13 }; { department=Marketing, missing_ratio_this_month_pct=71.43%, missing_ratio_prev_month_pct=88.89%, trend=Giảm, delta_pct_point=-17.46 } |

## Notes
- Late checkin được suy ra từ attendance_time > threshold vì schema chưa có cột on_time.
- Missing checkout = staff-day có checkin nhưng không có checkout.
- Default password dùng rule SHA256(date_of_birth) để so với password_hash.
- Headcount trend 12 tháng là tích lũy theo onboard_date (không có ngày nghỉ việc).
