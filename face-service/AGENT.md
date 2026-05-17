# Face Services - AI Agent Instructions

Đây là tài liệu hướng dẫn (Guidelines) dành cho các AI Agent khi làm việc trong dự án **Face Services**. Các Agent phải tuân thủ nghiêm ngặt các quy tắc và ngữ cảnh dưới đây trước khi thực hiện thay đổi mã nguồn.

---

## 1. Thông tin chung (Project Context)

**Face Services** là một microservice quản lý việc Đăng ký (Enrollment) và Nhận diện chấm công (Check-in/Check-out) bằng khuôn mặt.

### Tech Stack
- **Backend:** Python 3, FastAPI
- **AI Models:** 
  - **InsightFace (`buffalo_l`)**: Dùng RetinaFace để Detect/Align và ArcFace để Embedding (512-D).
  - **MiniFASNet**: Dùng cho Liveness Detection (Chống giả mạo ảnh/màn hình).
- **Databases:** 
  - **Qdrant**: Vector Database lưu trữ face embeddings (Docker).
  - **MySQL**: Relational Database lưu trữ thông tin nhân viên (Docker).
- **Frontend (Testing):** Next.js 15+, TailwindCSS, TypeScript.

---

## 2. Cấu trúc thư mục (Directory Structure)

Thư mục gốc của repository đóng vai trò là thư mục root của **Backend**.

```text
Face_Services/
├── app/                  # Mã nguồn chính của Backend (FastAPI)
│   ├── api/v1/           # API Endpoints & WebSocket routers
│   ├── pipeline/         # Điều phối luồng xử lý (Enrollment, Checkin)
│   ├── services/         # Module xử lý AI (detection.py, embedding.py, vector_db.py)
│   ├── schemas/          # Pydantic models (Request/Response validation)
│   ├── core/             # Cấu hình hệ thống, exceptions, dependencies
│   └── utils/            # Helper functions (Base64 decode, image processing)
├── config/               # Chứa config.yaml (model thresholds, DB connection)
├── models/               # Chứa model weights (Không push lên Git)
├── frontend/             # Dự án Next.js dùng làm UI test tạm thời
├── docker-compose.yml    # Chạy Backend, Qdrant & MySQL
├── requirements-gpu.txt  # Thư viện cho máy có GPU (onnxruntime-gpu)
└── requirements-cpu.txt  # Thư viện cho máy không có GPU (onnxruntime)
```

---

## 3. Quy tắc cốt lõi (Core Rules for AI Agent)

### 3.1. Quy tắc làm việc chung
1. **Tuân thủ chỉ thị:** Chỉ viết code/chỉnh sửa ở những file mà User yêu cầu cụ thể. **KHÔNG** tự động viết toàn bộ code từ A-Z nếu không được yêu cầu.
2. **Không phá vỡ cấu trúc:** Giữ đúng kiến trúc 3-layer của Backend (`API` → `Pipeline` → `Service`).
3. **Cấu hình động:** Mọi tham số như ngưỡng (`threshold`), kích thước (`det_size`), DB Host đều phải đọc từ `config/config.yaml`, không được hardcode trong code Python.

### 3.2. Quy tắc Pipeline AI (Rất quan trọng)
1. **Quality Gate là ưu tiên:** Mọi frame ảnh nhận được phải đi theo thứ tự `Detection → Anti-Spoofing → Quality Gate → Embedding`. Quality Gate kiểm tra Blur, Brightness, Pitch/Yaw ≤ 20°, Face size và phải chạy TRƯỚC khi đưa frame vào trích xuất đặc trưng (Embedding). Những frame nhiễu, nhắm mắt, quay mặt phải bị loại bỏ để không làm sai lệch kết quả.
2. **Luật tính trung bình (Average Embeddings):** 
   - Trong quá trình Enrollment (thu thập nhiều frame), Agent sẽ tính toán Average vector từ các frame đạt chuẩn.
   - **BẮT BUỘC:** Sau khi tính average (`np.mean`), phải thực hiện chuẩn hóa L2 (L2-normalize) lại vector đó trước khi lưu vào Qdrant để phép tính Cosine Similarity hoạt động chính xác.
   - `EmbeddingService.average_and_normalize(...)` trong `app/services/embedding.py` là nơi tạo final embedding cho Enrollment. Không lưu vector average chưa normalize vào Qdrant.
   - Chỉ lưu final embedding vào Qdrant thông qua `VectorDBService` trong `app/services/vector_db.py`. Collection Qdrant phải dùng `Distance.COSINE` và `embedding_dim` từ `config/config.yaml`.
3. **Anti-Spoofing:** Bắt buộc áp dụng kiểm tra Liveness/Anti-spoofing trên **tất cả** các frame đầu vào ở Backend. Khi live score thấp bất thường, ưu tiên debug bằng `crop_boxes`/`debug_crop_paths` từ `AntiSpoofResult` để kiểm tra crop thực tế trước khi đổi threshold hoặc đổi label mapping. `anti_spoof_color_space` mặc định là `bgr` theo OpenCV/upstream; chỉ đổi sang `rgb` để kiểm chứng calibration.
4. **Metadata Enrollment:** Payload đăng ký/lưu Qdrant phải dùng field `date_of_birth` cho ngày sinh nhân viên, định dạng ISO date `YYYY-MM-DD` (ví dụ `1998-04-21`). Không dùng `dob` hoặc định dạng `DD/MM/YYYY`.
5. **Exception chuẩn:** Pipeline/API phải dùng `EnrollmentError` trong `app/core/exceptions.py` cho lỗi enrollment có cấu trúc. Lỗi per-frame trả `status: "REJECTED"` và `reason` như `NO_FACE`, `BLUR`, `SPOOF_DETECTED`; lỗi cấp session trả `status: "ERROR"` như `TIMEOUT`, `VECTOR_DB_ERROR`.
6. **Schema WebSocket:** Message enrollment từ frontend phải validate bằng `parse_enrollment_capture_message(...)` trong `app/schemas/enrollment.py` trước khi decode ảnh hoặc chạy model. Schema bắt buộc `action: "capture"`, `employee_id`, `full_name`, `date_of_birth` ISO `YYYY-MM-DD`, và `image`.
7. **Enrollment Pipeline:** Luồng multi-frame phải đi qua `EnrollmentPipeline` trong `app/pipeline/enrollment.py`. Mỗi WebSocket connection nên tạo một pipeline/session riêng; pipeline giữ `accepted_count`, gom `good_embeddings`, tính score averages, gọi `EmbeddingService.average_and_normalize(...)`, rồi lưu Qdrant bằng `VectorDBService`.
8. **Dependency Singleton:** API layer phải tạo pipeline qua `create_enrollment_pipeline()` trong `app/core/dependencies.py`. Không khởi tạo trực tiếp `FaceDetector`, `AntiSpoofingService`, hay load model trong endpoint/frame loop; các service nặng phải dùng singleton từ `get_service_container()`.
9. **WebSocket API:** Endpoint enrollment chuẩn là `/api/v1/enroll/ws` trong `app/api/v1/enrollment.py`. Endpoint chỉ nhận JSON object, tạo một pipeline cho mỗi connection, gửi response từ `pipeline.handle_capture_payload(...)`, và đóng connection khi nhận `ENROLLMENT_COMPLETE` hoặc lỗi session `ERROR`.
10. **Integration Test:** Trước khi test end-to-end thật, phải kiểm tra `python -m compileall -q app`, import `app.main:app`, health route `/health`, khởi tạo `get_service_container()` để xác nhận model load được, và Docker/Qdrant phải chạy trước khi test lưu vector thật. Khi truyền `point_id` thủ công cho Qdrant, chỉ dùng unsigned integer hoặc UUID string; không dùng string tự do như `employee_id`.
11. **Frontend Enrollment Test:** Frontend test ở `frontend/src/app/page.tsx` phải gửi WebSocket payload đúng schema gồm `action`, `employee_id`, `full_name`, `date_of_birth`, `image`. UI phải hiển thị `accepted_count/required_count`, `REJECTED` reason, anti-spoofing accuracy từ `anti_spoof_score`/`details.live_score`, bounding box từ `face_bbox`/`details.face_bbox`, và `ENROLLMENT_COMPLETE` embedding id. Khi mở camera, frontend nên yêu cầu stream portrait/vertical bằng constraint `aspectRatio: 3/4`, `width: 720`, `height: 960`. Frame gửi backend phải giữ canvas portrait `3:4` resize `480x640`, nhưng ưu tiên fit/contain toàn bộ webcam frame thay vì center-crop phóng to mặt. Preview phải hiển thị chính canvas gửi backend, không hiển thị raw `<video>`, để bbox overlay khớp hệ tọa độ backend. Nếu `crop_boxes` bị clamp gần full frame nghĩa là người dùng đang quá gần camera hoặc capture đang phóng mặt quá lớn. Không dùng `next/font/google` nếu môi trường build không có network.

### 3.3. Quy tắc làm việc với Frontend (Next.js)
1. Frontend ở đây đóng vai trò môi trường test/prototype nhanh.
2. Giao tiếp giữa Frontend và Backend cho quy trình lấy nhiều frame phải sử dụng **WebSocket** để nhận feedback realtime.
3. Chú ý tính bất đồng bộ (Asynchronous) của State trong React (Sử dụng `useEffect` để bắt các thay đổi của DOM elements như `<video>`).

---

## 4. Các lệnh phát triển (Dev Commands)

- **Khởi động Database:** `docker compose up -d mysql qdrant`
- **Khởi động Backend bằng Docker:** `docker compose up -d backend` (tự kéo/chạy Qdrant + MySQL, backend mặc định tại `http://127.0.0.1:8000`)
- **Khởi động Backend bằng Docker ở port khác:** đặt `BACKEND_PORT` cho host port, ví dụ PowerShell: `$env:BACKEND_PORT="8083"; docker compose up -d backend`. Container vẫn nghe nội bộ ở port `8000`, chỉ port publish ra máy host thay đổi.
- **Deploy bằng file env:** copy `.env.production.example` thành `.env`, thay các password/URL production, rồi chạy `docker compose up -d --build`.
- **Khởi động UI Test:** `cd frontend && npm run dev`
- **Frontend kết nối Backend port khác:** khi backend chạy ở `8083`, đặt WebSocket env trước khi chạy frontend, ví dụ PowerShell:
  - `$env:NEXT_PUBLIC_ENROLLMENT_WS_URL="ws://127.0.0.1:8083/api/v1/enroll/ws"`
  - `$env:NEXT_PUBLIC_ATTENDANCE_WS_URL="ws://127.0.0.1:8083/api/v1/checkin/ws"`
  - `npm run dev`
- **Cài đặt thư viện Python CPU:** `pip install -r requirements-cpu.txt` và giữ `runtime.device: "cpu"` trong `config/config.yaml`
- **Cài đặt thư viện Python GPU:** `pip install -r requirements-gpu.txt` và đổi `runtime.device: "gpu"` trong `config/config.yaml` sau khi CUDA/cuDNN đã sẵn sàng

### 4.1. Port backend khi deploy Docker

- `BACKEND_PORT` là port trên máy host/deploy server, mặc định `8000`.
- Port trong container vẫn là `8000` vì `Dockerfile`, Uvicorn command và healthcheck đang dùng port này.
- `docker-compose.yml` tự đọc file `.env` ở root repo. File `.env.production.example` là template production, không chứa secret thật.
- Ví dụ chạy backend trên `8083`:

```powershell
$env:BACKEND_PORT="8083"
docker compose up -d backend
```

- Sau đó healthcheck từ host:

```powershell
Invoke-WebRequest http://127.0.0.1:8083/health
```

- Nếu dùng frontend local, nhớ đổi `NEXT_PUBLIC_ENROLLMENT_WS_URL` và `NEXT_PUBLIC_ATTENDANCE_WS_URL` sang port host mới.

### 4.2. Env production

- File mẫu: `.env.production.example`.
- Khi deploy production:

```powershell
Copy-Item .env.production.example .env
notepad .env
docker compose up -d --build
```

- Các biến nhạy cảm phải đổi trước khi deploy:
  - `MYSQL_PASSWORD`
  - `MYSQL_ROOT_PASSWORD`
- Các biến frontend public cần trỏ về host/port backend public:
  - `NEXT_PUBLIC_ENROLLMENT_WS_URL`
  - `NEXT_PUBLIC_ATTENDANCE_WS_URL`
- Nếu frontend chạy bằng Next.js trong thư mục `frontend/`, Next chỉ tự đọc env trong project frontend hoặc env của process. Có thể copy hai biến `NEXT_PUBLIC_*` vào `frontend/.env.local` khi chạy local.
