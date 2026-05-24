# HR Staff Summary

- scenario: `hr_scenario_pack_single_table_staff`
- generated_at: 2026-05-17T09:48:07+00:00
- as_of_date: 2026-05-17
- window_this_month: 2026-05-01 -> 2026-05-31
- window_previous_month: 2026-04-01 -> 2026-04-30
- window_yesterday: 2026-05-16
- window_last_12_months: 2025-06 -> 2026-05

| level | group | question | answer | details |
| --- | --- | --- | --- | --- |
| M1 | Hồ sơ & Định danh | Tổng số nhân viên hiện tại của công ty là bao nhiêu? | 90 | COUNT staff WHERE status = Active |
| M1 | Hồ sơ & Định danh | Có bao nhiêu nhân viên đã cập nhật số tài khoản ngân hàng? | 90 | COUNT Active staff WHERE bank_account_number IS NOT NULL/empty |
| M1 | Hồ sơ & Định danh | Số lượng nhân sự chưa khai báo CCCD là bao nhiêu? | 0 | COUNT Active staff WHERE citizen_id IS NULL/empty |
| M1 | Hồ sơ & Định danh | Hiện tại công ty có bao nhiêu phòng ban và bao nhiêu vị trí chức danh? | Phòng ban: 7 \| Vị trí: 5 | COUNT DISTINCT department, position trên active staff |
| M1 | Hồ sơ & Định danh | Có bao nhiêu nhân sự onboard mới trong tháng này? | 1 | COUNT staff WHERE onboard_date in 2026-05-01 -> 2026-05-31 |
| M1 | Hồ sơ & Định danh | Tổng số tài khoản nhân viên chưa thay đổi mật khẩu mặc định là bao nhiêu? | 100 | COUNT staff WHERE password_hash = SHA256(date_of_birth) |
| M2 | Phân tích Cơ cấu & Biến động | Số lượng nhân viên đang hoạt động phân bổ theo từng phòng ban như thế nào? | Cao nhất: Operations (21) | { department=Operations, active_staff_count=21 }; { department=IT, active_staff_count=13 }; { department=Sales, active_staff_count=13 }; { department=Admin, active_staff_count=12 }; { department=HR, active_staff_count=12 }; { department=Marketing, active_staff_count=11 }; { department=Finance, active_staff_count=8 } |
| M2 | Phân tích Cơ cấu & Biến động | So sánh số lượng nhân viên Active và Inactive của từng phòng ban? | Tỷ lệ Inactive cao nhất: Finance (20.00%) | { department=Finance, active_count=8, inactive_count=2, inactive_rate_pct=20.00% }; { department=Marketing, active_count=11, inactive_count=2, inactive_rate_pct=15.38% }; { department=Admin, active_count=12, inactive_count=2, inactive_rate_pct=14.29% }; { department=Operations, active_count=21, inactive_count=2, inactive_rate_pct=8.70% }; { department=HR, active_count=12, inactive_count=1, inactive_rate_pct=7.69% }; { department=IT, active_count=13, inactive_count=1, inactive_rate_pct=7.14% }; { department=Sales, active_count=13, inactive_count=0, inactive_rate_pct=0.00% } |
| M2 | Phân tích Cơ cấu & Biến động | Độ tuổi trung bình của nhân viên giữa các phòng ban có sự chênh lệch như thế nào? | Lệch 6.58 tuổi (Sales vs Finance) | { department=Sales, avg_age=35.08 }; { department=Marketing, avg_age=34.00 }; { department=Operations, avg_age=33.67 }; { department=Admin, avg_age=32.83 }; { department=IT, avg_age=32.69 }; { department=HR, avg_age=32.00 }; { department=Finance, avg_age=28.50 } |
| M3 | Hiệu suất & Xu hướng Vận hành | Biến động tổng số nhân sự của công ty theo từng tháng trong 1 năm qua như thế nào? | 2025-06->2026-05: 84->100 (+16) | { month=2025-06, new_onboard_count=3, cumulative_headcount=84 }; { month=2025-07, new_onboard_count=3, cumulative_headcount=87 }; { month=2025-08, new_onboard_count=3, cumulative_headcount=90 }; { month=2025-09, new_onboard_count=3, cumulative_headcount=93 }; { month=2025-10, new_onboard_count=2, cumulative_headcount=95 }; { month=2025-11, new_onboard_count=0, cumulative_headcount=95 }; { month=2025-12, new_onboard_count=1, cumulative_headcount=96 }; { month=2026-01, new_onboard_count=0, cumulative_headcount=96 }; { month=2026-02, new_onboard_count=2, cumulative_headcount=98 }; { month=2026-03, new_onboard_count=0, cumulative_headcount=98 }; { month=2026-04, new_onboard_count=1, cumulative_headcount=99 }; { month=2026-05, new_onboard_count=1, cumulative_headcount=100 } |

## Notes
- Late checkin được suy ra từ attendance_time > threshold vì schema chưa có cột on_time.
- Missing checkout = staff-day có checkin nhưng không có checkout.
- Default password dùng rule SHA256(date_of_birth) để so với password_hash.
- Headcount trend 12 tháng là tích lũy theo onboard_date (không có ngày nghỉ việc).
