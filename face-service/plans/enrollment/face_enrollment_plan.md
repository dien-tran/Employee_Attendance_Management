# 🧩 Implementation Plan — Face Enrollment (Multi-Frame)

## Mục tiêu

Xây dựng chức năng **Đăng ký khuôn mặt** cho nhân viên: Frontend mở camera, thu thập nhiều frame, gửi về Backend xử lý qua pipeline AI (detect → anti-spoofing → quality filter → embed → average → normalize → lưu Qdrant).

---

## 1. Pipeline tổng quan

```
┌──────────── FRONTEND (Next.js) ─────────────┐      ┌──────────── BACKEND (FastAPI) ──────────────────────────────┐
│                                              │      │                                                             │
│  Mở camera                                   │      │  Nhận N frames                                              │
│  → Thu thập N frames (10-30) qua WebSocket   │ ───► │  → Với mỗi frame:                                          │
│  → Nhận feedback real-time từ backend        │      │       Detect Face → Anti-Spoofing → Quality Check           │
│  ← Hiển thị trạng thái (đạt/không đạt)      │ ◄─── │  → Lọc frame đạt chất lượng                                │
│                                              │      │  → Embed từng frame đạt (ArcFace 512-D)                    │
│  Khi đủ frame tốt → Backend tự hoàn tất     │      │  → Average embeddings → L2-normalize                       │
│  ← Nhận kết quả enrollment                  │ ◄─── │  → Lưu vào Qdrant + metadata                               │
└──────────────────────────────────────────────┘      └─────────────────────────────────────────────────────────────┘
```

---

## 2. Chi tiết từng bước

### Bước 1 — Frontend: Mở camera & stream frames

1. Admin nhập `employee_id`, `full_name`, `date_of_birth`
2. Bấm "Bắt đầu đăng ký" → mở webcam (`navigator.mediaDevices.getUserMedia()`)
3. Mở **WebSocket** tới `/api/v1/enroll/ws`
4. Gửi frame base64 JPEG mỗi **300-500ms** (2-3 FPS)
5. Mỗi frame gửi đi, backend trả feedback:
   - `"GOOD_FRAME"` — frame đạt chất lượng, đã thu thập
   - `"NO_FACE"` / `"BLUR"` / `"TOO_DARK"` / `"BAD_POSE"` / `"SPOOF"` — frame bị loại
   - `"ENROLLMENT_COMPLETE"` — đã đủ frame tốt, enrollment thành công
6. Frontend hiển thị progress bar (ví dụ: 7/10 frames tốt)

**WebSocket message (client → server):**
```json
{
  "action": "capture",
  "employee_id": "NV001",
  "full_name": "Nguyễn Văn A",
  "date_of_birth": "1998-04-21",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

**WebSocket message (server → client):**
```json
{
  "status": "GOOD_FRAME",
  "accepted_count": 7,
  "required_count": 10,
  "message": "Frame đạt chất lượng (7/10)"
}
```

> **Tại sao WebSocket thay vì REST?**
> - Multi-frame cần gửi liên tục → WebSocket hiệu quả hơn
> - Backend trả feedback real-time để user điều chỉnh (xoay mặt, lại gần hơn,...)
> - Giữ state enrollment session trên server (đếm frame, tích lũy embeddings)

---

### Bước 2 — Backend: Nhận frame & decode

- Nhận JSON qua WebSocket, parse base64
- Tách `data:image/jpeg;base64,` header → decode thành `numpy array` (BGR OpenCV)

```python
import base64, cv2, numpy as np

def decode_base64_image(data: str) -> np.ndarray:
    if "," in data:
        data = data.split(",", 1)[1]
    img_bytes = base64.b64decode(data)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)
```

---

### Bước 3 — Face Detection

**Model:** InsightFace `buffalo_l` (bao gồm RetinaFace detector)

```python
from insightface.app import FaceAnalysis

device = config["runtime"]["device"]  # "cpu" hoặc "gpu"
ctx_id = config["runtime"]["gpu_id"] if device == "gpu" else -1
providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if device == "gpu" else ["CPUExecutionProvider"]

app = FaceAnalysis(
    name=config["model"]["insightface_model_name"],
    root=config["model"]["insightface_root"],
    providers=providers,
)
app.prepare(ctx_id=ctx_id, det_size=tuple(config["model"]["det_size"]))
faces = app.get(img)
```

**Mỗi face object chứa:**

| Thuộc tính         | Kiểu         | Mô tả                                    |
| ------------------ | ------------ | ----------------------------------------- |
| `bbox`             | float[4]     | Tọa độ [x1, y1, x2, y2]                 |
| `det_score`        | float        | Confidence (0 → 1)                       |
| `kps`              | float[5][2]  | 5 landmark points (mắt, mũi, miệng)     |
| `normed_embedding` | float[512]   | Embedding vector đã L2-normalize         |
| `pose`             | float[3]     | [pitch, yaw, roll] — góc nghiêng đầu (°) |

**Kiểm tra (mỗi frame):**
- 0 mặt → reject `NO_FACE`
- \> 1 mặt → reject `MULTIPLE_FACES`
- `det_score < 0.5` → reject `LOW_CONFIDENCE`

---

### Bước 4 — Anti-Spoofing (Model thật)

**Model:** MiniFASNet từ [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing)

**Setup:**
1. Clone repo Silent-Face-Anti-Spoofing
2. Copy model weights vào `models/anti_spoof/`
3. Sử dụng `AntiSpoofPredict` class để inference

**Cách hoạt động:**
1. Crop vùng mặt từ ảnh gốc dựa trên `bbox`
2. Resize về kích thước model yêu cầu (80×80 hoặc 256×256)
3. Đưa vào MiniFASNet → `liveness_score` (0 → 1, càng cao = càng thật)
4. Score < threshold (0.7) → reject `SPOOF_DETECTED`

> ⚠️ **Anti-spoofing chạy trên MỌI frame**, không chỉ frame cuối. Nếu 1 frame bị phát hiện spoof → reject frame đó và cảnh báo.

---

### Bước 5 — Quality Check & Pose Filter

Chỉ giữ lại frame đạt **TẤT CẢ** tiêu chí sau:

| Kiểm tra              | Cách thực hiện                                           | Ngưỡng         |
| ---------------------- | -------------------------------------------------------- | --------------- |
| **Độ nét (blur)**      | Variance of Laplacian: `cv2.Laplacian(gray, CV_64F).var()` | ≥ 100           |
| **Độ sáng**            | Mean brightness grayscale                                | 40 ≤ mean ≤ 250 |
| **Kích thước mặt**     | Diện tích mặt / diện tích ảnh                           | ≥ 5%            |
| **Yaw (quay ngang)**   | `abs(face.pose[1])` — góc quay trái/phải                | ≤ 20°           |
| **Pitch (ngẩng/cúi)**  | `abs(face.pose[0])` — góc ngẩng lên/cúi xuống           | ≤ 20°           |
| **Det score**          | Confidence từ detector                                   | ≥ 0.5           |

> ⚠️ **Lưu ý quan trọng:** Filter quality TRƯỚC khi embed là **bắt buộc**. Ảnh nhắm mắt, che mặt, blur nặng sẽ kéo lệch centroid embedding.

Frame không đạt → gửi feedback cụ thể cho frontend (blur, tối, nghiêng,...). Frame đạt → tiếp tục bước 6.

---

### Bước 6 — Embedding từng frame đạt chất lượng

**Model:** ArcFace (có sẵn trong `buffalo_l`)

- `app.get(img)` đã tự chạy ArcFace → `face.normed_embedding` (512-D, L2-normalized)
- Mỗi frame đạt quality → lưu embedding vào list tạm

```python
good_embeddings = []  # tích lũy trong session

embedding = face.normed_embedding  # shape (512,), float32
good_embeddings.append(embedding)
```

---

### Bước 7 — Average Embeddings & L2-Normalize

Khi đã thu thập đủ N frame tốt (ví dụ 10):

```python
import numpy as np

# Average
avg_embedding = np.mean(good_embeddings, axis=0)

# L2-Normalize (BẮT BUỘC sau khi average)
norm = np.linalg.norm(avg_embedding)
final_embedding = avg_embedding / norm  # shape (512,), float32
```

> ⚠️ **Phải normalize sau average.** Average của các vector đã normalize KHÔNG tự normalize. Nếu không normalize lại, cosine similarity khi search sẽ sai.

---

### Bước 8 — Lưu vào Qdrant

```python
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct, VectorParams, Distance

client = QdrantClient(host="localhost", port=6333)

# Tạo collection (chạy 1 lần khi khởi động)
client.create_collection(
    collection_name="face_embeddings",
    vectors_config=VectorParams(size=512, distance=Distance.COSINE),
)

# Lưu embedding + metadata
client.upsert(
    collection_name="face_embeddings",
    points=[
        PointStruct(
            id="uuid-random",
            vector=final_embedding.tolist(),
            payload={
                "employee_id": "NV001",
                "full_name": "Nguyễn Văn A",
                "date_of_birth": "1998-04-21",
                "enrolled_at": "2026-05-11T08:30:00",
                "num_frames_used": 10,
                "anti_spoof_score_avg": 0.95,
                "quality_score_avg": 0.88,
                "model_version": "buffalo_l",
            },
        )
    ],
)
```

**Payload metadata:**

| Field                 | Mô tả                                    |
| --------------------- | ----------------------------------------- |
| `employee_id`         | Mã nhân viên                             |
| `full_name`           | Họ tên nhân viên                         |
| `date_of_birth`       | Ngày sinh nhân viên (ISO date `YYYY-MM-DD`) |
| `enrolled_at`         | Thời gian đăng ký (ISO 8601)            |
| `num_frames_used`     | Số frame tốt đã dùng để tạo embedding   |
| `anti_spoof_score_avg`| Trung bình anti-spoofing score           |
| `quality_score_avg`   | Trung bình detection confidence          |
| `model_version`       | Phiên bản model                          |

---

### Bước 9 — Trả kết quả

**Thành công (qua WebSocket):**
```json
{
  "status": "ENROLLMENT_COMPLETE",
  "success": true,
  "message": "Đăng ký khuôn mặt thành công",
  "data": {
    "embedding_id": "a1b2c3d4-...",
    "employee_id": "NV001",
    "full_name": "Nguyễn Văn A",
    "date_of_birth": "1998-04-21",
    "num_frames_used": 10,
    "anti_spoof_score_avg": 0.9512,
    "quality_score_avg": 0.8876
  }
}
```

**Lỗi (mỗi frame, qua WebSocket):**
```json
{
  "status": "REJECTED",
  "reason": "BLUR",
  "accepted_count": 3,
  "required_count": 10,
  "message": "Ảnh bị mờ, vui lòng giữ yên camera"
}
```

---

## 3. Model AI sử dụng

| Model              | Thư viện                    | Chức năng                      | Output                    |
| ------------------ | --------------------------- | ------------------------------ | ------------------------- |
| RetinaFace         | InsightFace `buffalo_l`     | Face Detection + Landmarks     | bbox, kps, score, pose    |
| ArcFace (ResNet50) | InsightFace `buffalo_l`     | Face Embedding                 | 512-D vector (L2-norm)    |
| MiniFASNet         | Silent-Face-Anti-Spoofing   | Liveness / Anti-Spoofing (thật)| Score 0→1                 |

> `buffalo_l` bao gồm cả RetinaFace + ArcFace, gọi `app.get(img)` chạy cả 2.

---

## 4. Cấu trúc thư mục

```
Face_Services/
├── docs/
│   └── BRD.md
├── plans/
│   └── face_enrollment_plan.md         # File này
│
├── app/                                # Backend FastAPI root
│   ├── __init__.py
│   ├── main.py                         # FastAPI entry point, lifespan, CORS
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py               # Aggregation router
│   │       └── enrollment.py           # WebSocket /api/v1/enroll/ws
│   │
│   ├── pipeline/
│   │   ├── __init__.py
│   │   └── enrollment.py               # Orchestrate toàn bộ pipeline
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── detection.py                # InsightFace wrapper
│   │   ├── anti_spoofing.py            # MiniFASNet wrapper (model thật)
│   │   ├── preprocessing.py            # Quality checks + pose filter
│   │   ├── embedding.py                # ArcFace embedding + average + normalize
│   │   └── vector_db.py                # Qdrant CRUD
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── enrollment.py               # Pydantic models
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                   # Load config từ YAML
│   │   ├── dependencies.py             # Singleton init cho AI models
│   │   └── exceptions.py               # Custom exceptions
│   │
│   └── utils/
│       ├── __init__.py
│       └── image.py                    # Base64 decode/encode
│
├── config/
│   └── config.yaml
│
├── models/                             # AI model weights (không push git)
│   ├── buffalo_l/
│   └── anti_spoof/
│
├── frontend/                           # Next.js UI test/prototype
├── requirements-gpu.txt                # Dependencies cho máy có GPU
├── requirements-cpu.txt                # Dependencies cho máy không có GPU
├── docker-compose.yml                  # Qdrant + MySQL containers
└── .gitignore
```

**Phân layer:**
```
API Layer        →  app/api/v1/enrollment.py  (WebSocket, nhận frame, trả feedback)
     ↓
Pipeline Layer   →  app/pipeline/enrollment.py (điều phối, quản lý session multi-frame)
     ↓
Service Layer    →  app/services/*.py          (detect, anti-spoof, quality, embed, qdrant)
     ↓
Data Layer       →  Qdrant (Docker) — vector embeddings + metadata
```

---

## 5. Dependencies

### Option A — Máy có GPU NVIDIA

```txt
# requirements-gpu.txt
fastapi==0.115.*
uvicorn[standard]==0.34.*
insightface==0.7.*
onnxruntime-gpu==1.21.*
opencv-python==4.11.*
numpy==2.2.*
torch
torchvision
qdrant-client==1.14.*
pydantic==2.11.*
pyyaml==6.0.*
easydict==1.13
python-multipart==0.0.*
```

```bash
pip install -r requirements-gpu.txt
```

> Yêu cầu: CUDA/cuDNN tương thích với `onnxruntime-gpu`. Sau khi cài, đặt `runtime.device: "gpu"` trong config.

### Option B — Máy không có GPU (CPU only)

```txt
# requirements-cpu.txt
fastapi==0.115.*
uvicorn[standard]==0.34.*
insightface==0.7.*
onnxruntime==1.21.*
opencv-python==4.11.*
numpy==2.2.*
torch
torchvision
qdrant-client==1.14.*
pydantic==2.11.*
pyyaml==6.0.*
easydict==1.13
python-multipart==0.0.*
```

```bash
pip install -r requirements-cpu.txt
```

> CPU là mặc định an toàn. Giữ `runtime.device: "cpu"` trong config để InsightFace dùng `ctx_id=-1`.

### So sánh hiệu năng

| Chỉ số                    | GPU (RTX 3060+) | CPU (i5/i7)     |
| -------------------------- | --------------- | --------------- |
| Detect + Embed / frame     | ~30-50ms        | ~200-500ms      |
| Anti-spoofing / frame      | ~10-20ms        | ~50-100ms       |
| Tổng / frame               | ~50-80ms        | ~300-700ms      |
| Enrollment 10 frames       | ~0.5-1s         | ~3-7s           |

---

## 6. Qdrant — Docker Setup

```yaml
# docker-compose.yml
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant
    ports:
      - "6333:6333"   # REST API
      - "6334:6334"   # gRPC
    volumes:
      - qdrant_data:/qdrant/storage
    restart: unless-stopped

volumes:
  qdrant_data:
```

```bash
docker compose up -d
# Kiểm tra: http://localhost:6333/dashboard
```

---

## 7. Config mẫu

```yaml
# config/config.yaml

# ── AI Models ──
model:
  insightface_model_name: "buffalo_l"
  insightface_root: "."       # FaceAnalysis sẽ tìm ./models/buffalo_l
  det_size: [640, 640]
  det_candidate_threshold: 0.3 # Ngưỡng detect nội bộ để giữ candidate đủ tốt
  det_score_threshold: 0.5
  anti_spoof_model_dir: "./models/anti_spoof"
  anti_spoof_threshold: 0.7

# ── Quality Gate ──
quality:
  blur_threshold: 100.0
  min_brightness: 40
  max_brightness: 250
  min_face_ratio: 0.05
  max_yaw_deg: 20           # Góc quay ngang tối đa (độ)
  max_pitch_deg: 20          # Góc ngẩng/cúi tối đa (độ)

# ── Enrollment ──
enrollment:
  required_good_frames: 10   # Số frame tốt cần thu thập
  max_total_frames: 50       # Giới hạn tổng frame gửi lên (timeout nếu vượt)
  frame_interval_ms: 300     # Frontend gửi 1 frame mỗi 300ms

# ── Qdrant ──
qdrant:
  host: "localhost"
  port: 6333
  collection_name: "face_embeddings"
  embedding_dim: 512

# ── Runtime ──
runtime:
  device: "cpu"  # "cpu" hoặc "gpu"; mặc định CPU để chạy được mọi máy
  gpu_id: 0      # Chỉ dùng khi device là "gpu"
```

---

## 8. Xử lý lỗi

| Error Code              | Khi nào                                        | Loại     |
| ----------------------- | ---------------------------------------------- | -------- |
| `NO_FACE`               | Không tìm thấy mặt trong frame                | Per-frame|
| `MULTIPLE_FACES`        | Nhiều hơn 1 mặt                               | Per-frame|
| `LOW_CONFIDENCE`        | Det score < threshold                          | Per-frame|
| `SPOOF_DETECTED`        | Anti-spoofing fail                             | Per-frame|
| `BLUR`                  | Ảnh mờ                                         | Per-frame|
| `TOO_DARK` / `TOO_BRIGHT`| Độ sáng ngoài khoảng                         | Per-frame|
| `BAD_POSE`              | Yaw > 20° hoặc pitch > 20°                    | Per-frame|
| `FACE_TOO_SMALL`        | Khuôn mặt quá xa camera                       | Per-frame|
| `TIMEOUT`               | Gửi > max_total_frames mà chưa đủ frame tốt   | Session  |
| `INVALID_IMAGE`         | Base64 decode thất bại                         | Per-frame|

---

## 9. Thứ tự triển khai

| #  | Việc cần làm                                       | Ưu tiên |
| -- | -------------------------------------------------- | ------- |
| 1  | Tạo cấu trúc thư mục + config + docker-compose    | 🔴 Cao  |
| 2  | Viết `utils/image.py` (decode base64)              | 🔴 Cao  |
| 3  | Viết `services/detection.py` (InsightFace wrapper) | 🔴 Cao  |
| 4  | Viết `services/anti_spoofing.py` (MiniFASNet thật) | 🔴 Cao  |
| 5  | Viết `services/preprocessing.py` (quality + pose)  | 🔴 Cao  |
| 6  | Viết `services/embedding.py` (embed + average + normalize) | 🔴 Cao |
| 7  | Viết `services/vector_db.py` (Qdrant CRUD)         | 🔴 Cao  |
| 8  | Viết `core/exceptions.py`                          | 🟡 TB   |
| 9  | Viết `schemas/enrollment.py`                       | 🟡 TB   |
| 10 | Viết `pipeline/enrollment.py` (multi-frame orchestrator) | 🔴 Cao |
| 11 | Viết `api/v1/enrollment.py` (WebSocket endpoint)   | 🔴 Cao  |
| 12 | Viết `core/dependencies.py` + `main.py`            | 🔴 Cao  |
| 13 | Test end-to-end với Qdrant Docker                  | 🔴 Cao  |
