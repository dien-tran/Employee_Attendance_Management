# E2E TESTING RULES (PLAYWRIGHT)

Tài liệu này định nghĩa các quy chuẩn bắt buộc khi Agent thực hiện cấu hình và viết kịch bản End-to-End Test bằng Playwright cho hệ thống.

## 1. CÔNG CỤ VÀ MÔI TRƯỜNG (TOOLING & ENVIRONMENT)
- **Framework Bắt Buộc:** Sử dụng thư viện Playwright (`@playwright/test`). Môi trường test phải mô phỏng toàn bộ stack (Backend + DB đang chạy qua Docker, Frontend chạy local).
- **Vị trí thư mục:** Các file test E2E đặt tại `front-end/tests/e2e/`.
- **Môi trường chạy (Dockerized):** TUYỆT ĐỐI không chạy `npm install` hay `npx playwright test` trực tiếp trên máy local. Toàn bộ quá trình test (bao gồm cài đặt dependencies và thực thi) phải được thực hiện bên trong một Docker container chuyên dụng để đảm bảo tính nhất quán và không phụ thuộc môi trường local.
- **Data Isolation (Cách ly dữ liệu):** Các Test Case KHÔNG ĐƯỢC phép phụ thuộc trạng thái (dữ liệu) của nhau.
- **Cleanup (Dọn dẹp):** Mọi dữ liệu (User, Attendance, Config) được sinh ra trong quá trình test phải sử dụng các tiền tố/hậu tố dễ nhận diện (VD: email `e2e_test_admin@example.com`). BẮT BUỘC phải dùng hook `test.afterAll` hoặc block `finally` (gọi API Delete/Hard-delete) để dọn dẹp các dữ liệu rác này, trả Database về trạng thái sạch (Clean State).

## 2. QUY TẮC TƯƠNG TÁC GIAO DIỆN (UI LOCATORS)
- **Ưu tiên A11y:** Luôn ưu tiên dùng `getByRole`, `getByText`, hoặc `getByLabel` mô phỏng góc nhìn người dùng.
- **Tiêu chuẩn `data-testid`:** Trong trường hợp locator mặc định dễ bị thay đổi do CSS/cấu trúc, BẮT BUỘC thêm `data-testid` vào component Next.js.
  - **Format chuẩn:** `[component_name]-[action_hoặc_type]-[entity_id_hoặc_name]`
  - *Ví dụ Đúng:* `data-testid="login-submit-btn"`, `data-testid="staff-row-NV000001"`, `data-testid="status-badge-ACTIVE"`
  - *Ví dụ Sai (Tuyệt đối không dùng):* `data-testid="btn"`, `data-testid="submit"`, `data-testid="item-1"`

## 3. CƠ CHẾ DEBUG (TỰ ĐỘNG CHỤP ẢNH / QUAY VIDEO)
- Khi khởi tạo `playwright.config.ts`, BẮT BUỘC cấu hình cơ chế lưu lại bằng chứng kiểm thử (Artifacts) để dễ dàng trace bug:
  - `screenshot: 'only-on-failure'` (Chỉ chụp ảnh màn hình khi test thất bại).
  - `video: 'retain-on-failure'` (Giữ lại video quá trình tương tác khi test thất bại).
  - `trace: 'retain-on-failure'` (Lưu lại file Trace Viewer chứa log network, DOM snapshots).
- **Git:** BẮT BUỘC bổ sung `playwright-report/` và `test-results/` vào file `.gitignore` để tránh rác repository.

- **Tuyệt đối không dùng Hard Sleep:** KHÔNG ĐƯỢC dùng `page.waitForTimeout(5000)`.
- **Đợi API (Network Intercept):** Trước khi Assert UI sau một thao tác click gọi API, BẮT BUỘC phải dùng `page.waitForResponse()` để chờ kết quả từ Gateway.
  - *Ví dụ:* `const response = await page.waitForResponse(res => res.url().includes('/api/staff') && res.status() === 201);`
- **Đợi Animation:** Phải chờ Loading Spinner hoặc các hiệu ứng chuyển động (Framer Motion) kết thúc (VD dùng `waitFor({ state: 'detached' })`) rồi mới thao tác bước tiếp theo.

## 5. QUY ĐỊNH VỀ ASSERTIONS (KHẲNG ĐỊNH KẾT QUẢ)
- **Không click mù quáng:** Mọi hành động làm thay đổi state (Submit form, Delete item, Toggle status) đều BẮT BUỘC phải đi kèm Assertion để kiểm tra độ chính xác của giao diện sau khi phản hồi.
- **Quy tắc Verify 3 cấp độ (3-Level Assertion):** Một kịch bản hoàn chỉnh sau một Submit Event cần kiểm tra đủ 3 yếu tố:
  1. **Network State:** API Gateway phải trả về HTTP Code thành công (Check bằng `waitForResponse`).
  2. **URL/Route State:** Giao diện có redirect/chuyển trang đúng như thiết kế không?
     - *Ví dụ:* `await expect(page).toHaveURL(/.*\/admin\/employees/);`
  3. **UI/DOM State:** Component mới có render không? Toast message thông báo thành công có xuất hiện với nội dung chính xác không?
     - *Ví dụ:* `await expect(page.getByTestId('toast-success-msg')).toHaveText('Tạo nhân viên thành công');`

## 6. BẢO MẬT & STATE (AUTH STATE)
- Các Test Case nghiệp vụ không liên quan đến Login (VD: test quản lý nhân sự, điểm danh) KHÔNG ĐƯỢC thực hiện thao tác nhập form login lại từ đầu.
- Bắt buộc sử dụng cơ chế `storageState` của Playwright để lưu lại `HttpOnly Cookie` sau khi setup Login một lần duy nhất, và tái sử dụng cho toàn bộ Test Suite.

## 7. WORKFLOW E2E CHUẨN (STANDARD WORKFLOW)
Mọi kịch bản kiểm thử E2E cần tuân thủ quy trình các bước sau:
1. **Setup (Khởi động hệ thống):** Chạy lệnh `docker-compose up -d` để khởi động toàn bộ các service backend (eureka, gateway, auth, core) và frontend.
2. **Execution (Thực thi Test):** Chạy lệnh `docker-compose run --rm e2e-runner`. Lệnh này sẽ:
    - Kéo image Playwright đã được định nghĩa sẵn.
    - Tự động chạy `npm install` bên trong container.
    - Thực thi các kịch bản test trong `front-end/tests/e2e/`.
    - Playwright mở trình duyệt ảo, tự động điều hướng đến service `frontend` (VD: `http://frontend:3000`) và thao tác.
3. **Wait & Assert:** Chờ API trả về (Intercept) và chờ UI hoàn tất hiệu ứng trước khi Assert (kiểm tra) kết quả (tuân thủ nguyên tắc Verify 3 cấp độ).
4. **Review Results:** Kết quả test, screenshot, video và trace (nếu có lỗi) sẽ được lưu vào thư mục `playwright-report` và `test-results` trên máy host (thông qua volume mapping).
5. **Teardown (Dọn dẹp):**
    - Container `e2e-runner` sẽ tự động bị xóa sau khi chạy xong (`--rm`).
    - Dữ liệu rác trong DB phải được dọn dẹp bởi hook `test.afterAll` như đã quy định ở Mục 1.
    - Tắt toàn bộ hệ thống bằng `docker-compose down`.
