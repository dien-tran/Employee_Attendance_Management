# Step 11 Result - CheckinPipeline

## Trang thai

DONE

## File da tao

- `app/pipeline/checkin.py`
- `plans/checkin/result/step_11_checkin_pipeline_result.md`

## Noi dung da thuc hien

- Tao `CheckinPipeline` xu ly mot WebSocket session check-in/check-out.
- Tao `CheckinSessionState` gom:
  - `started_at`
  - `attendance_type`
  - `candidate_employee_id`
  - `consecutive_high`
  - `low_vote_counts`
  - `completed`
- Tao protocol de fake test cac service:
  - `FaceDetectorPort`
  - `AntiSpoofingPort`
  - `QualityGatePort`
  - `EmbeddingPort`
  - `VectorSearchPort`
  - `AttendancePort`
- Tao async entrypoint:
  - `handle_frame_payload(payload) -> dict[str, Any]`
  - `process_frame(message) -> response model`

## Luong xu ly

1. Validate message bang schema check-in.
2. Decode image base64/data URL sang OpenCV BGR.
3. Detection.
4. Anti-spoofing advisory.
5. Quality Gate.
6. Extract embedding.
7. Search Qdrant.
8. Confidence accumulation.
9. Khi du confidence: goi `AttendanceService.record_attendance(...)`.
10. Tra response JSON-safe.

## Confidence accumulation

- `score >= high_confidence_threshold` cung employee du `required_consecutive_high` frame lien tiep thi confirm.
- `score >= similarity_threshold` cung employee du `required_low_votes` thi confirm.
- Candidate doi thi reset `consecutive_high`.
- `score < similarity_threshold` tra `UNKNOWN_FACE`, khong dong session.

## Anti-spoofing

- Anti-spoofing luon chay de lay debug/advisory score.
- Neu `enforce_liveness=false`, liveness thap khong reject frame.
- Neu sau nay bat `enforce_liveness=true`, frame co `SPOOF_DETECTED` se bi reject theo per-frame error.

## Quyet dinh ky thuat

- `CheckinPipeline` khong khoi tao model AI, Qdrant client hay MySQL pool.
- Pipeline la per WebSocket connection vi co session state.
- Service nang van duoc inject tu dependency container.
- Qdrant service khong bat buoc payload co `employee_id`; pipeline validate field nay truoc khi goi attendance.
- Final attendance decision set `completed=True`, de WebSocket API step sau co the dong connection sau khi gui response.

## Kiem tra da chay

- `python -m compileall -q app/pipeline/checkin.py app/core/dependencies.py app/schemas/checkin.py app/core/exceptions.py`
- `from app.pipeline.checkin import CheckinPipeline, CheckinSessionState`
- `from app.main import app`
- `from app.core.dependencies import create_checkin_pipeline, reset_dependency_cache`
- Fake services smoke test:
  - Frame 1 score 0.8 -> `PROCESSING`
  - Frame 2 score 0.8 -> `ATTENDANCE_SUCCESS`
  - Score 0.2 -> `UNKNOWN_FACE`
  - Session timeout -> `ERROR / SESSION_TIMEOUT`

## Ghi chu

- Chua goi model/Qdrant/MySQL that trong step nay.
- WebSocket endpoint se duoc tao o step 12 va se dung `create_checkin_pipeline()`.
