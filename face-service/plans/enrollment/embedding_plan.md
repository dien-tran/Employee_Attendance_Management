# Embedding Service Plan

## Mục tiêu

Triển khai bước **Embedding** sau khi frame đã pass:

```text
Detection → Anti-Spoofing → Quality Gate
```

InsightFace `buffalo_l` đã tạo `DetectedFace.normed_embedding` trong bước detection. Service này lấy embedding đó, validate đúng 512-D, gom nhiều frame tốt, average và L2-normalize lần cuối trước khi bước sau lưu Qdrant.

---

## File triển khai

```text
app/services/embedding.py
```

Service chính:

```python
EmbeddingService
```

---

## Interface

Khởi tạo:

```python
from app.core.config import load_config
from app.services.embedding import EmbeddingService

config = load_config()
embedding_service = EmbeddingService(config["qdrant"])
```

Lấy embedding từ một face:

```python
embedding = embedding_service.extract(detected_face)
```

Tạo final embeddi
ng từ nhiều frame tốt:
```python
final_embedding = embedding_service.average_and_normalize(good_embeddings)
```

---

## Input / Output

`extract(face)`:
- Input: `DetectedFace` có `normed_embedding`.
- Output: `np.ndarray` shape `(512,)`, dtype `float32`.

`average_and_normalize(embeddings)`:
- Input: danh sách embedding từ các frame tốt.
- Output: final embedding shape `(512,)`, dtype `float32`, L2 norm xấp xỉ `1.0`.

`l2_normalize(vector)`:
- Input: vector 1-D đúng dimension.
- Output: vector đã L2-normalize.

---

## Luồng xử lý

1. `extract(...)` lấy `face.normed_embedding` từ InsightFace.
2. Validate embedding tồn tại, là vector 1-D, đúng `embedding_dim`, không NaN/Inf.
3. Enrollment session tích lũy các embedding tốt vào `good_embeddings`.
4. Khi đủ frame tốt, `average_and_normalize(...)` stack embeddings thành matrix.
5. Tính average theo frame: `np.mean(axis=0)`.
6. L2-normalize average vector.
7. Final embedding mới được phép lưu Qdrant.

Lưu ý quan trọng: average của các vector đã normalized không tự normalized, nên bước L2-normalize sau average là bắt buộc.

---

## Lỗi dự kiến

| Trường hợp | Lỗi |
| --- | --- |
| `face.normed_embedding is None` | `ValueError` |
| embedding không phải `np.ndarray` | `TypeError` |
| embedding không phải 1-D | `ValueError` |
| embedding sai dimension | `ValueError` |
| embedding chứa NaN/Inf | `ValueError` |
| danh sách embedding rỗng | `ValueError` |
| zero vector khi normalize | `ValueError` |

---

## Test

Compile:

```bash
python -m py_compile app/services/embedding.py
```

Smoke tests:
- embedding shape `(512,)` trả `float32`;
- `None` raise `ValueError`;
- sai dimension raise `ValueError`;
- average + normalize trả norm xấp xỉ `1.0`;
- empty list raise `ValueError`;
- zero vector raise `ValueError`.

---

## Ghi chú

- Service chưa lưu Qdrant; `vector_db.py` sẽ làm ở bước tiếp theo.
- `embedding_dim` lấy từ `config["qdrant"]["embedding_dim"]`, hiện là `512`.
- `AGENT.md` yêu cầu chỉ lưu final embedding đã L2-normalize sau average.
