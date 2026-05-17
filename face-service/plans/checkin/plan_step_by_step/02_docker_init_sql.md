# Step 02 — Docker Init SQL

## Mục tiêu

Cho MySQL container tự chạy schema attendance khi tạo database mới.

## File dự kiến

- `docker-compose.yml`.

## Nội dung chính

Thêm volume mount cho service `mysql`:

```yaml
volumes:
  - mysql_data:/var/lib/mysql
  - ./sql:/docker-entrypoint-initdb.d:ro
```

## Lưu ý quan trọng

- MySQL chỉ chạy file trong `/docker-entrypoint-initdb.d` khi data directory rỗng.
- Nếu volume `mysql_data` đã tồn tại, init SQL sẽ không tự chạy lại.
- Không xóa hoặc reset volume nếu người dùng chưa yêu cầu rõ.

## Comment bắt buộc khi code

- Comment trong plan/ghi chú triển khai rằng init SQL chỉ áp dụng cho database mới.
- Nếu cần migration cho database đã có, phải tạo bước riêng và hỏi người dùng trước.

## Tiêu chí nghiệm thu

- `docker compose config` hợp lệ.
- Không đụng dữ liệu volume hiện tại.
- Không thêm lệnh destructive.

