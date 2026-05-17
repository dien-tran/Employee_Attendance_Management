# Step 15 — End-to-End Test

## Mục tiêu

Xác nhận flow thật từ enrollment tới check-in/check-out.

## Kịch bản test

1. Docker up backend, Qdrant, MySQL.
2. Có staff active trong `staffs` mirror hoặc source DB.
3. Enrollment nhân viên.
4. Check-in thành công.
5. Check-in lại cùng ngày trả `ALREADY_RECORDED`.
6. Check-out thành công nếu đã check-in.
7. Check-out nhân viên chưa check-in trả `CHECKOUT_WITHOUT_CHECKIN`.
8. Nhân viên inactive trả `EMPLOYEE_INACTIVE`.

## Dữ liệu cần chuẩn bị

- Ít nhất một nhân viên active, ví dụ `NV001`.
- Ít nhất một nhân viên inactive, ví dụ `NV002`.
- Embedding enrollment tương ứng trong Qdrant.

## Kết quả cần xác nhận

- MySQL có record đúng:
  - `employee_id`.
  - `type`.
  - `check_date`.
  - `check_time`.
  - `status`.
  - `similarity_score`.
- WebSocket response đúng schema.
- Frontend overlay hiển thị đúng tên/trạng thái.

## Tiêu chí nghiệm thu

- Không insert trùng cùng employee/type/date.
- Check-out không qua nếu chưa check-in.
- Unknown face không đóng session ngay.
- Advisory anti-spoofing vẫn trả score/debug nếu backend có dữ liệu.

