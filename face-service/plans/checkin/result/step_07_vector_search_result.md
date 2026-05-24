# Step 07 Result - Qdrant Vector Search

## Trang thai

DONE

## File da chinh sua

- `app/services/vector_db.py`

## File da tao

- `plans/checkin/result/step_07_vector_search_result.md`

## Noi dung da thuc hien

- Them `FaceSearchHit` dataclass gom:
  - `point_id`
  - `score`
  - `payload`
- Them `VectorDBService.search_face(...)` de search embedding da enrollment trong Qdrant.
- `search_face(...)` nhan:
  - `embedding`: ArcFace 512-D da L2-normalized.
  - `limit`: so ket qua toi da.
  - `score_threshold`: nguong cosine similarity tuy chon.
- `search_face(...)` tra ve `list[FaceSearchHit]`, empty list neu khong co match.

## Quyet dinh ky thuat

- Khong thay doi `upsert_face_embedding(...)`.
- Reuse `_validate_embedding(...)` de rule 512-D/L2-normalized dong nhat giua enrollment va check-in.
- Dung `QdrantClient.query_points(...)` thay vi `search(...)` vi package hien tai `qdrant-client==1.14.*` khong expose `QdrantClient.search`.
- Khong bat buoc payload phai co `employee_id` trong vector service; pipeline se validate payload theo nhu cau check-in.
- Qdrant collection dung cosine, nen score cang cao thi khuon mat cang giong.

## Kiem tra da chay

- `python -m compileall -q app/services/vector_db.py`
- `python -c "from app.services.vector_db import VectorDBService, FaceSearchHit; print('vector_db import ok'); import inspect; print(inspect.signature(VectorDBService.search_face))"`
- Inline fake Qdrant client check:
  - Map `point_id`, `score`, `payload` dung.
  - Forward `limit=1`.
  - Forward `score_threshold=0.55`.
  - `with_vectors=False`.

## Ghi chu

- Chua chay voi Qdrant server that o step nay; integration test voi Qdrant se phu hop hon o step verification/e2e.
