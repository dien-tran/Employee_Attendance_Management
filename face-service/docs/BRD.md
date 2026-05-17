# 📋 Business Requirements Document (BRD)

## Face Services — Hệ thống Quản lý Chấm công bằng Khuôn mặt

| Thông tin        | Chi tiết                                     |
| ---------------- | -------------------------------------------- |
| **Dự án**        | Attendance Management System (Microservices) |
| **Service**      | Face_Services                                |
| **Ngày tạo**     | 11/05/2026                                   |
| **Trạng thái**   | Đang phát triển                              |

---

## 1. Giới thiệu

### 1.1 Mục đích tài liệu

Tài liệu này mô tả các yêu cầu nghiệp vụ cho **Face_Services** — một microservice trong hệ thống Quản lý Chấm công, chịu trách nhiệm xử lý toàn bộ nghiệp vụ liên quan đến nhận diện khuôn mặt.

### 1.2 Phạm vi

Face_Services cung cấp ba chức năng chính:

1. **Đăng ký khuôn mặt (Face Enrollment)** — Thêm dữ liệu khuôn mặt cho nhân viên vào hệ thống.
2. **Chấm công vào (Check-in)** — Nhân viên check-in bằng nhận diện khuôn mặt.
3. **Chấm công ra (Check-out)** — Nhân viên check-out bằng nhận diện khuôn mặt.

### 1.3 Đối tượng sử dụng

| Vai trò          | Mô tả                                                 |
| ---------------- | ------------------------------------------------------ |
| **Admin / HR**   | Đăng ký khuôn mặt cho nhân viên mới, quản lý dữ liệu |
| **Nhân viên**    | Check-in / Check-out hàng ngày qua camera              |

---

## 2. Yêu cầu chức năng

### 2.1 Đăng ký khuôn mặt (Face Enrollment)

#### Mô tả

Admin/HR chụp ảnh khuôn mặt nhân viên qua webcam hoặc upload ảnh, hệ thống xử lý và lưu trữ dữ liệu khuôn mặt để phục vụ nhận diện sau này.

#### Yêu cầu chi tiết

| ID      | Yêu cầu                                                                         | Độ ưu tiên |
| ------- | -------------------------------------------------------------------------------- | ---------- |
| FR-1.1  | Hệ thống cho phép chụp ảnh khuôn mặt nhân viên qua webcam                       | Cao        |
| FR-1.2  | Hệ thống phải phát hiện được khuôn mặt trong ảnh                                | Cao        |
| FR-1.3  | Chỉ cho phép đăng ký khi ảnh có đúng **1 khuôn mặt**                            | Cao        |
| FR-1.4  | Hệ thống phải kiểm tra **chống giả mạo** (anti-spoofing) — phát hiện ảnh in, màn hình điện thoại | Cao |
| FR-1.5  | Hệ thống phải kiểm tra **chất lượng ảnh** (độ nét, độ sáng, kích thước mặt, góc nghiêng) | Trung bình |
| FR-1.6  | Lưu trữ dữ liệu khuôn mặt (embedding vector) gắn với mã nhân viên             | Cao        |
| FR-1.7  | Trả về kết quả đăng ký thành công hoặc thông báo lỗi cụ thể                    | Cao        |
| FR-1.8  | Cho phép đăng ký lại (cập nhật) khuôn mặt cho nhân viên đã có                   | Trung bình |
| FR-1.9  | Dữ liệu đăng ký khuôn mặt lưu kèm ngày sinh nhân viên theo định dạng ISO `YYYY-MM-DD` để hỗ trợ định danh | Trung bình |

#### Luồng xử lý cơ bản

```
Nhập thông tin nhân viên (mã, họ tên, ngày sinh) → Chụp ảnh / Upload ảnh
    → Phát hiện khuôn mặt
    → Kiểm tra chống giả mạo
    → Kiểm tra chất lượng ảnh
    → Trích xuất & lưu trữ dữ liệu khuôn mặt
    → Trả kết quả
```

---

### 2.2 Chấm công vào (Check-in)

#### Mô tả

Nhân viên đứng trước camera, hệ thống tự động nhận diện khuôn mặt và ghi nhận thời gian check-in.

#### Yêu cầu chi tiết

| ID      | Yêu cầu                                                                         | Độ ưu tiên |
| ------- | -------------------------------------------------------------------------------- | ---------- |
| FR-2.1  | Hệ thống nhận diện khuôn mặt nhân viên **theo thời gian thực** qua camera       | Cao        |
| FR-2.2  | So khớp khuôn mặt với dữ liệu đã đăng ký trong hệ thống                        | Cao        |
| FR-2.3  | Kiểm tra chống giả mạo trước khi chấp nhận check-in                             | Cao        |
| FR-2.4  | Ghi nhận thời gian check-in kèm mã nhân viên, độ tin cậy                        | Cao        |
| FR-2.5  | Có cơ chế **cooldown** — ngăn check-in trùng lặp trong khoảng thời gian ngắn    | Cao        |
| FR-2.6  | Hiển thị tên nhân viên và kết quả check-in trên màn hình                        | Cao        |
| FR-2.7  | Thông báo lỗi khi không nhận diện được hoặc khuôn mặt không có trong hệ thống   | Trung bình |

#### Luồng xử lý cơ bản

```
Nhân viên đứng trước camera
    → Hệ thống chụp frame tự động
    → Phát hiện khuôn mặt
    → Kiểm tra chống giả mạo
    → So khớp với dữ liệu đã đăng ký
    → Kiểm tra cooldown
    → Ghi nhận CHECK_IN
    → Hiển thị kết quả
```

---

### 2.3 Chấm công ra (Check-out)

#### Mô tả

Tương tự Check-in, nhưng ghi nhận thời gian kết thúc làm việc của nhân viên.

#### Yêu cầu chi tiết

| ID      | Yêu cầu                                                                         | Độ ưu tiên |
| ------- | -------------------------------------------------------------------------------- | ---------- |
| FR-3.1  | Quy trình nhận diện tương tự Check-in                                           | Cao        |
| FR-3.2  | Ghi nhận thời gian check-out kèm mã nhân viên                                  | Cao        |
| FR-3.3  | Hệ thống phân biệt được Check-in và Check-out                                   | Cao        |
| FR-3.4  | Nhân viên phải có bản ghi Check-in trong ngày trước khi Check-out               | Trung bình |

---

## 3. Yêu cầu phi chức năng

| ID      | Yêu cầu                                                              | Độ ưu tiên |
| ------- | --------------------------------------------------------------------- | ---------- |
| NFR-1   | Thời gian xử lý nhận diện ≤ 2 giây / frame                          | Cao        |
| NFR-2   | Độ chính xác nhận diện ≥ 95%                                         | Cao        |
| NFR-3   | Chống giả mạo: phát hiện ảnh in, màn hình điện thoại                | Cao        |
| NFR-4   | Không lưu trữ ảnh gốc, chỉ lưu embedding vector (bảo mật dữ liệu)  | Trung bình |
| NFR-5   | Hỗ trợ nhiều thiết bị chấm công đồng thời                           | Trung bình |
| NFR-6   | Service hoạt động độc lập, giao tiếp qua API (microservices)         | Cao        |

---

## 4. Quy tắc nghiệp vụ

| ID     | Quy tắc                                                                          |
| ------ | --------------------------------------------------------------------------------- |
| BR-1   | Mỗi ảnh đăng ký chỉ được phép chứa **đúng 1 khuôn mặt**                        |
| BR-2   | Ảnh giả mạo (in, màn hình) bị từ chối hoàn toàn                                 |
| BR-3   | Nhân viên không được check-in lại trong thời gian cooldown (ví dụ: 5 phút)       |
| BR-4   | Check-out chỉ hợp lệ khi đã có Check-in trong ngày                              |
| BR-5   | Mỗi bản ghi chấm công phải gắn với mã nhân viên và thời gian chính xác          |

---

## 5. Các trường hợp lỗi

| Trường hợp                        | Hành vi hệ thống                                     |
| --------------------------------- | ----------------------------------------------------- |
| Không phát hiện khuôn mặt         | Thông báo "Không phát hiện khuôn mặt trong ảnh"      |
| Phát hiện nhiều khuôn mặt         | Thông báo "Chỉ cho phép 1 khuôn mặt"                |
| Ảnh giả mạo                       | Thông báo "Phát hiện ảnh giả mạo"                    |
| Ảnh chất lượng kém                | Thông báo lỗi cụ thể (mờ, tối, quá xa, nghiêng)     |
| Khuôn mặt không khớp              | Thông báo "Không tìm thấy nhân viên phù hợp"        |
| Check-in trong thời gian cooldown | Thông báo "Vui lòng đợi X giây"                      |

---

## 6. Phạm vi ngoài (Out of Scope)

Các chức năng sau **không** thuộc phạm vi của Face_Services:

- Quản lý thông tin nhân viên (thuộc service khác)
- Báo cáo & thống kê chấm công
- Quản lý ca làm việc, lịch làm việc
- Tính lương dựa trên chấm công
- Giao diện quản trị (Admin Dashboard)
