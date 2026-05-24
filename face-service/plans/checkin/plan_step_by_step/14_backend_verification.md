# Step 14 — Backend Verification

## Mục tiêu

Kiểm tra backend sau khi triển khai các bước code.

## Lệnh dự kiến

```powershell
python -m compileall -q app
```

Import app:

```powershell
python -c "from app.main import app; print(app.title if hasattr(app, 'title') else 'ok')"
```

Nếu server đang chạy:

- Kiểm tra `/health`.
- Kiểm tra WebSocket route tồn tại.

Nếu Docker đang chạy:

- Kiểm tra Qdrant collection.
- Kiểm tra MySQL connection.
- Kiểm tra bảng `attendances`.

## Tiêu chí nghiệm thu

- Compile pass.
- Import app pass.
- Không load model nhiều lần ngoài singleton.
- Không có lỗi config thiếu key.

## Ghi chú

Nếu cần lệnh network/Docker bị sandbox chặn, phải xin quyền theo cơ chế approval trước.

