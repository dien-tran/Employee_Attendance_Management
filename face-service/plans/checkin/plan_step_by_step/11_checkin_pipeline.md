# Step 11 — CheckinPipeline

## Mục tiêu

Tạo pipeline xử lý một WebSocket session check-in/check-out.

## File dự kiến

- `app/pipeline/checkin.py` mới.

## Luồng xử lý

1. Validate message bằng schema check-in.
2. Decode image base64 sang BGR.
3. Detection.
4. Anti-spoofing advisory.
5. Quality Gate.
6. Extract embedding.
7. Search Qdrant.
8. Confidence accumulation.
9. Khi đủ confidence: gọi AttendanceService.
10. Trả response JSON-safe.

## State dự kiến

- `started_at`.
- `attendance_type`.
- `candidate_employee_id`.
- `consecutive_high`.
- `low_vote_counts`.
- `completed`.

## Confidence accumulation

- `score >= high_confidence_threshold` cùng employee 2 lần liên tiếp: confirm.
- `score >= similarity_threshold` cùng employee đủ `required_low_votes`: confirm.
- Candidate đổi: reset high counter cho candidate cũ.
- `score < similarity_threshold`: trả `UNKNOWN_FACE`, không đóng connection.
- Timeout sau `session_timeout_sec`: đóng session.

## Anti-spoofing

- Luôn chạy để lấy debug score.
- Nếu `enforce_liveness=false`: không reject vì liveness thấp.
- Nếu sau này bật `enforce_liveness=true`: có thể map liveness fail thành `SPOOF_DETECTED`.

## Comment/docstring bắt buộc

- Class docstring mô tả pipeline giữ state theo WebSocket session.
- Method xử lý frame ghi rõ input raw payload và output dict JSON-safe.
- Comment trước block confidence accumulation.
- Comment trước block anti-spoofing advisory.

## Tiêu chí nghiệm thu

- Unknown face không đóng WebSocket.
- Success/already/checkout-without-checkin đóng session.
- Timeout hoạt động.
- Không khởi tạo service/model mới trong frame loop.

