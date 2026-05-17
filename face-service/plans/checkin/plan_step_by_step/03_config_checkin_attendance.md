# Step 03 — Config for Check-in and Attendance

## Mục tiêu

Bổ sung config cho check-in/check-out và luật attendance.

## File dự kiến

- `config/config.yaml`.
- `app/core/config.py` nếu cần env override cho config mới.

## Config dự kiến

```yaml
checkin:
  similarity_threshold: 0.55
  high_confidence_threshold: 0.75
  required_consecutive_high: 2
  required_low_votes: 3
  session_timeout_sec: 30
  frame_interval_ms: 400
  enforce_liveness: false

attendance:
  checkin_deadline: "08:00"
  checkout_start: "16:30"
  timezone: "Asia/Ho_Chi_Minh"
  require_checkin_before_checkout: true
```

MySQL hiện đã có config cơ bản. Có thể bổ sung:

```yaml
mysql:
  pool_size: 5
  pool_timeout: 30
```

## Quyết định đã chốt

- `checkin.enforce_liveness` mặc định là `false`.
- Anti-spoofing vẫn chạy advisory để lấy debug score.
- Không hardcode threshold trong Python.

## Comment/docstring bắt buộc khi code

- Nếu thêm env override, comment giải thích env dùng cho Docker khác local.
- Nếu parse time config, docstring phải nêu ví dụ `"08:00"` và output là `datetime.time`.

## Tiêu chí nghiệm thu

- `load_config()` đọc được config mới.
- Không phá config enrollment/model/qdrant hiện có.
- Config có thể override bằng env chỉ khi cần thiết.

