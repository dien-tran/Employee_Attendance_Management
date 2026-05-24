# Triển Khai Quality Gate & Pose Filter

## Summary
Bước tiếp theo sau anti-spoofing là thêm `app/services/preprocessing.py` để kiểm tra chất lượng frame trước khi dùng embedding: blur, brightness, face size, yaw/pitch. Service nhận ảnh BGR và `DetectedFace` từ detection, trả status rõ ràng để pipeline/WebSocket reject frame hoặc cho đi tiếp.

## Key Changes
- Thêm `QualityGateService(model_config/config["quality"])` hoặc `QualityGateService(quality_config)`:
  - Interface chính: `check(image: np.ndarray, face: DetectedFace) -> QualityCheckResult`.
  - `QualityCheckResult` gồm `status`, `passed`, `message`, `blur_score`, `brightness`, `face_ratio`, `pitch`, `yaw`.
  - Status: `OK`, `BLUR`, `TOO_DARK`, `TOO_BRIGHT`, `FACE_TOO_SMALL`, `BAD_POSE`.

- Logic kiểm tra trong `app/services/preprocessing.py`:
  - Validate ảnh BGR `HxWx3`.
  - Convert grayscale bằng OpenCV.
  - Blur score: `cv2.Laplacian(gray, cv2.CV_64F).var()`, reject nếu `< blur_threshold`.
  - Brightness: `gray.mean()`, reject nếu `< min_brightness` hoặc `> max_brightness`.
  - Face ratio: diện tích bbox / diện tích ảnh, reject nếu `< min_face_ratio`.
  - Pose: đọc `face.pose` theo `[pitch, yaw, roll]`, reject `BAD_POSE` nếu thiếu pose hoặc `abs(pitch/yaw)` vượt config.
  - Thứ tự reject: blur → dark/bright → face small → bad pose → OK.

- Comment trực tiếp trong code:
  - Giải thích input `image`, `face`, từng field trong `QualityCheckResult`.
  - Giải thích từng threshold lấy từ `config["quality"]`.
  - Thêm ví dụ comment khi gọi:
    ```python
    result = quality_gate.check(image, detected_face)
    ```
  - Giải thích công thức blur, brightness, face ratio, yaw/pitch.

- Cập nhật tài liệu:
  - Repo hiện có `AGENT.md`, không có `AGENTS.md`; cập nhật `AGENT.md` mục Quality Gate để nhắc thứ tự `Detection → Anti-Spoofing → Quality Gate → Embedding`.
  - Tạo `plans/quality_gate_plan.md` mô tả interface, config, luồng xử lý, output status, test.

## Test Plan
- Compile:
  - `python -m py_compile app\services\preprocessing.py`
- Unit/smoke test bằng ảnh giả:
  - ảnh đen hoặc quá tối → `TOO_DARK` sau khi blur đủ/hoặc theo thứ tự reject hiện tại.
  - ảnh uniform/không texture → `BLUR`.
  - bbox nhỏ → `FACE_TOO_SMALL`.
  - pose yaw/pitch vượt 20 độ → `BAD_POSE`.
  - ảnh đủ sáng, đủ nét giả lập, bbox lớn, pose hợp lệ → `OK`.
- Không nối vào pipeline/WebSocket trong bước này; chỉ làm service độc lập.

## Assumptions
- File hướng dẫn đúng trong repo là `AGENT.md`; yêu cầu “AGENTS.md” được hiểu là muốn cập nhật file hướng dẫn agent hiện có.
- Không thêm dependency mới vì `opencv-python` và `numpy` đã có.
- Giữ thresholds hiện tại trong `config/config.yaml`.
- Quality Gate chạy sau `Detection` và `Anti-Spoofing`, nhưng vẫn trước bước `Embedding`.
