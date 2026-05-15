package com.attendance.core.controller;

import com.attendance.core.dto.response.ApiResponse;
import com.attendance.core.entity.Attendance;
import com.attendance.core.service.AttendanceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceService attendanceService;

    /**
     * POST /attendance/check-in
     * Chấm công thủ công (CHECK_IN hoặc CHECK_OUT)
     * X-User-Id được API Gateway inject vào header - KHÔNG dùng JWT
     */
    @PostMapping("/check-in")
    public ResponseEntity<ApiResponse<Attendance>> checkIn(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(defaultValue = "CHECK_IN") String type) {

        log.info("Manual check-in request: userId={}, type={}", userId, type);
        Attendance attendance = attendanceService.checkIn(userId, type);
        return ResponseEntity.ok(ApiResponse.success("Attendance recorded successfully", attendance));
    }

    /**
     * GET /attendance/my
     * Lấy lịch sử chấm công của bản thân (User)
     * X-User-Id được API Gateway inject vào header
     */
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<Attendance>>> getMyAttendance(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        // Mặc định: tháng hiện tại
        if (startDate == null) startDate = LocalDate.now().withDayOfMonth(1);
        if (endDate == null) endDate = LocalDate.now();

        List<Attendance> records = attendanceService.getMyAttendance(userId, startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    /**
     * GET /attendance/today
     * Lấy tất cả chấm công hôm nay (Admin)
     */
    @GetMapping("/today")
    public ResponseEntity<ApiResponse<List<Attendance>>> getTodayAttendance(
            @RequestHeader("X-User-Roles") String roles) {

        if (!roles.contains("ROLE_ADMIN")) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Access denied: Admin only"));
        }

        List<Attendance> records = attendanceService.getTodayAttendance();
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    /**
     * GET /attendance/range
     * Lấy chấm công theo khoảng ngày (Admin)
     */
    @GetMapping("/range")
    public ResponseEntity<ApiResponse<List<Attendance>>> getAttendanceByRange(
            @RequestHeader("X-User-Roles") String roles,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {

        if (!roles.contains("ROLE_ADMIN")) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Access denied: Admin only"));
        }

        List<Attendance> records = attendanceService.getAttendanceByDateRange(startDate, endDate);
        return ResponseEntity.ok(ApiResponse.success(records));
    }

    /**
     * GET /attendance/staff/{staffId}/today
     * Lấy chấm công hôm nay của một nhân viên cụ thể (Admin)
     */
    @GetMapping("/staff/{staffId}/today")
    public ResponseEntity<ApiResponse<List<Attendance>>> getStaffTodayAttendance(
            @RequestHeader("X-User-Roles") String roles,
            @PathVariable String staffId) {

        if (!roles.contains("ROLE_ADMIN")) {
            return ResponseEntity.status(403)
                    .body(ApiResponse.error(403, "Access denied: Admin only"));
        }

        List<Attendance> records = attendanceService.getStaffTodayAttendance(staffId);
        return ResponseEntity.ok(ApiResponse.success(records));
    }
}
