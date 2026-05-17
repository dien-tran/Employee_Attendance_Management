# Quality Gate & Pose Filter Plan

## Mục tiêu

Triển khai bước **Quality Gate** sau `Detection` và `Anti-Spoofing`, trước `Embedding`.

Bước này loại frame chất lượng kém để embedding trung bình không bị lệch bởi ảnh mờ, tối, quá sáng, mặt quá xa hoặc pose xấu.

---

## File triển khai

```text
app/services/preprocessing.py
```

Service chính:

```python
QualityGateService
```

Input:

```python
image: np.ndarray        # ảnh BGR HxWx3 từ decode_base64_image(...)
face: DetectedFace       # kết quả từ FaceDetector.detect_one(...)
```

Output:

```python
QualityCheckResult
```

---

## Config sử dụng

Trong `config/config.yaml`:

```yaml
quality:
  blur_threshold: 100.0
  min_brightness: 40
  max_brightness: 250
  min_face_ratio: 0.05
  max_yaw_deg: 20
  max_pitch_deg: 20
```

Ý nghĩa:
- `blur_threshold`: ngưỡng nét tối thiểu theo variance of Laplacian.
- `min_brightness`: độ sáng grayscale tối thiểu.
- `max_brightness`: độ sáng grayscale tối đa.
- `min_face_ratio`: diện tích bbox mặt / diện tích ảnh tối thiểu.
- `max_yaw_deg`: góc quay ngang tối đa.
- `max_pitch_deg`: góc cúi/ngẩng tối đa.

---

## Interface

Ví dụ khởi tạo:

```python
from app.core.config import load_config
from app.services.preprocessing import QualityGateService

config = load_config()
quality_gate = QualityGateService(config["quality"])
```

Ví dụ kiểm tra frame:

```python
result = quality_gate.check(image, detected_face)
```

---

## Status trả về

| Status | Khi nào |
| --- | --- |
| `OK` | Frame đạt toàn bộ tiêu chí |
| `BLUR` | `blur_score < blur_threshold` |
| `TOO_DARK` | `brightness < min_brightness` |
| `TOO_BRIGHT` | `brightness > max_brightness` |
| `FACE_TOO_SMALL` | `face_ratio < min_face_ratio` |
| `BAD_POSE` | thiếu pose hoặc `abs(pitch/yaw)` vượt ngưỡng |

`QualityCheckResult` luôn trả kèm metric:
- `blur_score`
- `brightness`
- `face_ratio`
- `pitch`
- `yaw`

Các metric này giúp frontend/log hiển thị feedback cụ thể hơn nếu cần.

---

## Luồng xử lý

1. Validate ảnh BGR `HxWx3`.
2. Convert ảnh sang grayscale.
3. Tính blur bằng variance of Laplacian.
4. Tính brightness bằng mean grayscale.
5. Tính face ratio từ `DetectedFace.bbox`.
6. Đọc pitch/yaw từ `DetectedFace.pose`.
7. Reject theo thứ tự:
   `BLUR → TOO_DARK/TOO_BRIGHT → FACE_TOO_SMALL → BAD_POSE → OK`.

Frame `OK` mới được phép đi tiếp sang bước embedding.

---

## Test

Compile:

```bash
python -m py_compile app/services/preprocessing.py
```

Smoke tests dùng ảnh giả:
- ảnh uniform → `BLUR`;
- ảnh texture tối → `TOO_DARK`;
- bbox nhỏ → `FACE_TOO_SMALL`;
- pose yaw/pitch quá lớn → `BAD_POSE`;
- ảnh texture đủ sáng, bbox lớn, pose hợp lệ → `OK`.

---

## Ghi chú

- Không thêm dependency mới; dùng `opencv-python` và `numpy`.
- Service độc lập, chưa nối pipeline/WebSocket.
- Quality Gate bắt buộc chạy trước Embedding theo `AGENT.md`.
