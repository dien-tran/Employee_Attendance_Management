package com.attendance.auth.controller;

import com.attendance.auth.dto.request.IntrospectRequest;
import com.attendance.auth.dto.request.LoginRequest;
import com.attendance.auth.dto.response.ApiResponse;
import com.attendance.auth.dto.response.IntrospectResponse;
import com.attendance.auth.dto.response.LoginResponse;
import com.attendance.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * POST /auth/login
     * Đăng nhập bằng email hoặc staffId + password
     * Trả về JWT trong HttpOnly Cookie và trong body
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {

        LoginResponse loginResponse = authService.login(request);

        // Set HttpOnly Cookie
        Cookie cookie = new Cookie("access_token", loginResponse.getToken());
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set true khi dùng HTTPS
        cookie.setPath("/");
        cookie.setMaxAge((int) loginResponse.getExpiresIn());
        response.addCookie(cookie);

        return ResponseEntity.ok(ApiResponse.success("Login successful", loginResponse));
    }

    /**
     * POST /auth/introspect
     * Kiểm tra token có hợp lệ không (dùng bởi API Gateway)
     */
    @PostMapping("/introspect")
    public ResponseEntity<ApiResponse<IntrospectResponse>> introspect(
            @Valid @RequestBody IntrospectRequest request) {

        IntrospectResponse introspectResponse = authService.introspect(request);
        return ResponseEntity.ok(ApiResponse.success(introspectResponse));
    }

    /**
     * POST /auth/logout
     * Đăng xuất: invalidate token, xóa cookie
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            HttpServletRequest request,
            HttpServletResponse response) {

        // Lấy token từ cookie
        String token = null;
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    token = cookie.getValue();
                    break;
                }
            }
        }

        // Fallback: lấy từ Authorization header
        if (token == null) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }

        if (token != null) {
            authService.logout(token);
        }

        // Xóa cookie
        Cookie cookie = new Cookie("access_token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok(ApiResponse.success("Logout successful", null));
    }
}
