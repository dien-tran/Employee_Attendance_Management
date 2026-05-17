# Step 07 — Qdrant Vector Search

## Mục tiêu

Thêm khả năng search face embedding đã enrollment trong Qdrant.

## File dự kiến

- `app/services/vector_db.py`.

## API dự kiến

```python
@dataclass(frozen=True)
class FaceSearchHit:
    point_id: str | int
    score: float
    payload: dict[str, Any]
```

```python
def search_face(
    self,
    embedding: np.ndarray,
    limit: int = 1,
    score_threshold: float | None = None,
) -> list[FaceSearchHit]:
    ...
```

## Comment/docstring bắt buộc

Docstring `search_face(...)` phải ghi:

- `embedding`: vector ArcFace 512-D đã L2-normalized. Example: `np.ndarray shape (512,)`.
- `limit`: số kết quả tối đa. Example: `1`.
- `score_threshold`: ngưỡng cosine similarity. Example: `0.55`.
- Return: danh sách hit, empty list nếu không có match.
- Raise: `ValueError` nếu embedding sai shape hoặc NaN/Inf.

Comment ngắn:

- Reuse `_validate_embedding(...)` để giữ rule 512-D/L2-normalized đồng nhất.
- Qdrant collection dùng cosine nên score càng cao càng giống.

## Tiêu chí nghiệm thu

- Không ảnh hưởng `upsert_face_embedding(...)`.
- Không ép payload phải có `employee_id` ở service này nếu muốn generic; pipeline sẽ validate.
- Compile/import pass.

