package com.attendance.core.service;

import com.attendance.core.dto.request.SyncAttendanceRequest;
import com.attendance.core.entity.Attendance;
import com.attendance.core.exception.InternalAttendanceSyncException;
import com.attendance.core.repository.AttendanceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AttendanceService {

    private final AttendanceRepository attendanceRepository;

    /**
     * Chấm công thủ công (Fallback khi camera lỗi)
     * userId được lấy từ Header X-User-Id do API Gateway truyền xuống
     * KHÔNG dùng JWT
     *
     * @param staffId  Mã nhân viên (từ X-User-Id header)
     * @param type     CHECK_IN hoặc CHECK_OUT
     */
    public Attendance checkIn(String staffId, String type) {
        LocalDateTime now = LocalDateTime.now();
        LocalDate today = now.toLocalDate();

        // Kiểm tra xem đã chấm công loại này hôm nay chưa (chỉ cảnh báo, không chặn)
        attendanceRepository.findTopByStaffIdAndTypeAndDateOrderByTimestampDesc(staffId, type, today)
                .ifPresent(existing -> log.warn(
                        "Staff {} already has {} record today at {}",
                        staffId, type, existing.getTimestamp()));

        Attendance attendance = Attendance.builder()
                .staffId(staffId)
                .type(type.toUpperCase())
                .timestamp(now)
                .date(today)
                .build();

        Attendance saved = attendanceRepository.save(attendance);
        log.info("Attendance recorded: staffId={}, type={}, time={}", staffId, type, now);
        return saved;
    }

    public Attendance syncAttendance(SyncAttendanceRequest request) {
        LocalDate attendanceDate = request.getDate() != null
                ? request.getDate()
                : request.getTimestamp().toLocalDate();
        String normalizedType = request.getType().toUpperCase();

        attendanceRepository.findTopByStaffIdAndTypeAndDateOrderByTimestampDesc(
                        request.getStaffId(),
                        normalizedType,
                        attendanceDate)
                .ifPresent(existing -> {
                    throw new InternalAttendanceSyncException(
                            HttpStatus.CONFLICT,
                            "ALREADY_RECORDED",
                            "Attendance has already been recorded for this date");
                });

        if ("CHECK_OUT".equals(normalizedType)
                && attendanceRepository.findTopByStaffIdAndTypeAndDateOrderByTimestampDesc(
                        request.getStaffId(),
                        "CHECK_IN",
                        attendanceDate).isEmpty()) {
            throw new InternalAttendanceSyncException(
                    HttpStatus.BAD_REQUEST,
                    "CHECKOUT_WITHOUT_CHECKIN",
                    "Checkout requires a check-in record on the same date");
        }

        Attendance attendance = Attendance.builder()
                .staffId(request.getStaffId())
                .type(normalizedType)
                .timestamp(request.getTimestamp())
                .date(attendanceDate)
                .onTime(request.getOnTime())
                .build();

        Attendance saved = attendanceRepository.save(attendance);
        log.info(
                "Internal attendance synced: staffId={}, type={}, timestamp={}, onTime={}",
                saved.getStaffId(),
                saved.getType(),
                saved.getTimestamp(),
                saved.getOnTime());
        return saved;
    }

    /**
     * Lấy lịch sử chấm công của nhân viên theo tháng
     */
    public List<Attendance> getMyAttendance(String staffId, LocalDate startDate, LocalDate endDate) {
        return attendanceRepository.findByStaffIdAndDateBetween(staffId, startDate, endDate);
    }

    /**
     * Lấy tất cả chấm công hôm nay (Admin)
     */
    public List<Attendance> getTodayAttendance() {
        return attendanceRepository.findByDateOrderByTimestampAsc(LocalDate.now());
    }

    /**
     * Lấy chấm công theo khoảng ngày (Admin)
     */
    public List<Attendance> getAttendanceByDateRange(LocalDate startDate, LocalDate endDate) {
        return attendanceRepository.findAllByDateBetween(startDate, endDate);
    }

    /**
     * Lấy chấm công của một nhân viên hôm nay
     */
    public List<Attendance> getStaffTodayAttendance(String staffId) {
        return attendanceRepository.findByStaffIdAndDateOrderByTimestampAsc(staffId, LocalDate.now());
    }

    public boolean deleteAttendance(UUID id) {
        if (!attendanceRepository.existsById(id)) {
            return false;
        }

        attendanceRepository.deleteById(id);
        log.info("Internal attendance deleted: id={}", id);
        return true;
    }
}
