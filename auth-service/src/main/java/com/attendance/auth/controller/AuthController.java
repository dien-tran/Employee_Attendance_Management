package com.attendance.auth.controller;

import com.attendance.auth.dto.request.IntrospectRequest;
import com.attendance.auth.dto.request.LoginRequest;
import com.attendance.auth.dto.request.TokenRequest;
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
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response) {
        try {
            LoginResponse loginResponse = authService.login(request);
            addAccessTokenCookie(response, loginResponse.getToken(), loginResponse.getExpiresIn());
            return ResponseEntity.ok(ApiResponse.success("Login successful", loginResponse));
        } catch (RuntimeException ex) {
            String message = ex.getMessage() == null ? "Authentication failed" : ex.getMessage();
            if ("Invalid credentials".equals(message) || "Account is inactive".equals(message)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(ApiResponse.error(401, message));
            }
            log.error("Unexpected login error", ex);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ApiResponse.error(500, "Internal server error"));
        }
    }

    @PostMapping("/introspect")
    public ResponseEntity<ApiResponse<IntrospectResponse>> introspect(
            @Valid @RequestBody IntrospectRequest request) {

        IntrospectResponse introspectResponse = authService.introspect(request);
        return ResponseEntity.ok(ApiResponse.success(introspectResponse));
    }

    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
            @RequestBody(required = false) TokenRequest tokenRequest,
            HttpServletRequest request,
            HttpServletResponse response) {

        String token = extractToken(request, tokenRequest);
        LoginResponse refreshResponse = authService.refresh(token);
        addAccessTokenCookie(response, refreshResponse.getToken(), refreshResponse.getExpiresIn());

        return ResponseEntity.ok(ApiResponse.success("Token refreshed successfully", refreshResponse));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestBody(required = false) TokenRequest tokenRequest,
            HttpServletRequest request,
            HttpServletResponse response) {

        String token = extractToken(request, tokenRequest);
        if (token != null) {
            authService.logout(token);
        }

        clearAccessTokenCookie(response);
        return ResponseEntity.ok(ApiResponse.success("Logout successful", null));
    }

    private String extractToken(HttpServletRequest request, TokenRequest tokenRequest) {
        if (tokenRequest != null && tokenRequest.getToken() != null && !tokenRequest.getToken().isBlank()) {
            return tokenRequest.getToken();
        }

        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("access_token".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }

        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    private void addAccessTokenCookie(HttpServletResponse response, String token, long maxAgeSeconds) {
        Cookie cookie = new Cookie("access_token", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(false);
        cookie.setPath("/");
        cookie.setMaxAge((int) maxAgeSeconds);
        response.addCookie(cookie);
    }

    private void clearAccessTokenCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie("access_token", "");
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
    }
}
