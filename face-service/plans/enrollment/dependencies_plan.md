# Core Dependencies Plan

## Mục tiêu

Triển khai `app/core/dependencies.py` để quản lý singleton config/runtime/service cho backend.

File chính:

```text
app/core/dependencies.py
```

---

## Vì sao cần bước này

Các service AI như InsightFace và MiniFASNet load model nặng. Nếu API/WebSocket khởi tạo trực tiếp trong mỗi frame thì enrollment sẽ rất chậm.

`dependencies.py` gom việc khởi tạo về một nơi:

- load config một lần;
- resolve CPU/GPU runtime một lần;
- load `FaceDetector` một lần;
- load `AntiSpoofingService` một lần;
- tạo `QualityGateService`, `EmbeddingService`, `VectorDBService`;
- tạo `EnrollmentPipeline` mới cho từng WebSocket session nhưng dùng lại service singleton.

---

## Interface

Load config:

```python
from app.core.dependencies import get_app_config

config = get_app_config()
```

Resolve runtime:

```python
from app.core.dependencies import get_runtime_config

runtime = get_runtime_config()
```

Lấy service singleton:

```python
from app.core.dependencies import get_service_container

services = get_service_container()
```

Tạo pipeline cho một WebSocket connection:

```python
from app.core.dependencies import create_enrollment_pipeline

pipeline = create_enrollment_pipeline()
```

---

## ServiceContainer

`ServiceContainer` chứa:

- `config`
- `runtime`
- `detector`
- `anti_spoofing`
- `quality_gate`
- `embedding_service`
- `vector_db`

`detector` và `anti_spoofing` là service nặng, được cache bằng `@lru_cache(maxsize=1)`.

---

## Lazy Import

`get_service_container()` import các service bên trong function, không import ở top-level.

Lý do:

- import `app.core.dependencies` không tự load InsightFace/torch model;
- test schema/config nhẹ không bị chậm;
- model chỉ load khi backend thật sự gọi `get_service_container()` hoặc `create_enrollment_pipeline()`.

---

## Cache Reset

Helper:

```python
reset_dependency_cache()
```

Dùng trong test/dev khi muốn load lại config/service.

Không gọi helper này trong request bình thường vì sẽ làm backend load lại model rất tốn.

---

## Test

Compile:

```bash
python -m py_compile app/core/dependencies.py
```

Light smoke:

- import `app.core.dependencies`;
- `get_app_config()` trả config có `model`, `runtime`;
- `get_runtime_config()` trả `RuntimeConfig`;
- `reset_dependency_cache()` chạy OK.

Không chạy `get_service_container()` trong smoke test nhẹ vì hàm này load model thật.

---

## Ghi chú

- Bước này chưa tạo FastAPI app.
- Bước này chưa tạo WebSocket endpoint.
- Bước tiếp theo là `app/api/v1/enrollment.py`, `app/api/v1/router.py`, và `app/main.py` để expose WebSocket `/api/v1/enroll/ws`.
