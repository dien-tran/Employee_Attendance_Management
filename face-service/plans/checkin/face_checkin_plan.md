# 🧩 Implementation Plan — Face Check-in (WebSocket Real-time)

## Mục tiêu

Xây dựng chức năng **Chấm công bằng khuôn mặt** (Check-in / Check-out): Frontend mở camera, liên tục gửi frame qua WebSocket, Backend nhận diện khuôn mặt có anti-spoofing, tìm kiếm trong Qdrant, tra cứu trạng thái nhân viên từ MySQL, rồi ghi nhận chấm công.

> **Ranh giới nghiệp vụ:** Face_Services chỉ xử lý nhận diện khuôn mặt và ghi nhận attendance. Thông tin nhân viên (`staffs`) là dữ liệu đọc từ hệ thống HR/Attendance hoặc bảng mirror trong MySQL; service này không quản lý hồ sơ nhân viên, không tạo tài khoản, không sinh mật khẩu mặc định.

---

## 1. Pipeline Tổng Quan

```
┌──────────── FRONTEND (Next.js) ──────────────────┐      ┌──────────── BACKEND (FastAPI) ─────────────────────────────────────────┐
│                                                   │      │                                                                        │
│  Mở camera (portrait 3:4, 480×640)               │      │  Nhận frame liên tục qua WebSocket                                    │
│  Gửi frame liên tục (2-3 FPS, base64 JPEG)       │ ───► │  → Decode base64 → numpy array BGR                                    │
│  Nhận feedback realtime                          │      │  → Face Detection (RetinaFace/buffalo_l)                               │
│  ← Hiển thị bbox overlay, status text            │ ◄─── │  → Anti-Spoofing (MiniFASNet) — advisory score/debug                  │
│                                                   │      │  → Quality Gate (blur, brightness, pose, size)                        │
│  Khi nhận ATTENDANCE_SUCCESS:                    │      │  → Embedding (ArcFace 512-D)                                          │
│  ← Hiển thị thông tin nhân viên + thời gian      │      │  → Vector Search Qdrant (cosine similarity ≥ threshold)               │
│  ← Đóng WebSocket (hoặc chờ next person)         │ ◄─── │  → Tra cứu MySQL: staffs → lấy thông tin, kiểm tra Active/Inactive   │
│                                                   │      │  → Insert bảng attendances (loại, thời gian, trạng thái đúng/muộn)   │
└───────────────────────────────────────────────────┘      └────────────────────────────────────────────────────────────────────────┘
```

> **Tại sao WebSocket cho Check-in?**
> - Gửi nhiều frame liên tục → nhận diện chính xác hơn (không phụ thuộc 1 frame)
> - Backend gửi phản hồi realtime (bbox, liveness score, trạng thái đang nhận diện)
> - Khi nhận diện thành công → đóng connection, tránh check-in/check-out trùng

---

## 2. Luồng Giao Tiếp Frontend ↔ Backend

### 2.1. Phương thức: WebSocket

- **Endpoint:** `ws://localhost:8000/api/v1/checkin/ws`
- **Frontend gửi:** JSON mỗi ~400ms (2-3 FPS)
- **Backend trả:** JSON feedback mỗi frame

### 2.2. Message Schema

**Client → Server (mỗi frame):**
```json
{
  "action": "attendance_frame",
  "type": "checkin",
  "image": "data:image/jpeg;base64,/9j/..."
}
```

> `type` có thể là `"checkin"` hoặc `"checkout"` — frontend truyền khi bắt đầu session.

**Server → Client (per frame — đang xử lý):**
```json
{
  "status": "PROCESSING",
  "message": "Đang nhận diện...",
  "face_bbox": [120, 80, 380, 420],
  "anti_spoof_score": 0.94
}
```

**Server → Client (frame bị reject):**
```json
{
  "status": "REJECTED",
  "reason": "BLUR",
  "message": "Ảnh bị mờ, vui lòng giữ yên camera",
  "face_bbox": [120, 80, 380, 420]
}
```

**Server → Client (nhận diện thành công):**
```json
{
  "status": "ATTENDANCE_SUCCESS",
  "attendance_type": "checkin",
  "attendance_status": "on_time",
  "recorded_at": "2026-05-13T08:45:12+07:00",
  "employee": {
    "employee_id": "NV001",
    "full_name": "Nguyễn Văn A"
  },
  "similarity_score": 0.9234,
  "message": "Chấm công thành công! Nguyễn Văn A - 08:45"
}
```

**Server → Client (đã chấm công loại này rồi — skip):**
```json
{
  "status": "ALREADY_RECORDED",
  "attendance_type": "checkin",
  "employee": {
    "employee_id": "NV001",
    "full_name": "Nguyễn Văn A"
  },
  "message": "Nguyễn Văn A đã check-in hôm nay rồi"
}
```

**Server → Client (check-out nhưng chưa check-in trong ngày):**
```json
{
  "status": "CHECKOUT_WITHOUT_CHECKIN",
  "employee": {
    "employee_id": "NV001",
    "full_name": "Nguyễn Văn A"
  },
  "message": "Nhân viên chưa check-in hôm nay nên chưa thể check-out"
}
```

**Server → Client (không nhận ra):**
```json
{
  "status": "UNKNOWN_FACE",
  "message": "Khuôn mặt không được nhận ra trong hệ thống",
  "similarity_score": 0.4123,
  "threshold": 0.55
}
```

**Server → Client (nhân viên inactive):**
```json
{
  "status": "EMPLOYEE_INACTIVE",
  "employee_id": "NV002",
  "message": "Nhân viên đã nghỉ việc, không thể chấm công"
}
```

---

## 3. Chi Tiết Từng Bước Backend

### Bước 1 — Nhận Frame & Decode

```python
# app/utils/image.py (đã có)
image = decode_base64_image(payload["image"])  # → np.ndarray BGR
```

### Bước 2 — Face Detection (InsightFace buffalo_l)

- Giống Enrollment: dùng singleton `FaceDetector` từ `get_service_container()`
- Reject: `NO_FACE`, `MULTIPLE_FACES`, `LOW_CONFIDENCE`, `FACE_OUT_OF_FRAME`
- Output: `DetectedFace` (bbox, kps, pose, normed_embedding, det_score)

### Bước 3 — Anti-Spoofing (MiniFASNet)

- Dùng singleton `AntiSpoofingService` từ `get_service_container()`
- Tạm giữ chế độ `advisory`: luôn chạy anti-spoofing trên mọi frame để lấy `live_score`, `predicted_label`, `model_scores`, `crop_boxes` phục vụ debug/calibration, nhưng **chưa reject** check-in/check-out chỉ vì liveness thấp
- Lý do: hiện chưa có model anti-spoofing thay thế hoặc calibration đủ ổn định để chặn nghiệp vụ chấm công thật
- Khi có model/calibration đáng tin hơn, có thể bật lại chế độ strict bằng config riêng, ví dụ `checkin.enforce_liveness: true`

### Bước 4 — Quality Gate

| Kiểm tra | Ngưỡng | Reject code |
|----------|--------|-------------|
| Blur (Laplacian var) | `quality.blur_threshold` (hiện tại 100) | `BLUR` |
| Độ sáng | `quality.min_brightness` ≤ mean ≤ `quality.max_brightness` | `TOO_DARK` / `TOO_BRIGHT` |
| Kích thước mặt / ảnh | ≥ 5% | `FACE_TOO_SMALL` |
| Yaw (quay ngang) | ≤ `quality.max_yaw_deg` | `BAD_POSE` |
| Pitch (ngẩng/cúi) | ≤ `quality.max_pitch_deg` | `BAD_POSE` |

> Có thể nới pose cho check-in bằng config riêng (`checkin_quality`) nếu cần trải nghiệm dễ hơn enrollment, nhưng mặc định nên tái dùng `quality` hiện có để tránh lệch hành vi.

### Bước 5 — Embedding

- Dùng `face.normed_embedding` (512-D, L2-normalized) từ InsightFace
- Chỉ đọc embedding sau khi frame đã qua Detection → Anti-Spoofing advisory → Quality Gate
- **Không cần average nhiều frame** — check-in cần tốc độ nhanh
- Dùng embedding của frame hiện tại để search ngay

### Bước 6 — Vector Search (Qdrant)

```python
results = vector_db.search_face(
    embedding=embedding,
    limit=1,
    score_threshold=config["checkin"]["similarity_threshold"],
)
```

- Nếu không tìm thấy kết quả nào → `UNKNOWN_FACE`
- Nếu có → lấy `employee_id` từ `results[0].payload`
- `similarity_score = results[0].score`
- Validate payload Qdrant phải có ít nhất `employee_id`; `full_name` có thể dùng làm fallback hiển thị nếu MySQL tạm lỗi hoặc chưa có bảng mirror

### Bước 7 — Tra Cứu MySQL (`staffs` / employee mirror)

```sql
SELECT employee_id, full_name, department, position, status
FROM staffs
WHERE employee_id = %s
```

- Nếu không tìm thấy → `EMPLOYEE_NOT_FOUND` (inconsistency giữa Qdrant và MySQL)
- Nếu `status = 'inactive'` → trả `EMPLOYEE_INACTIVE`, không ghi chấm công
- `staffs` là bảng/view đọc từ hệ thống nhân sự hoặc mirror phục vụ tích hợp; Face_Services không tạo/sửa hồ sơ nhân viên

### Bước 8 — Kiểm Tra Trùng & Insert Bảng Attendances

**Bước 8a — Kiểm tra đã chấm công chưa (TRƯỚC khi insert):**
```sql
SELECT id FROM attendances
WHERE employee_id = %s
  AND type = %s
  AND check_date = %s
LIMIT 1
```
- `check_date` phải tính theo `attendance.timezone` ở backend, không phụ thuộc ngày hiện tại của DB server
- Nếu **đã tồn tại bản ghi** cùng `employee_id` + `type` + `check_date` → **skip** (không insert), trả `ALREADY_RECORDED` và đóng WebSocket
- Nếu **chưa có** → tiếp tục bước 8b

**Bước 8b — Rule riêng cho check-out:**
```sql
SELECT id FROM attendances
WHERE employee_id = %s
  AND type = 'checkin'
  AND check_date = %s
LIMIT 1
```
- Nếu `attendance_type = 'checkout'` nhưng chưa có check-in trong ngày → trả `CHECKOUT_WITHOUT_CHECKIN`, không insert

**Bước 8c — Tính trạng thái đúng/muộn:**
```python
CHECKIN_DEADLINE = time(8, 0)    # 08:00 sáng — sau giờ này → late (đọc từ config)
CHECKOUT_START   = time(16, 30)  # 16:30 chiều — trước giờ này → early (đọc từ config)

now = datetime.now(tz=LOCAL_TZ).time()
if attendance_type == "checkin":
    status = "on_time" if now <= CHECKIN_DEADLINE else "late"
else:
    status = "on_time" if now >= CHECKOUT_START else "early"
```

**Bước 8d — Insert bản ghi chấm công:**
```sql
INSERT INTO attendances (employee_id, type, check_time, check_date, status, similarity_score)
VALUES (%s, %s, %s, %s, %s, %s)
```

- `type`: `'checkin'` hoặc `'checkout'`
- `check_time`: thời gian thực tế (datetime với timezone)
- `check_date`: ngày chấm công (DATE)
- `status`: `'on_time'` / `'late'` / `'early'`
- Có unique constraint `(employee_id, type, check_date)` để chống race condition khi nhiều frame/request gần nhau cùng insert

### Bước 9 — Trả Kết Quả & Đóng Connection

- Gửi `ATTENDANCE_SUCCESS`, `ALREADY_RECORDED`, `CHECKOUT_WITHOUT_CHECKIN`, hoặc lỗi session khác → đóng WebSocket từ server side
- Frontend nhận → hiển thị overlay tên + trạng thái trực tiếp trên khung camera → sau 3-4s tự reset, mở lại camera chờ người tiếp theo

---

## 4. Chiến Lược Nhận Diện Multi-Frame

Check-in không cần tích lũy N frame như Enrollment. Thay vào đó dùng **Confidence Accumulation**:

```
Frame 1: similarity = 0.58 → cộng điểm (dưới ngưỡng cao)
Frame 2: similarity = 0.72 → cộng điểm
Frame 3: similarity = 0.81 → VẪN cùng employee_id → xác nhận → ATTENDANCE_SUCCESS
```

**Thuật toán:**
1. Mỗi frame đạt quality → search Qdrant
2. Nếu `score ≥ high_threshold (0.75)` với cùng `employee_id` **2 lần liên tiếp** → check-in ngay
3. Nếu `score ≥ low_threshold (0.55)` với cùng `employee_id` **3 lần** → check-in
4. Nếu candidate `employee_id` đổi giữa chừng → reset `consecutive_high` và vote counter cho candidate cũ
5. Nếu `score < low_threshold` → `UNKNOWN_FACE` (gửi feedback, không đóng connection)
6. Timeout sau 30 giây → đóng connection

> Cách này tránh false positive từ 1 frame nhiễu, đồng thời vẫn nhanh (~1-2 giây thực tế).

---

## 5. Database Schema

### Bảng/View `staffs` (đọc từ hệ thống nhân sự)

Face_Services cần đọc được tối thiểu các field sau để xác thực trạng thái nhân viên sau khi Qdrant trả `employee_id`. Nếu dự án chạy độc lập khi demo, có thể tạo bảng mirror tối giản này; không đưa các trường nhạy cảm như thông tin đăng nhập, tài khoản ngân hàng, CCCD vào plan check-in.

```sql
CREATE TABLE staffs (
    employee_id     VARCHAR(20)     PRIMARY KEY,
    full_name       VARCHAR(100)    NOT NULL,
    department      VARCHAR(100),
    position        VARCHAR(100),
    status          ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

> Không sinh password từ ngày sinh. Việc quản lý tài khoản/mật khẩu thuộc service khác và cũng không cần cho luồng nhận diện chấm công.

### Bảng `attendances`

```sql
CREATE TABLE attendances (
    id              BIGINT          PRIMARY KEY AUTO_INCREMENT,
    employee_id     VARCHAR(20)     NOT NULL,
    type            ENUM('checkin', 'checkout') NOT NULL,
    check_time      DATETIME        NOT NULL,           -- Thời điểm chấm công (datetime đầy đủ)
    check_date      DATE            NOT NULL,           -- Ngày chấm công (để query theo ngày)
    status          ENUM('on_time', 'late', 'early') NOT NULL,
    similarity_score FLOAT,                             -- Score nhận diện (debug/audit)
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES staffs(employee_id),
    UNIQUE KEY uq_attendance_emp_type_date (employee_id, type, check_date)
);

-- Index tối ưu query chấm công theo ngày
CREATE INDEX idx_attendance_date     ON attendances(check_date);
CREATE INDEX idx_attendance_emp_date ON attendances(employee_id, check_date);
```

---

## 6. Cấu Trúc Thư Mục — Các File Cần Thêm Mới

```
Face_Services/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── router.py               # [MODIFY] Thêm include checkin router
│   │       └── checkin.py              # [NEW] WebSocket /api/v1/checkin/ws
│   │
│   ├── pipeline/
│   │   ├── enrollment.py               # [EXISTING - không đổi]
│   │   └── checkin.py                  # [NEW] CheckinPipeline — orchestrate per-frame
│   │
│   ├── services/
│   │   ├── detection.py                # [EXISTING - tái dùng]
│   │   ├── anti_spoofing.py            # [EXISTING - tái dùng]
│   │   ├── preprocessing.py            # [EXISTING - tái dùng]
│   │   ├── embedding.py                # [EXISTING - tái dùng]
│   │   ├── vector_db.py                # [EXISTING - tái dùng, thêm search_face()]
│   │   ├── mysql_db.py                 # [NEW] MySQL access: read staffs, write attendances
│   │   └── attendance.py               # [NEW] Logic tính on_time/late, insert
│   │
│   ├── schemas/
│   │   ├── enrollment.py               # [EXISTING - không đổi]
│   │   └── checkin.py                  # [NEW] Pydantic models checkin request/response
│   │
│   └── core/
│       ├── config.py                   # [MODIFY] Thêm đọc checkin config section
│       ├── dependencies.py             # [MODIFY] Thêm get_mysql_service(), create_checkin_pipeline()
│       └── exceptions.py               # [MODIFY] Thêm CheckinError + error codes
│
├── config/
│   └── config.yaml                     # [MODIFY] Thêm checkin + mysql + attendance sections
│
├── sql/
│   └── 01_create_attendance_tables.sql # [NEW] DDL attendances + optional staffs mirror cho demo
│
└── frontend/                           # [MODIFY] Thêm trang Check-in
    └── src/
        └── app/
            ├── page.tsx                # [EXISTING] Enrollment page
            └── checkin/
                └── page.tsx            # [NEW] Check-in page
```

**Phân layer checkin:**
```
API Layer      →  app/api/v1/checkin.py        (WebSocket, nhận frame, gửi feedback)
     ↓
Pipeline Layer →  app/pipeline/checkin.py      (confidence accumulation, session state)
     ↓
Service Layer  →  app/services/*.py            (detect, spoof, quality, embed, search, mysql)
     ↓
Data Layer     →  Qdrant (vector search) + MySQL (staffs + attendances)
```

---

## 7. Model AI Sử Dụng

| Model | Thư viện | Chức năng | Ghi chú |
|-------|----------|-----------|---------|
| **RetinaFace** | InsightFace `buffalo_l` | Face Detection + Landmarks | Singleton, đã có |
| **ArcFace** (ResNet50) | InsightFace `buffalo_l` | Face Embedding 512-D | Singleton, đã có |
| **MiniFASNet** | Silent-Face-Anti-Spoofing | Liveness Detection | Singleton, đã có |

> Không cần thêm model mới cho check-in. Tái dùng toàn bộ service layer từ Enrollment.

---

## 8. Config Bổ Sung (`config/config.yaml`)

```yaml
# ── Check-in ──
checkin:
  similarity_threshold: 0.55        # Ngưỡng tối thiểu cosine similarity để nhận diện
  high_confidence_threshold: 0.75   # Ngưỡng cao — chỉ cần 2 frame liên tiếp
  required_consecutive_high: 2      # Số frame score cao liên tiếp để confirm
  required_low_votes: 3             # Số frame score vừa để confirm
  session_timeout_sec: 30           # Tự đóng connection sau 30s không nhận ra
  frame_interval_ms: 400            # Frontend gửi mỗi 400ms
  enforce_liveness: false           # Tạm thời advisory; bật true khi model/calibration anti-spoofing ổn định

# ── Attendance Rules ──
attendance:
  checkin_deadline: "08:00"         # Sau 08:00 → late
  checkout_start:  "16:30"          # Trước 16:30 → early checkout
  timezone: "Asia/Ho_Chi_Minh"
  require_checkin_before_checkout: true

# ── MySQL ──
mysql:
  host: "localhost"
  port: 3306
  database: "attendance_db"
  user: "user"
  password: "user_password"
  pool_size: 5
  pool_timeout: 30
```

> `mysql` hiện đã có trong `config/config.yaml`; phần cần bổ sung chủ yếu là `checkin`, `attendance`, và các tham số pool nếu dùng connection pool.

---

## 9. Dependencies Cần Thêm

```txt
# Thêm vào requirements-cpu.txt và requirements-gpu.txt
aiomysql==0.2.*        # Async MySQL driver cho FastAPI
PyMySQL==1.1.*         # Optional: sync migration/init script nếu không dùng aiomysql cho setup
```

---

## 10. Xử Lý Lỗi Check-in

| Error Code | Khi nào | Per-frame? |
|------------|---------|-----------|
| `INVALID_MESSAGE` | Payload thiếu action/image | Session |
| `INVALID_IMAGE` | Base64 decode fail | Frame |
| `NO_FACE` | Không có mặt trong frame | Frame |
| `MULTIPLE_FACES` | Nhiều hơn 1 mặt | Frame |
| `LOW_CONFIDENCE` | Detector thấy mặt nhưng confidence thấp | Frame |
| `FACE_OUT_OF_FRAME` | Khuôn mặt chưa nằm trọn trong khung hình | Frame |
| `SPOOF_DETECTED` | Dự phòng khi bật `checkin.enforce_liveness: true`; hiện tại advisory nên không reject theo code này | Frame |
| `BLUR` | Ảnh mờ | Frame |
| `TOO_DARK` / `TOO_BRIGHT` | Ánh sáng không đạt | Frame |
| `BAD_POSE` | Góc quay mặt quá lớn | Frame |
| `FACE_TOO_SMALL` | Quá xa camera | Frame |
| `UNKNOWN_FACE` | Không tìm thấy trong Qdrant | Frame |
| `ALREADY_RECORDED` | Đã chấm công loại này trong ngày | Session (đóng WS) |
| `CHECKOUT_WITHOUT_CHECKIN` | Check-out khi chưa có check-in cùng ngày | Session (đóng WS) |
| `EMPLOYEE_INACTIVE` | Nhân viên không còn làm việc | Session (đóng WS) |
| `EMPLOYEE_NOT_FOUND` | Qdrant có nhưng MySQL không có | Session |
| `DB_ERROR` | MySQL lỗi khi insert | Session |
| `SESSION_TIMEOUT` | Quá 30s không nhận diện được | Session (đóng WS) |

---

## 11. Frontend — Trang Check-in (`/checkin`)

### UI Layout

Toàn bộ thông tin hiển thị **trực tiếp trên khung camera** dưới dạng overlay — không có panel thông tin bên ngoài.

```
┌────────────────────────────────────────────────────────┐
│  [Check-in]  [Check-out]          Thứ Ba, 13/05/2026  │
│  ╔══════════════════════════════════════╗              │
│  ║                                      ║              │
│  ║         (Camera Video Feed)          ║              │
│  ║                                      ║              │
│  ║    ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    ║              │
│  ║    │   [Bounding Box mặt]      │    ║              │
│  ║    └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    ║              │
│  ║                                      ║              │
│  ║  🔵 Đang nhận diện...                ║  ← overlay  │
│  ╚══════════════════════════════════════╝              │
└────────────────────────────────────────────────────────┘
```

**Khi ATTENDANCE_SUCCESS — overlay trên camera:**
```
│  ╔══════════════════════════════════════╗
│  ║  ┌──────────────────────────────┐    ║
│  ║  │  ✅ Nguyễn Văn A             │    ║
│  ║  │  Check-in thành công · 08:45 │    ║  ← overlay xanh lá
│  ║  └──────────────────────────────┘    ║
│  ╚══════════════════════════════════════╝
   (Tự reset sau 3 giây, camera mở lại chờ người tiếp)
```

**Khi ALREADY_RECORDED — overlay trên camera:**
```
│  ║  ┌──────────────────────────────┐    ║
│  ║  │  ℹ️ Nguyễn Văn A             │    ║
│  ║  │  Đã check-in hôm nay rồi    │    ║  ← overlay vàng
│  ║  └──────────────────────────────┘    ║
```

### Kỹ thuật Frontend

- **Camera:** `getUserMedia({ video: { aspectRatio: 3/4, width: 720, height: 960 } })`
- **Canvas:** Resize về 480×640 (portrait 3:4) trước khi gửi
- **FPS:** Gửi 1 frame/400ms (2.5 FPS) — đủ để nhận diện, không overload backend
- **Preview:** Hiển thị canvas (không phải video tag) để bbox overlay khớp tọa độ backend
- **Clock:** `setInterval` cập nhật đồng hồ real-time mỗi giây ở header
- **Type Switch:** Nút toggle Check-in / Check-out gửi `type` khác nhau khi kết nối WS
- **Overlay:** Sau khi nhận `ATTENDANCE_SUCCESS`, `ALREADY_RECORDED`, hoặc `CHECKOUT_WITHOUT_CHECKIN`, hiển thị overlay lên canvas với tên + trạng thái → 3 giây sau tự đóng WS, reset và mở camera lại
- **Không có panel thông tin bên ngoài camera** — tất cả feedback hiển thị ngay trên khung hình

---

## 12. Thứ Tự Triển Khai

| # | Việc cần làm | Ưu tiên | Phụ thuộc |
|---|-------------|---------|-----------|
| 1 | Viết `sql/01_create_attendance_tables.sql` (DDL attendances + optional staffs mirror tối giản cho demo) | 🔴 Cao | — |
| 2 | Cập nhật `docker-compose.yml` — init SQL khi MySQL start | 🔴 Cao | #1 |
| 3 | Thêm section `checkin`, `attendance` và pool options cho `mysql` vào `config/config.yaml` | 🔴 Cao | — |
| 4 | Viết `app/services/mysql_db.py` (pool + read staffs + write attendances, không quản lý hồ sơ nhân viên) | 🔴 Cao | #3 |
| 5 | Viết `app/services/attendance.py` (tính on_time/late, insert record) | 🔴 Cao | #4 |
| 6 | Thêm `search_face()` vào `app/services/vector_db.py` | 🔴 Cao | — |
| 7 | Viết `app/schemas/checkin.py` (Pydantic models) | 🟡 TB | — |
| 8 | Thêm `CheckinError` vào `app/core/exceptions.py` | 🟡 TB | — |
| 9 | Cập nhật `app/core/dependencies.py` — thêm MySQL singleton + checkin pipeline factory | 🔴 Cao | #4 |
| 10 | Viết `app/pipeline/checkin.py` (confidence accumulation session) | 🔴 Cao | #4,5,6 |
| 11 | Viết `app/api/v1/checkin.py` (WebSocket endpoint) | 🔴 Cao | #10 |
| 12 | Cập nhật `app/api/v1/router.py` — include checkin router | 🔴 Cao | #11 |
| 13 | Viết `frontend/src/app/checkin/page.tsx` (UI + WS client) | 🟡 TB | #12 |
| 14 | Test end-to-end: Docker up → Enroll → Check-in → Check-out → Verify MySQL record | 🔴 Cao | #1-13 |

---

## 13. Quy Tắc Nghiệp Vụ Đã Xác Nhận

| # | Quy tắc | Giá trị |
|---|---------|--------|
| 1 | Check-in muộn sau | **08:00** |
| 2 | Check-out sớm trước | **16:30** |
| 3 | Check-in/check-out trùng trong ngày | **Skip** — trả `ALREADY_RECORDED`, không insert |
| 4 | Check-out khi chưa check-in | **Reject** — trả `CHECKOUT_WITHOUT_CHECKIN`, không insert |
| 5 | Seed data | **Không cần** ở giai đoạn này; chỉ tạo staffs mirror tối giản nếu demo local cần |
| 6 | UI sau nhận diện | **Overlay trên camera**: tên + trạng thái, không có panel ngoài |
| 7 | Quản lý nhân viên/password | **Out of scope** của Face_Services |
