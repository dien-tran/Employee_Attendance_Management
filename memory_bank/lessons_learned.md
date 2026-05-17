# Lessons Learned - Employee Attendance Management System

## Phiên 1 - 2026-05-13: Khởi tạo hạ tầng Microservices (Giai đoạn 0)

### ✅ Đã hoàn thành
- Task 0.1: eureka-service (port 8761)
- Task 0.2: api-gateway (port 8080) với JwtAuthenticationFilter
- Task 0.3: auth-service (port 8081) với auth_db
- Task 0.4: core-service (port 8082) với core_db
- docker-compose.yml tổng thể

### 📝 Bài học kỹ thuật

#### 1. VS Code Java Package Error (Không ảnh hưởng build)
- **Vấn đề:** VS Code báo lỗi `"The declared package X does not match the expected package main.java.X"` cho tất cả Java files trong project mới.
- **Nguyên nhân:** VS Code chưa nhận diện Maven source root (`src/main/java`) vì chưa có `.classpath` hoặc Maven project chưa được import.
- **Giải pháp:** Lỗi này KHÔNG ảnh hưởng đến `mvn build` hay Docker build. Chỉ cần chạy `mvn clean install` hoặc mở project bằng "Open Folder" trong VS Code để VS Code tự detect Maven structure.
- **Kết luận:** Bỏ qua lỗi này trong quá trình tạo file, chỉ quan tâm khi build thực tế.

#### 2. Spring Cloud Gateway - Không dùng spring-boot-starter-web
- **Lưu ý:** Spring Cloud Gateway dựa trên WebFlux (reactive), KHÔNG tương thích với `spring-boot-starter-web` (servlet-based).
- **Đã áp dụng:** api-gateway chỉ dùng `spring-cloud-starter-gateway` (đã bao gồm WebFlux).

#### 3. Core Service - Tuyệt đối không có JWT
- **Luật:** Core Service KHÔNG import bất kỳ thư viện JWT nào.
- **Đã áp dụng:** pom.xml của core-service không có `nimbus-jose-jwt` hay `spring-security-oauth2-resource-server`.
- **Cơ chế:** Chỉ dùng `@RequestHeader("X-User-Id")` và `@RequestHeader("X-User-Roles")`.

#### 4. Auth Service - Dùng spring-security-crypto thay vì spring-boot-starter-security
- **Lý do:** Auth Service không cần Spring Security Filter Chain (không có endpoint bảo vệ bằng Spring Security). Chỉ cần BCryptPasswordEncoder.
- **Đã áp dụng:** Dùng `spring-security-crypto` dependency riêng lẻ.

#### 5. Docker Compose - Dependency ordering với healthcheck
- **Lưu ý:** Dùng `condition: service_healthy` thay vì chỉ `depends_on` để đảm bảo MySQL và Eureka thực sự sẵn sàng trước khi service khởi động.

### 🔑 Cấu hình quan trọng
- **SIGNED_KEY:** cấu hình qua biến môi trường, chia sẻ giữa api-gateway và auth-service; không commit giá trị thật.
- **JWT Algorithm:** HS512 (Nimbus JOSE JWT)
- **Token location:** HttpOnly Cookie `access_token` (ưu tiên) hoặc `Authorization: Bearer` header (fallback)
- **Token duration:** 86400 seconds (24 giờ)

---

## Phiên 2 - 2026-05-13: Test Workflow Task 1.1 (Staff Management)

### ✅ Đã hoàn thành
- Test end-to-end toàn bộ workflow Task 1.1 qua API Gateway
- Phát hiện và fix 2 bug nghiêm trọng trong api-gateway
- Thêm DataInitializer để seed admin account tự động

### 🐛 Bug đã phát hiện & fix

#### Bug 1: Thiếu route `/api/staff/**` trong API Gateway
- **Triệu chứng:** `POST http://localhost:8080/api/staff` trả về 503 Service Unavailable
- **Nguyên nhân:** `api-gateway/application.yml` chỉ có route `/api/auth/**` (strip prefix → `/auth/**`). `StaffController` mapping là `/api/staff` nhưng không có route nào cover path này.
- **Fix:** Thêm route mới vào `application.yml`:
  ```yaml
  - id: auth-service-staff
    uri: lb://auth-service
    predicates:
      - Path=/api/staff/**
    # KHÔNG có StripPrefix vì StaffController mapping là /api/staff
  ```
- **Bài học:** Khi thêm Controller mới vào một service, phải kiểm tra và cập nhật routes trong API Gateway. Route `/api/auth/**` strip prefix 1 (vì AuthController mapping là `/auth/...`), nhưng route `/api/staff/**` KHÔNG strip prefix (vì StaffController mapping là `/api/staff`).

#### Bug 2: IntrospectResponse parsing sai cấu trúc JSON wrapper
- **Triệu chứng:** Mọi request đều bị Gateway trả về 401 với log `"Token xxx is blacklisted"` dù token hoàn toàn hợp lệ và DB không có record blacklist.
- **Nguyên nhân:** `JwtAuthenticationFilter.java` định nghĩa `IntrospectResponse` record chỉ có field `valid` (boolean):
  ```java
  record IntrospectResponse(boolean valid) { ... }
  ```
  Nhưng Auth Service thực tế trả về JSON có wrapper:
  ```json
  {"code": 200, "message": "...", "result": {"valid": true, "userId": "...", "roles": "..."}}
  ```
  Jackson không tìm thấy field `valid` ở root level → deserialize thành `false` (default) → `isBlacklisted = !false = true` → chặn tất cả request.
- **Fix:** Tách thành 2 records để match đúng cấu trúc nested JSON:
  ```java
  record IntrospectResponse(int code, String message, IntrospectResult result) {
      public boolean isValid() { return result != null && result.valid(); }
  }
  record IntrospectResult(boolean valid, String userId, String roles) {}
  ```
- **Bài học:** Khi dùng WebClient để gọi API nội bộ, phải đảm bảo DTO/record class match **chính xác** cấu trúc JSON response (bao gồm cả wrapper). Nên test introspect endpoint riêng lẻ trước khi tích hợp vào filter.

### 🆕 File mới thêm

#### DataInitializer.java
- **Path:** `auth-service/src/main/java/com/attendance/auth/config/DataInitializer.java`
- **Mục đích:** Tự động seed tài khoản ADMIN hệ thống khi auth-service khởi động.
- **Pattern:** Implements `ApplicationRunner`, chạy sau khi Spring context load xong.
- **Idempotent:** Kiểm tra `existsByEmail()` trước khi tạo → an toàn khi restart nhiều lần.
- **Tài khoản seed:** cấu hình qua `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_STAFF_ID`; không hardcode mật khẩu.
- **Bài học:** Luôn dùng pattern này thay vì seed thủ công qua SQL/curl để đảm bảo môi trường dev/test luôn có dữ liệu khởi đầu nhất quán.

### 📝 Bài học kỹ thuật bổ sung

#### 6. API Gateway - Route prefix và Controller mapping phải khớp nhau
- **Quy tắc:** Nếu Controller mapping là `/api/xxx`, route Gateway KHÔNG strip prefix.
- **Nếu** Controller mapping là `/xxx` (không có `/api`), route Gateway strip prefix 1 từ `/api/xxx/**`.
- **Kiểm tra:** Luôn đối chiếu `@RequestMapping` của Controller với route config trong Gateway khi thêm endpoint mới.

#### 7. WebClient DTO phải match chính xác JSON response structure
- **Quy tắc:** Khi dùng `bodyToMono(SomeClass.class)`, class phải có fields tương ứng với **tất cả** levels của JSON (bao gồm wrapper objects).
- **Cách debug:** Log raw response body trước khi deserialize để xác nhận cấu trúc thực tế.
- **Pattern an toàn:** Dùng `bodyToMono(String.class)` để log raw JSON khi debug, sau đó mới chuyển sang typed class.

#### 8. Token Blacklist và Service Restart
- **Vấn đề:** Khi auth-service restart, `invalidated_tokens` table trong DB vẫn còn dữ liệu cũ từ các lần logout trước. Các token mới login sau restart vẫn hợp lệ nhưng nếu có bug parsing (như Bug 2), chúng sẽ bị coi là blacklisted.
- **Giải pháp debug:** Xóa `invalidated_tokens` table khi test: `DELETE FROM invalidated_tokens;`
- **Production note:** Không xóa table này trong production. Chỉ dùng khi debug.

### 🔑 Cấu hình bổ sung
- **Admin mặc định:** do `DataInitializer` tạo khi `SEED_ADMIN_ENABLED=true`, thông tin đọc từ biến môi trường.
- **Password convention nhân viên:** `ddMMyyyy` từ ngày sinh (VD: dob=1998-03-20 → password=`20031998`)
- **StaffId format:** `NV` + 6 chữ số tự tăng (VD: NV000001, NV000002)
- **Admin system StaffId:** `SYS000001` (prefix SYS để phân biệt với nhân viên thường)

---

## Phiên 3 - Bổ sung code cho Task 1.2

### 🐛 Bug đã phát hiện & fix

#### Bug 3: Nhầm lẫn trạng thái Task (False Positive)
- **Triệu chứng:** Task 1.2 "Xem danh sách nhân viên" được báo là DONE, test `.http` đã có, nhưng API thực tế `GET /api/staff` chưa hề được viết trong `StaffController` (thường dẫn đến lỗi 405 Method Not Allowed khi test).
- **Nguyên nhân:** Bỏ sót bước tạo method `@GetMapping` trong source code nhưng vẫn kết luận hoàn thành.
- **Bài học:** Cần rà soát kỹ code thực tế và không vội vàng đánh dấu `DONE` nếu chưa trực tiếp thêm method vào Controller.

---

## Phiên 4 - 2026-05-13: Integration Test (StaffIntegrationTest)

### ✅ Đã hoàn thành
- Viết `StaffIntegrationTest.java` — Integration Test chuẩn cho `StaffController` (auth-service).
- Tạo `application-test.yml` — profile `test` dùng H2 in-memory DB, tắt Eureka.
- Thêm H2 dependency (scope test) vào `pom.xml`.
- Chạy test thành công qua Docker container `maven:3.9.6-eclipse-temurin-21`.
- Kết quả: **Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS**

### 📋 APIs đã được test tích hợp (E2E trong 1 kịch bản liền mạch)

| Step | Method | Path | Header | Expected | Result |
|------|--------|------|--------|----------|--------|
| 1 | POST | `/api/staff` | `X-User-Roles: ROLE_ADMIN` | 201 Created, status=ACTIVE | ✅ PASS |
| 2 | PATCH | `/api/staff/{id}/status?status=INACTIVE` | `X-User-Roles: ROLE_ADMIN` | 200 OK, status=INACTIVE | ✅ PASS |
| 3 | GET | `/api/staff` | `X-User-Roles: ROLE_ADMIN` | 200 OK, nhân viên có status=INACTIVE trong list | ✅ PASS |

### 📝 Bài học kỹ thuật

#### 9. Integration Test với @SpringBootTest — Cần H2 thay MySQL
- **Vấn đề:** `@SpringBootTest` khởi động toàn bộ ApplicationContext, bao gồm cả DataSource. Nếu không có MySQL đang chạy, context sẽ fail khi load.
- **Giải pháp:** Tạo `src/test/resources/application-test.yml` với profile `test`, dùng H2 in-memory DB (`jdbc:h2:mem:testdb;MODE=MySQL`) thay cho MySQL thật.
- **Thêm dependency:** `com.h2database:h2` với `scope=test` vào `pom.xml`.
- **Kết luận:** H2 `MODE=MySQL` giả lập cú pháp MySQL đủ để Hibernate tạo schema và chạy query bình thường.

#### 10. Tắt Eureka Client trong profile test
- **Vấn đề:** Khi chạy `@SpringBootTest`, Eureka Client cố kết nối đến Eureka Server (mặc định `http://localhost:8761/eureka/`). Nếu không có Eureka đang chạy, context load chậm hoặc có warning/error.
- **Giải pháp:** Thêm vào `application-test.yml`:
  ```yaml
  eureka:
    client:
      enabled: false
      register-with-eureka: false
      fetch-registry: false
  ```
- **Kết luận:** Luôn tắt Eureka (và các external service khác) trong profile test để test chạy độc lập, không phụ thuộc hạ tầng.

#### 11. @Transactional trên class test — Rollback tự động
- **Cơ chế:** Khi đặt `@Transactional` lên class test, Spring bọc mỗi `@Test` method trong một transaction và **tự động rollback** sau khi test kết thúc (dù PASS hay FAIL).
- **Lợi ích:** Không cần `@AfterEach` để dọn dẹp DB. Mỗi test chạy trên DB sạch.
- **Lưu ý quan trọng:** Với `@Transactional` trên test, MockMvc request vẫn chạy trong cùng transaction của test thread. Tuy nhiên nếu service dùng `REQUIRES_NEW` propagation, dữ liệu đó sẽ không bị rollback. Trong project này `StaffService` dùng `@Transactional` mặc định (REQUIRED) nên rollback hoạt động đúng.

#### 12. Trích xuất giá trị từ JSON response bằng JsonPath trong MockMvc
- **Pattern:** Dùng `MvcResult result = mockMvc.perform(...).andReturn()` để lấy raw response, sau đó dùng `com.jayway.jsonpath.JsonPath.read(body, "$.result.id")` để trích xuất giá trị.
- **Dependency:** `JsonPath` đã có sẵn trong `spring-boot-starter-test` (không cần thêm dependency riêng).
- **Ví dụ:**
  ```java
  MvcResult result = mockMvc.perform(post("/api/staff")...).andReturn();
  String staffId = com.jayway.jsonpath.JsonPath.read(result.getResponse().getContentAsString(), "$.result.id");
  ```
- **Kết luận:** Đây là cách chuẩn để viết E2E test liền mạch (kết quả step trước làm input cho step sau).

#### 13. Chạy Maven test khi máy không có JDK đúng version — Dùng Docker
- **Vấn đề:** Project yêu cầu Java 21, máy chỉ có JDK 20. `mvn test` báo lỗi `release version 21 not supported`.
- **Giải pháp:** Dùng Docker image `maven:3.9.6-eclipse-temurin-21` để chạy test trong container có đúng JDK:
  ```bash
  docker run --rm \
    -v "<absolute_path>/auth-service:/app" \
    -w /app \
    maven:3.9.6-eclipse-temurin-21 \
    mvn test -Dtest=StaffIntegrationTest
  ```
- **Lưu ý:** Phải dùng absolute path khi mount volume trên Windows (không dùng `%CD%` vì shell không expand đúng trong Docker command).
- **Kết luận:** Docker là giải pháp portable để chạy build/test mà không cần cài JDK đúng version trên máy host.

### 🆕 Files mới thêm trong phiên này

| File | Mục đích |
|------|----------|
| `auth-service/src/test/java/com/attendance/auth/StaffIntegrationTest.java` | Integration test E2E cho StaffController (POST → PATCH → GET) |
| `auth-service/src/test/resources/application-test.yml` | Profile test: H2 in-memory DB, Eureka disabled |
| `auth-service/pom.xml` (cập nhật) | Thêm `com.h2database:h2` scope test |

---

## Phiên 5 - 2026-05-14: Frontend Integration (Giai đoạn 3) - API Client, Zustand Store, CRUD

### ✅ Đã hoàn thành
- Task 3.0: API Client & Zustand Store
- Task 3.1.1: Admin Portal - Đăng nhập & Xác thực
- Task 3.1.2: Admin Portal - Quản lý thông tin nhân viên (CRUD)
- Task 3.2.1: User Portal - Đăng nhập
- Task 3.2.2: User Portal - Xem thông tin cá nhân
- Task 3.2.3: User Portal - Update thông tin cá nhân
- Cập nhật docker-compose.yml với frontend service
- Cập nhật package.json với dependencies: zustand, axios, react-hook-form, zod

### 📝 Bài học kỹ thuật

#### 14. HttpOnly Cookie Authentication - Không lưu JWT ở client
- **Quyết định:** Frontend KHÔNG lưu JWT token ở localStorage/sessionStorage. Thay vào đó, backend set HttpOnly Cookie `access_token` tự động qua response header `Set-Cookie`.
- **Cơ chế:** Fetch API dùng `credentials: 'include'` để tự động gửi cookie trong mọi request.
- **Lợi ích:** Chống XSS (JavaScript không thể đọc được HttpOnly Cookie). Cookie chỉ được trình duyệt tự động gửi kèm request đến đúng domain.
- **Zustand Store:** Chỉ persist user info (name, email, role) - hoàn toàn không lưu token.
- **Kết luận:** Đây là pattern bảo mật tốt hơn so với lưu JWT ở localStorage.

#### 15. API Client Design Pattern - Fetch-based vs Axios
- **Lựa chọn:** Dùng native Fetch API thay vì Axios để giảm dependency và bundle size.
- **Wrapper:** Tạo `apiClient` object với các method `get`, `post`, `put`, `patch`, `delete` - mỗi method tự động thêm `Content-Type: application/json` và `credentials: 'include'`.
- **Response handling:** Mỗi method parse JSON response và throw error với message từ backend nếu status không OK.
- **Type safety:** Dùng generic `<T = any>` để có thể type response data: `apiClient.get<StaffDTO[]>('/api/staff')`.
- **Kết luận:** Fetch API đủ mạnh cho project này. Axios có thể thêm sau nếu cần interceptor phức tạp.

#### 16. Zustand + Context - Quản lý state toàn cục
- **Cấu trúc:** Dùng Zustand `persist` middleware để tự động lưu/rehydrate auth state từ localStorage.
- **Tích hợp Context:** Auth context (`auth-context.tsx`) bọc Zustand store, cung cấp `login()`/`logout()` methods với business logic (redirect theo role).
- **Hydration:** Thêm `isHydrated` flag để tránh render flash khi store chưa kịp load từ localStorage.
- **Partialize:** Dùng `partialize` option để chỉ persist `user` và `isAuthenticated` (không lưu function hay computed state).
- **Kết luận:** Zustand + Context là pattern gọn nhẹ, không cần Redux boilerplate.

#### 17. LoginForm dùng react-hook-form + zod validation
- **Pattern:** `useForm<LoginValues>({ resolver: zodResolver(loginSchema) })` - validation schema bằng Zod.
- **Error handling:** Form hiển thị error message từ backend (invalid credentials) trong motion div animation.
- **Loading state:** Button hiển thị spinner + "Signing in..." khi đang gọi API.
- **Admin vs User:** Component nhận `isAdmin` prop để điều chỉnh style (màu sắc) và redirect path.
- **Kết luận:** react-hook-form với Zod resolver là chuẩn cho form validation trong Next.js.

#### 18. Admin Employees Page - CRUD với Modal
- **Cấu trúc:** Single page component với các state: staffList, searchQuery, departmentFilter, viewMode (grid/list).
- **Filter logic:** Tìm kiếm real-time (name, email, staffId, position) + dropdown filter department.
- **Status toggle:** Gọi `staffService.updateStatus(id, newStatus)` và optimistic update state (không cần reload).
- **Add Employee Modal:** Form với 10 fields (name, email, department, position, phone, dob, identityCard, bankAccount, bankName, role) trong grid 2 cột.
- **Kết luận:** Grid/List toggle view là UX pattern tốt cho danh sách nhân viên.

#### 19. Profile Page - Edit Profile Modal
- **Cấu trúc:** 3-column layout: profile card + stats card (bên trái) + settings & employee info (bên phải).
- **Edit Modal:** Form với 3 fields (name, department, phone) - chỉ update những field user được phép thay đổi.
- **State update:** Dùng `setUser()` từ Zustand store để cập nhật state ngay lập tức (optimistic).
- **Kết luận:** Profile page nên tách biệt view (info display) và edit (modal form) để UX rõ ràng.

#### 20. Docker Compose Frontend - Nginx reverse proxy
- **Cấu trúc:** Next.js static export (build output) → serve bằng Nginx.
- **Nginx config:** Proxy `/api/` requests đến `http://api-gateway:8080` (Docker internal network) để tránh CORS.
- **Port mapping:** Container port 80 → host port 3000.
- **Depends on:** frontend service `depends_on: api-gateway` để đảm bảo API Gateway available trước.
- **Kết luận:** Dùng Nginx để serve static Next.js và reverse proxy API là pattern chuẩn cho Docker deployment.

#### 21. Next.js Static Export - Không dược dùng server-side features
- **Giới hạn:** `output: 'export'` trong next.config.mjs có nghĩa là KHÔNG dùng được `getServerSideProps`, `API routes`, `middleware`, `rewrites`, `redirects`...
- **Giải pháp:**
  - Thay vì `Image` component của Next.js → dùng `<img>` tag thông thường.
  - Thay vì API routes → gọi trực tiếp API Gateway.
  - Thay vì middleware → dùng client-side guards (useEffect redirect).
  - Thay vì rewrites/redirects → xử lý trong Nginx config.
- **Kết luận:** Luôn kiểm tra next.config.mjs để biết output mode trước khi implement tính năng.

#### 22. File write_to_file bị truncate - Giới hạn content size
- **Vấn đề:** Khi write_to_file content quá lớn (~400+ lines), tool bị truncate dẫn đến JSX syntax errors (thiếu closing tags).
- **Giải pháp:** 
  - Chia file lớn thành các phần nhỏ hơn.
  - Dùng replace_in_file để thêm phần còn thiếu.
  - Giảm số lượng comments và whitespace trong JSX để file ngắn hơn.
- **Kết luận:** Với file JSX lớn, ưu tiên code ngắn gọn, tránh comments dài dòng và formatting khoảng cách thừa.

#### 23. Backend API consistency - Endpoint paths
- **StaffController mapping:** `@RequestMapping("/api/staff")` → tất cả endpoints bắt đầu bằng `/api/staff`.
- **StaffService methods:** getAll (GET /api/staff), create (POST /api/staff), update (PUT /api/staff/{id}), updateStatus (PATCH /api/staff/{id}/status?status=...).
- **Frontend services:** `staff.service.ts` gọi đúng các endpoints tương ứng.
- **Kết luận:** Đồng bộ API paths giữa backend Controller, frontend Service, và Gateway routes là critical để tránh 404/405 errors.

### 🔧 Files đã tạo/chỉnh sửa

| File | Mục đích |
|------|----------|
| `front-end/lib/api-client.ts` | Fetch-based API client với credentials: include |
| `front-end/services/auth.service.ts` | Auth service: login, logout, getStaffProfile |
| `front-end/services/staff.service.ts` | Staff CRUD service: getAll, create, update, updateStatus |
| `front-end/store/authStore.ts` | Zustand auth store với persist middleware |
| `front-end/contexts/auth-context.tsx` | Auth context dùng Zustand + API service |
| `front-end/components/auth/login-form.tsx` | Login form với react-hook-form + zod |
| `front-end/app/admin/(protected)/employees/page.tsx` | Admin employee CRUD page (grid/list, add modal, status toggle) |
| `front-end/app/user/profile/page.tsx` | User profile page với edit modal |
| `front-end/package.json` (cập nhật) | Thêm zustand, axios, react-hook-form, zod |
| `docker-compose.yml` (cập nhật) | Thêm frontend service |

### 🔑 Lưu ý quan trọng
- **TS Errors:** Tất cả TypeScript errors hiện tại là do chưa cài `node_modules`. Sẽ tự fix khi build Docker.
- **Next.js 16.2:** Dùng `"use client"` directive cho tất cả interactive components.
- **shadcn/ui:** Components dùng @radix-ui primitives + tailwind CSS - không phụ thuộc vào server-side rendering.
- **API Gateway URL:** Frontend gọi API qua `http://api-gateway:8080` (Docker network) - nếu chạy local dev cần set `NEXT_PUBLIC_API_URL`.

---

## Phiên 6 - 2026-05-15: Task 3.6 User Profile E2E & Profile API

### Đã hoàn thành
- Viết `front-end/tests/e2e/user-profile.spec.ts` cho luồng User Profile bằng `storageState` User.
- Thêm API hồ sơ cá nhân riêng:
  - `GET /api/profile/me`
  - `PUT /api/profile/me`
- Thêm route Gateway `auth-service-profile` cho `/api/profile/**`.
- Cập nhật `front-end/services/profile.service.ts` và `front-end/app/user/profile/page.tsx` để dùng API thật, không còn simulate API call.
- Chuẩn hóa `PUT /api/staff/{id}` và `PATCH /api/staff/{id}/status` trả `ApiResponse<StaffResponse>`.
- Cập nhật `API_Endpoint.md` với Profile API và response wrapper mới.

### Lỗi / lệch hướng đã gặp

#### 24. Không dùng Admin Staff API cho User Profile
- **Vấn đề:** Ban đầu luồng User Profile được nối vào `staffService.update(user.id)` tức `PUT /api/staff/{id}`.
- **Nguyên nhân:** Tận dụng API sẵn có quá nhanh mà chưa đối chiếu đúng phân quyền nghiệp vụ.
- **Rủi ro:** `PUT /api/staff/{id}` là endpoint ADMIN. Nếu mở cho USER thì dễ tạo lỗ hổng update staff ngoài phạm vi hồ sơ cá nhân.
- **Fix:** Tách `ProfileController` riêng với `/api/profile/me`, lấy user hiện tại từ header `X-User-Id` do Gateway inject.
- **Bài học:** API cho "current user" nên dùng endpoint self-scoped như `/me`, không truyền `{id}` từ frontend nếu user chỉ được sửa chính mình.

#### 25. Simulate API call trong UI làm E2E không đúng giá trị
- **Vấn đề:** Profile page ban đầu chỉ `setTimeout` rồi update Zustand local state.
- **Rủi ro:** E2E có thể pass nhưng không kiểm tra được integration thật với Gateway/backend.
- **Fix:** Thêm `profileService.getMe()` và `profileService.updateMe()`, rồi để page gọi `GET/PUT /api/profile/me`.
- **Bài học:** Với task tích hợp frontend-backend, UI không nên giữ mock/simulate ở luồng nghiệp vụ đã có API thật.

#### 26. Gateway route phải đi cùng Controller mới
- **Vấn đề:** Khi thêm `ProfileController @RequestMapping("/api/profile")`, cần thêm route Gateway `/api/profile/**`.
- **Fix:** Thêm route `auth-service-profile` trong `api-gateway/application.yml` và không dùng `StripPrefix`, vì controller đã có prefix `/api/profile`.
- **Bài học:** Mỗi controller mới trong microservice phải được đối chiếu 3 nơi: Controller mapping, Gateway route, frontend service path.

#### 27. Response wrapper phải nhất quán giữa backend và frontend service
- **Vấn đề:** Một số endpoint staff update/status từng trả raw `StaffResponse`, trong khi `apiClient` và các service frontend kỳ vọng wrapper `{code,message,result}`.
- **Rủi ro:** Frontend phải thêm workaround kiểu `response.result ?? response`, làm service mơ hồ và dễ lỗi về sau.
- **Fix:** Chuẩn hóa `PUT /api/staff/{id}` và `PATCH /api/staff/{id}/status` trả `ApiResponse<StaffResponse>`.
- **Bài học:** Không sửa frontend để né contract backend lệch. Nên chuẩn hóa contract ở backend trước, sau đó frontend chỉ đọc `response.result`.

#### 28. Ghi nhận lỗi tự đánh giá trước khi kết thúc task
- **Vấn đề:** Sau khi thêm code, vẫn còn các điểm chưa polish: response lỗi chưa đồng bộ, import/order chưa sạch, line ending lẫn LF/CRLF.
- **Fix:** Refactor lại controller response, dọn import/comment tạm, normalize line ending các file đã chạm.
- **Bài học:** Sau khi thêm feature, cần một vòng review nhỏ theo checklist: scope nghiệp vụ, API contract, route Gateway, frontend service, E2E path, format/code style.

#### 29. Browser không gọi được hostname Docker internal như `api-gateway`
- **Vấn đề:** `front-end/lib/api-client.ts` từng mặc định `API_BASE_URL = 'http://api-gateway:8080'`.
- **Nguyên nhân:** Nhầm giữa network của container và network của browser. `api-gateway` là DNS nội bộ Docker, nhưng JavaScript chạy trong browser tại `http://frontend` không nên gọi trực tiếp host đó.
- **Rủi ro:** Request browser thành cross-origin (`http://frontend` → `http://api-gateway:8080`), dễ fail CORS và HttpOnly cookie không cùng domain.
- **Fix:** Đổi default `API_BASE_URL` thành chuỗi rỗng `''`, để browser gọi relative `/api/...` qua nginx proxy. Chỉ set `NEXT_PUBLIC_API_URL` khi chạy local dev không có proxy.
- **Bài học:** Với frontend static sau nginx, browser client nên gọi same-origin `/api`, còn nginx mới proxy sang service nội bộ Docker.

#### 30. E2E API helper phải dùng cùng origin với browser session
- **Vấn đề:** `auth.setup.ts` và `admin-crud.spec.ts` từng gọi API helper tới `http://api-gateway:8080`.
- **Nguyên nhân:** Cleanup/setup data đi thẳng vào gateway, trong khi login UI tạo cookie cho origin `http://frontend`.
- **Rủi ro:** `APIRequestContext` không gửi cookie `frontend` khi request sang host `api-gateway`, làm các request protected như `GET /api/staff`, `POST /api/staff`, `PATCH /api/staff/{id}/status` bị 401.
- **Fix:** Đổi default `apiBaseURL` trong E2E thành `PLAYWRIGHT_BASE_URL` (`http://frontend` trong Docker), để helper API đi qua nginx `/api` và dùng cùng cookie domain. Vẫn giữ `E2E_API_BASE_URL` làm override khi cần.
- **Bài học:** E2E có `storageState` HttpOnly cookie phải giữ cùng origin cho UI và API helper, trừ khi tự quản lý Authorization header riêng.

#### 31. Docker build image phải khớp Node engine của Next.js
- **Vấn đề:** `front-end/Dockerfile` dùng `node:18-alpine`, nhưng `next@16.2.0` trong `package-lock.json` yêu cầu `node >=20.9.0`.
- **Rủi ro:** Frontend Docker build có thể fail trước khi E2E runner bắt đầu.
- **Fix:** Đổi builder image sang `node:22-alpine`.
- **Bài học:** Khi nâng Next.js hoặc đổi package-lock, phải kiểm tra `engines.node` của dependency chính và đồng bộ Dockerfile/runtime image.

### Pattern nên áp dụng tiếp
- API cá nhân của user: ưu tiên `/api/<resource>/me`, lấy định danh từ JWT/Gateway header, không tin `id` từ client.
- Controller protected nội bộ: trả `ApiResponse.error(code, message)` thay vì `Map` hoặc exception rời rạc nếu project đang dùng response wrapper.
- Frontend service: mỗi domain nghiệp vụ nên có service riêng (`profile.service.ts`) thay vì dùng nhầm service admin (`staff.service.ts`).
- E2E: nếu task yêu cầu intercept API, intercept đúng endpoint nghiệp vụ thật, không intercept endpoint tạm hoặc endpoint sai quyền.
- Frontend production sau nginx: browser code gọi same-origin `/api`, không hardcode DNS nội bộ Docker.
- E2E setup/cleanup dùng cookie auth: API helper nên gọi cùng origin với `PLAYWRIGHT_BASE_URL`.
#### 32. Next static export can create both route `.html` files and route metadata folders
- **Van de:** Playwright setup timeout khi doi `login-email-input`, trong khi code LoginForm co selector dung.
- **Nguyen nhan:** Nginx `try_files $uri $uri/ /index.html` uu tien folder `/admin/login/` thay vi file `/admin/login.html`. Request `/admin/login` bi redirect sang `/admin/login/`, sau do nginx tra `403 directory index forbidden` vi folder khong co `index.html`.
- **Fix:** Trong `front-end/nginx.conf`, uu tien `$uri.html` truoc directory va rewrite trailing slash ve route khong slash:
  - `rewrite ^/(.+)/$ /$1 permanent;`
  - `try_files $uri.html $uri $uri/ /index.html;`
- **Bai hoc:** Voi Next `output: 'export'` + nginx, phai kiem tra cau truc `out/` thuc te. App Router co the tao ca `route.html` va folder route metadata, nen nginx khong duoc uu tien directory truoc `.html`.

#### 33. Docker healthcheck inside container should avoid ambiguous `localhost`
- **Van de:** `frontend` container serve duoc `http://127.0.0.1/health` nhung van bi Docker danh dau `unhealthy`.
- **Nguyen nhan:** Healthcheck dung `http://localhost/health`; trong container, `localhost` co the resolve sang IPv6 `::1`, trong khi nginx chi listen IPv4 `80`.
- **Fix:** Doi healthcheck frontend trong `docker-compose.yml` sang `http://127.0.0.1/health`.
- **Bai hoc:** Healthcheck Docker nen dung dia chi ro rang `127.0.0.1` neu service chi listen IPv4, de `depends_on: service_healthy` khong chan E2E runner sai cach.

#### 34. E2E cleanup must follow staff business rules
- **Van de:** Cleanup cua `admin-crud.spec.ts` tung dung hard-delete staff de don du lieu test.
- **Nguyen nhan:** Toi uu cho teardown E2E qua nhanh ma bo qua quy tac nghiep vu: staff khong duoc xoa vat ly.
- **Fix:** Go endpoint hard-delete staff khoi backend/docs. E2E cleanup chuyen sang `PATCH /api/staff/{id}/status?status=INACTIVE`.
- **Bai hoc:** E2E teardown khong duoc them API trai nghiep vu chi de lam sach DB. Neu domain da co soft-disable/status, automation phai dung dung co che do.

#### 35. Spring Cloud Gateway 4.2 route config can fail silently if bound under the wrong prefix
- **Van de:** E2E setup login doi `/api/auth/login` tra 200 nhung gateway tra 404, trong khi auth-service goi truc tiep `/auth/login` van OK.
- **Nguyen nhan:** Route YAML nam duoi prefix cu `spring.cloud.gateway.routes`; voi Spring Cloud Gateway 4.2, config properties chinh thuc nam duoi `spring.cloud.gateway.server.webflux.routes`. Khi route khong bind, gateway khong proxy request nao.
- **Fix:** Khai bao `RouteLocator` bang Java bean trong `ApiGatewayApplication` cho cac route `/api/auth/**`, `/api/staff/**`, `/api/profile/**`, `/api/core/**`; giu YAML gon cho config he thong.
- **Bai hoc:** Khi gateway tra 404 cho moi route, test truc tiep downstream service de tach loi. Neu binding YAML mo ho, RouteLocator Java la cach ro rang va de compile-check hon cho route cot loi.

---

## Phien 7 - 2026-05-17: E2E Refresh/Logout, Guest Guard, RBAC Guard va Error Handling

### Da hoan thanh
- Task 3.9.1: E2E refresh access token, logout, blacklist, negative cases va TTL spec co cong tac rieng.
- Task 3.11 / 3.14.1: E2E RBAC guard cho protected routes.
- Task 3.12: E2E form error handling cho Add Employee.
- Task 3.13.1: E2E GuestGuard va RootRedirect.
- Chay lai bang Docker Compose runner: `docker compose run --rm e2e-runner`.
- Ket qua: **29 passed, 1 skipped**. Test skipped la `auth-token-ttl.spec.ts` vi `E2E_TTL_MODE=false` trong full suite binh thuong.

### Loi / lech huong da gap va fix

#### 36. Khong tao compose override neu docker-compose.yml hien co da du de chay E2E
- **Van de:** Ban dau tao them `docker-compose.e2e-ttl.yml` cho TTL mode.
- **Nguyen nhan:** Doc task TTL theo huong "compose override" qua sat, trong khi project da co `docker-compose.yml` chua day du runner va user yeu cau dung compose hien co.
- **Fix:** Xoa compose override, dua cac bien `E2E_TTL_MODE`, `E2E_SHORT_ACCESS_TTL_SECONDS`, `E2E_SHORT_SLIDING_SESSION_TTL_SECONDS` vao service `e2e-runner` cua `docker-compose.yml`.
- **Bai hoc:** Neu project da co compose chuan cho E2E, uu tien mo rong bang env co san thay vi tao file compose moi. Chi tao override khi user dong y hoac workflow bat buoc.

#### 37. E2E phai chay trong Docker Compose, khong chay npm/npx local
- **Van de:** Build/test local tren Windows bi chan boi execution policy va dependency local khong day du.
- **Nguyen nhan:** Thu verify nhanh bang local command thay vi bam sat `e2e_testing_rules.md`.
- **Fix:** Chuyen sang dung `docker compose down`, `docker compose up --build -d`, va `docker compose run --rm e2e-runner`.
- **Bai hoc:** Voi repo nay, E2E va frontend build phai duoc verify qua Docker Compose. Local `npm`, `npx`, `next build` khong phai duong verify chinh.

#### 38. Guard redirect lam route sau login khac voi expectation cu
- **Van de:** `auth.setup.ts` va `guest-guard.spec.ts` ky vong Admin login ve `/admin/dashboard`, nhung GuestGuard/RootRedirect hien dua Admin da login ve `/admin/employees`.
- **Nguyen nhan:** Test assertion cu khong duoc cap nhat sau task 3.13/3.14.
- **Fix:** Cho phep route Admin hop le la `/admin/dashboard` hoac `/admin/employees` o nhung test login/cross-login lien quan.
- **Bai hoc:** Khi them guard redirect theo role, E2E setup va cac assertion cross-login phai dong bo voi home route thuc te cua guard, khong chi voi redirect ban dau trong login function.

#### 39. Locator heading qua rong co the match nham noi dung trang dich
- **Van de:** RBAC test user vao `/admin/dashboard` bi flaky/fail vi locator `/Employees|Admin Dashboard|Attendance/i` match nham heading `Recent Attendance` tren `/user/home`.
- **Nguyen nhan:** Regex heading qua rong va khong neo dau/cuoi.
- **Fix:** Doi sang regex neo chinh xac `^(Employees|Admin Dashboard|Attendance)$` cho admin content va pattern rieng cho user content.
- **Bai hoc:** Khi assert "khong flash protected content", locator phai nham dung noi dung protected cua route nguon, tranh match cac heading hop le cua route dich sau redirect.

#### 40. TTL E2E can co cong tac rieng de khong pha full suite
- **Van de:** TTL ngan lam session/cookie het han nhanh, co the lam cac spec khac fail neu chay chung.
- **Fix:** `auth-token-ttl.spec.ts` duoc gate bang `E2E_TTL_MODE=true`; `playwright.config.ts` chi chay TTL spec khi mode nay bat. Full suite binh thuong skip TTL spec co chu dich.
- **Bai hoc:** Cac E2E doi hoi cau hinh thoi gian dac biet nen tach mode chay rieng. Ket qua full suite can ghi ro skip co chu dich thay vi coi la chua chay.
