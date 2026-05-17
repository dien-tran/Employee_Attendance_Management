# Step 10 — Dependencies Container for Check-in

## Mục tiêu

Tạo factory và dependency wiring cho check-in/check-out.

## File dự kiến

- `app/core/dependencies.py`.
- Có thể cần `app/main.py` nếu chọn startup/shutdown MySQL pool.

## Nội dung chính

- Reuse singleton hiện có: detector, anti_spoofing, quality_gate, embedding_service, vector_db.
- Tạo MySQL service singleton hoặc lifecycle-managed pool.
- Tạo AttendanceService.
- Tạo `create_checkin_pipeline()`.

## Nguyên tắc

- Không load model trong endpoint.
- Không load model trong frame loop.
- Mỗi WebSocket connection có pipeline riêng vì pipeline giữ session state.
- Service nặng dùng chung singleton.

## Comment/docstring bắt buộc

- Comment giải thích vì sao pipeline mới per connection nhưng service AI dùng chung.
- Docstring/factory comment nêu output là `CheckinPipeline`.
- Nếu có startup/shutdown, comment lifecycle pool MySQL.

## Tiêu chí nghiệm thu

- Import `app.main:app` pass.
- `reset_dependency_cache()` vẫn hoạt động cho dev/test.
- Không tạo pool MySQL nhiều lần theo từng frame.

