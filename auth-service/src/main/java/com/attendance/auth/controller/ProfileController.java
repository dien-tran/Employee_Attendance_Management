package com.attendance.auth.controller;

import com.attendance.auth.dto.request.ProfileUpdateRequest;
import com.attendance.auth.dto.response.ApiResponse;
import com.attendance.auth.dto.response.StaffResponse;
import com.attendance.auth.service.StaffService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final StaffService staffService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<StaffResponse>> getMyProfile(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {

        UUID userId;
        try {
            userId = parseUserId(userIdHeader);
        } catch (IllegalArgumentException ex) {
            return unauthorized(ex.getMessage());
        }

        StaffResponse profile = staffService.getProfile(userId);

        return ResponseEntity.ok(ApiResponse.success("Profile retrieved successfully", profile));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<StaffResponse>> updateMyProfile(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestBody ProfileUpdateRequest request) {

        UUID userId;
        try {
            userId = parseUserId(userIdHeader);
        } catch (IllegalArgumentException ex) {
            return unauthorized(ex.getMessage());
        }

        StaffResponse profile = staffService.updateProfile(userId, request);

        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", profile));
    }

    private UUID parseUserId(String userIdHeader) {
        if (userIdHeader == null || userIdHeader.isBlank()) {
            log.warn("Profile request missing X-User-Id header");
            throw new IllegalArgumentException("Missing authenticated user id");
        }

        try {
            return UUID.fromString(userIdHeader);
        } catch (IllegalArgumentException ex) {
            log.warn("Profile request has invalid X-User-Id header: {}", userIdHeader);
            throw new IllegalArgumentException("Invalid authenticated user id");
        }
    }

    private ResponseEntity<ApiResponse<StaffResponse>> unauthorized(String message) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(ApiResponse.error(401, message));
    }

}
