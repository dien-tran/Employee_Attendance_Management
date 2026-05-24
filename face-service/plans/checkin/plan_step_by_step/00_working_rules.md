# Step 00 — Working Rules and Code Comment Standard

## Mục tiêu

Đặt quy tắc chung trước khi triển khai Face Check-in / Check-out.

## Quy trình bắt buộc

1. Mỗi bước phải được người dùng duyệt trước khi code.
2. Chỉ code đúng bước/file plan đã được duyệt.
3. Sau mỗi bước phải chạy kiểm tra phù hợp và báo kết quả.
4. Sau mỗi bước đã code xong, bắt buộc xuất file báo cáo kết quả vào `plans/checkin/result/`.
5. Không tự ý mở rộng sang quản lý nhân viên, tài khoản, mật khẩu hoặc dashboard.
6. Anti-spoofing hiện giữ `advisory`: vẫn chạy và trả debug score, nhưng chưa chặn attendance theo liveness thấp.

## Quy chuẩn comment/docstring Python

Mỗi class/service/pipeline mới phải có docstring mô tả trách nhiệm.

Mỗi public method hoặc helper quan trọng phải có docstring gồm:

- `Args`: tham số đầu vào, kiểu dữ liệu, ví dụ giá trị.
- `Returns`: dữ liệu trả về, kiểu dữ liệu, ví dụ giá trị.
- `Raises`: lỗi có thể phát sinh nếu hàm raise lỗi có chủ đích.

Các block nghiệp vụ dễ nhầm phải có comment ngắn:

- Timezone.
- Chống ghi trùng.
- Confidence accumulation.
- MySQL transaction.
- Anti-spoofing advisory/strict switch.

Ví dụ:

```python
def search_face(self, embedding: np.ndarray, limit: int, score_threshold: float) -> list[FaceSearchHit]:
    """Search enrolled face embeddings in Qdrant.

    Args:
        embedding: Vector ArcFace 512-D đã L2-normalized. Example: np.ndarray shape (512,).
        limit: Số kết quả tối đa cần lấy. Example: 1.
        score_threshold: Ngưỡng cosine similarity tối thiểu. Example: 0.55.

    Returns:
        Danh sách FaceSearchHit sắp xếp theo score giảm dần. Empty list nếu không có match.

    Raises:
        ValueError: Nếu embedding sai shape hoặc có NaN/Inf.
    """
```

## Quy chuẩn comment TypeScript/React

- Hàm xử lý camera phải ghi rõ input là video/canvas nào và output là gì.
- Hàm gửi WebSocket phải ghi rõ payload gửi backend.
- Hàm xử lý response phải ghi rõ status nào là terminal và status nào tiếp tục session.
- Type/interface map schema backend thì giữ tên field giống backend.

## Trạng thái hiện tại cần giữ

- Enrollment WebSocket đang ở `/api/v1/enroll/ws`.
- Service AI nặng đã dùng singleton qua `get_service_container()`.
- Qdrant service đã có `upsert_face_embedding(...)`, chưa có `search_face(...)`.
- MySQL config đã có cơ bản, chưa có MySQL service.
- Frontend enrollment đã dùng camera canvas 4:3 cho laptop/webcam ngang.

## Quy chuẩn báo cáo kết quả

Sau khi hoàn thành mỗi step, tạo file report trong:

`plans/checkin/result/`

Tên file đề xuất:

`step_XX_<short_name>_result.md`

Report phải có:

- Status.
- Plan file.
- Files đã tạo/sửa.
- Summary.
- Verification đã chạy.
- Việc chưa chạy được hoặc bị chặn.
- Follow-up/step tiếp theo.
