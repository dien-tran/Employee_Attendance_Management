# Qdrant Vector DB Service Plan

## Mục tiêu

Triển khai service lưu final face embedding vào Qdrant.

Final embedding phải đến từ:

```python
EmbeddingService.average_and_normalize(good_embeddings)
```

Không lưu vector average chưa L2-normalize.

---

## File triển khai

```text
app/services/vector_db.py
```

Service chính:

```python
VectorDBService
```

---

## Config sử dụng

Trong `config/config.yaml`:

```yaml
qdrant:
  host: "localhost"
  port: 6333
  collection_name: "face_embeddings"
  embedding_dim: 512
```

Ý nghĩa:
- `host`, `port`: REST endpoint Qdrant.
- `collection_name`: collection lưu embeddings.
- `embedding_dim`: số chiều vector, phải khớp ArcFace 512-D.

---

## Interface

Khởi tạo:

```python
from app.core.config import load_config
from app.services.vector_db import VectorDBService

config = load_config()
vector_db = VectorDBService(config["qdrant"])
```

Tạo collection nếu chưa có:

```python
vector_db.ensure_collection()
```

Lưu embedding:

```python
embedding_id = vector_db.upsert_face_embedding(final_embedding, metadata)
```

---

## Collection

Collection được tạo với:

```python
VectorParams(size=512, distance=Distance.COSINE)
```

Lý do dùng cosine:
- ArcFace embedding dùng cosine similarity.
- `EmbeddingService.average_and_normalize(...)` đảm bảo final embedding có L2 norm xấp xỉ `1.0`.

---

## Metadata Payload

Payload nên có:

```json
{
  "employee_id": "NV001",
  "full_name": "Nguyễn Văn A",
  "date_of_birth": "1998-04-21",
  "enrolled_at": "2026-05-11T08:30:00",
  "num_frames_used": 10,
  "anti_spoof_score_avg": 0.95,
  "quality_score_avg": 0.88,
  "model_version": "buffalo_l"
}
```

`VectorDBService` chỉ validate metadata là mapping không rỗng. Schema/pipeline sau này sẽ validate field bắt buộc và format `date_of_birth`.

---

## Validation

`upsert_face_embedding(...)` kiểm tra:
- embedding là `np.ndarray`;
- vector 1-D;
- đúng `embedding_dim`;
- không chứa NaN/Inf;
- L2 norm xấp xỉ `1.0`;
- metadata không rỗng.

---

## Test

Compile:

```bash
python -m py_compile app/services/vector_db.py
```

Smoke tests không cần Qdrant:
- valid normalized vector pass `_validate_embedding`;
- sai dimension raise `ValueError`;
- zero/non-normalized vector raise `ValueError`;
- metadata rỗng raise `ValueError`.

Integration test khi Qdrant chạy:

```bash
docker compose up -d qdrant
```

Sau đó:

```python
vector_db.ensure_collection()
embedding_id = vector_db.upsert_face_embedding(final_embedding, metadata)
```

---

## Ghi chú

- Service này chưa triển khai search/recognition.
- Service này chưa nối WebSocket/pipeline.
- `point_id` có thể truyền vào để update cùng id; nếu không truyền thì service tự tạo UUID.
- Qdrant chỉ nhận point ID là unsigned integer hoặc UUID string, nên `VectorDBService` validate sớm và reject string tự do như `"NV001"` hay `"integration-test"`.
