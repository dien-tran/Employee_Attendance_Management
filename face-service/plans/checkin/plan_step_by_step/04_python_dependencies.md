# Step 04 — Python Dependencies for MySQL

## Mục tiêu

Thêm dependency để backend truy cập MySQL.

## File dự kiến

- `requirements-cpu.txt`.
- `requirements-gpu.txt`.

## Dependency dự kiến

- `aiomysql==0.2.*`: async MySQL driver cho FastAPI.
- `PyMySQL==1.1.*`: chỉ thêm nếu cần sync migration/init script.

## Không thêm

- Không thêm `bcrypt`.
- Không thêm package quản lý password/tài khoản.
- Không thêm dependency ngoài mục tiêu MySQL nếu chưa duyệt riêng.

## Comment bắt buộc khi code

Requirements thường không cần comment dài. Nếu thêm comment, ghi ngắn:

```txt
aiomysql==0.2.*        # Async MySQL driver for attendance DB access
```

## Tiêu chí nghiệm thu

- Requirements CPU/GPU đồng bộ.
- Không phá install hiện tại.
- Nếu cần cài dependency qua network mà sandbox chặn, phải xin quyền trước.

