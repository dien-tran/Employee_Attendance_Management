package com.attendance.auth.controller;

import com.attendance.auth.dto.request.StaffCreationRequest;
import com.attendance.auth.dto.request.StaffUpdateRequest;
import com.attendance.auth.dto.response.ApiResponse;
import com.attendance.auth.dto.response.StaffResponse;
import com.attendance.auth.service.StaffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/staff")
@RequiredArgsConstructor
public class StaffController {

    private final StaffService staffService;

    /**
     * POST /api/staff
     * Tạo nhân viên mới - chỉ ADMIN mới được phép.
     *
     * Cơ chế bảo vệ:
     * - API Gateway đã xác thực JWT và inject header "X-User-Roles" vào request.
     * - Controller đọc header này và kiểm tra quyền ADMIN trước khi xử lý.
     * - Nếu không có quyền ADMIN -> trả về 403 Forbidden.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<StaffResponse>> createStaff(
            @RequestHeader(value = "X-User-Roles", required = false) String userRoles,
            @Valid @RequestBody StaffCreationRequest request) {

        // Kiểm tra quyền ADMIN (header được inject bởi API Gateway)
        if (userRoles == null || !userRoles.contains("ROLE_ADMIN")) {
            log.warn("Unauthorized attempt to create staff. X-User-Roles: {}", userRoles);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(403, "Access denied: ADMIN role required"));
        }

        log.info("Admin creating new staff: email={}", request.getEmail());
        StaffResponse staffResponse = staffService.createStaff(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.<StaffResponse>builder()
                        .code(201)
                        .message("Staff created successfully")
                        .result(staffResponse)
                        .build());
    }

       /**
     * GET /api/staff
     * Lấy danh sách toàn bộ nhân viên - chỉ ADMIN mới được phép.
     *
     * Cơ chế bảo vệ tương tự như tạo nhân viên.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<StaffResponse>>> getAllStaff(
            @RequestHeader(value = "X-User-Roles", required = false) String userRoles) {

        // Kiểm tra quyền ADMIN (header được inject bởi API Gateway)
        if (userRoles == null || !userRoles.contains("ROLE_ADMIN")) {
            log.warn("Unauthorized attempt to get staff list. X-User-Roles: {}", userRoles);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(403, "Access denied: ADMIN role required"));
        }

        log.info("Admin getting all staff list");
        List<StaffResponse> staffList = staffService.getAllStaff();

        return ResponseEntity.ok(
                ApiResponse.success("Staff list retrieved successfully", staffList)
        );
    }

       /**
     * API Cập nhật thông tin nhân viên
     * Yêu cầu quyền: ROLE_ADMIN
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<StaffResponse>> updateStaff(
            @RequestHeader(value = "X-User-Roles", required = false) String roles,
            @PathVariable UUID id,
            @RequestBody StaffUpdateRequest request) {
        
        // Kiểm tra quyền ROLE_ADMIN
        if (roles == null || !roles.contains("ADMIN")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(403, "Access denied: ADMIN role required"));
        }

        StaffResponse updatedStaff = staffService.updateStaff(id, request);
        return ResponseEntity.ok(ApiResponse.success("Staff updated successfully", updatedStaff));
    }

    /**
     * API Thay đổi trạng thái nhân viên (Ví dụ: ACTIVE, INACTIVE)
     * Yêu cầu quyền: ROLE_ADMIN
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<StaffResponse>> changeStaffStatus(
            @RequestHeader(value = "X-User-Roles", required = false) String roles,
            @PathVariable UUID id,
            @RequestParam String status) {
        
        // Kiểm tra quyền ROLE_ADMIN
        if (roles == null || !roles.contains("ADMIN")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(403, "Access denied: ADMIN role required"));
        }

        StaffResponse updatedStaff = staffService.changeStaffStatus(id, status);
        return ResponseEntity.ok(ApiResponse.success("Staff status updated successfully", updatedStaff));
    }

    /**
     * API cập nhật trạng thái đăng ký khuôn mặt của nhân viên.
     * Yêu cầu quyền: ROLE_ADMIN
     */
    @PatchMapping("/{id}/face-status")
    public ResponseEntity<ApiResponse<StaffResponse>> changeFaceStatus(
            @RequestHeader(value = "X-User-Roles", required = false) String roles,
            @PathVariable UUID id,
            @RequestParam boolean hasFace) {

        if (roles == null || !roles.contains("ADMIN")) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(ApiResponse.error(403, "Access denied: ADMIN role required"));
        }

        StaffResponse updatedStaff = staffService.changeFaceStatus(id, hasFace);
        return ResponseEntity.ok(ApiResponse.success("Staff face status updated successfully", updatedStaff));
    }

}
