# Face Detection Plan — InsightFace `buffalo_l`

## Mục tiêu

Triển khai bước **Face Detection** sau khi frontend gửi ảnh và backend đã decode base64 thành `numpy.ndarray` BGR OpenCV.

Bước này chỉ chịu trách nhiệm:
- kiểm tra ảnh đầu vào có hợp lệ không;
- phát hiện khuôn mặt bằng InsightFace `buffalo_l`;
- đảm bảo frame có **đúng 1 khuôn mặt**;
- trả về thông tin face chuẩn hóa để các bước sau dùng tiếp: anti-spoofing, quality gate, embedding.

Chưa xử lý anti-spoofing, quality filter, average embedding, Qdrant hay WebSocket response ở đây.

---

## File triển khai

Code chính nằm ở:

```text
app/services/detection.py
```

Phụ thuộc config/runtime:

```text
app/core/config.py
app/core/runtime.py
config/config.yaml
models/buffalo_l/
```

---

## Input

Service nhận **1 frame ảnh đã decode**:

```python
image: np.ndarray
```

Yêu cầu shape:

```text
H x W x 3
```

Trong đó:
- `H`: chiều cao ảnh;
- `W`: chiều rộng ảnh;
- `3`: ba kênh màu BGR;
- ảnh đến từ `decode_base64_image(...)` trong `app/utils/image.py`.

---

## Config sử dụng

Trong `config/config.yaml`:

```yaml
model:
  insightface_model_name: "buffalo_l"
  insightface_root: "."
  det_size: [640, 640]
  det_candidate_threshold: 0.3
  det_score_threshold: 0.5

runtime:
  device: "cpu"
  gpu_id: 0
```

Ý nghĩa:
- `insightface_model_name`: tên model pack InsightFace.
- `insightface_root`: root để InsightFace tìm `./models/buffalo_l`.
- `det_size`: kích thước detector input.
- `det_candidate_threshold`: ngưỡng thấp để InsightFace giữ candidate ban đầu.
- `det_score_threshold`: ngưỡng chính để frame được chấp nhận.
- `runtime.device`: `"cpu"` hoặc `"gpu"`.
- `runtime.gpu_id`: GPU index khi chạy GPU.

---

## Interface

Khởi tạo service:

```python
from app.core.config import load_config
from app.services.detection import FaceDetector

config = load_config()
detector = FaceDetector(
    model_config=config["model"],
    runtime_config=config["runtime"],
)
```

Detect một frame:

```python
result = detector.detect_one(image)
```

---

## Output

`detect_one(...)` trả về:

```python
FaceDetectionResult
```

Gồm:

| Field | Ý nghĩa |
| --- | --- |
| `status` | Kết quả detection: `OK`, `NO_FACE`, `MULTIPLE_FACES`, `LOW_CONFIDENCE` |
| `face_count` | Số khuôn mặt InsightFace phát hiện |
| `message` | Thông báo có thể trả về frontend/log |
| `face` | `DetectedFace` nếu có đúng 1 face candidate |

`DetectedFace` gồm:

| Field | Ý nghĩa |
| --- | --- |
| `bbox` | Tọa độ mặt `[x1, y1, x2, y2]`, dùng để crop anti-spoofing |
| `det_score` | Confidence của detector |
| `landmarks` | Các điểm mắt/mũi/miệng nếu model trả về |
| `pose` | `[pitch, yaw, roll]`, dùng ở quality gate |
| `normed_embedding` | ArcFace embedding 512-D đã L2-normalize |
| `raw` | Object gốc từ InsightFace để debug/mở rộng |

---

## Luồng xử lý

1. `detect_one(image)` nhận ảnh BGR đã decode.
2. `_validate_image(...)` kiểm tra ảnh là `np.ndarray`, shape `HxWx3`, không rỗng.
3. `FaceAnalysis.get(image)` chạy InsightFace `buffalo_l`.
4. Nếu không có mặt → trả `NO_FACE`.
5. Nếu nhiều hơn 1 mặt → trả `MULTIPLE_FACES`.
6. Nếu có đúng 1 mặt → convert object InsightFace sang `DetectedFace`.
7. Nếu `det_score < det_score_threshold` → trả `LOW_CONFIDENCE`.
8. Nếu đủ tin cậy → trả `OK` kèm `DetectedFace`.

Frame `OK` vẫn phải đi tiếp qua:

```text
Anti-Spoofing → Quality Gate → Embedding → Average + Normalize → Qdrant
```

---

## CPU/GPU

`FaceDetector` dùng `resolve_runtime(...)`:

| Config | InsightFace `ctx_id` | ONNX provider |
| --- | --- | --- |
| `runtime.device: "cpu"` | `-1` | `CPUExecutionProvider` |
| `runtime.device: "gpu"` | `gpu_id` | `CUDAExecutionProvider`, fallback CPU |

Mặc định project để CPU để chạy được trên mọi máy.

---

## Test

Compile:

```bash
python -m py_compile app/services/detection.py
```

Smoke test ảnh không có mặt:

```bash
python -c "import numpy as np; from app.core.config import load_config; from app.services.detection import FaceDetector; cfg=load_config(); detector=FaceDetector(cfg['model'], cfg['runtime']); result=detector.detect_one(np.zeros((240, 320, 3), dtype=np.uint8)); print(result.status, result.face_count)"
```

Kết quả mong đợi:

```text
NO_FACE 0
```

---

## Ghi chú triển khai

- Service không tự đọc YAML để dễ test và dễ inject config.
- Model `buffalo_l` phải tồn tại trong `models/buffalo_l/`.
- `det_candidate_threshold` thấp hơn `det_score_threshold` để vẫn phân biệt được `LOW_CONFIDENCE` và `NO_FACE`.
- Không load model mỗi frame; sau này nên khởi tạo singleton trong `core/dependencies.py`.
