package com.attendance.auth.service;

import com.attendance.auth.dto.request.StaffCreationRequest;
import com.attendance.auth.dto.request.StaffUpdateRequest;
import com.attendance.auth.dto.response.StaffResponse;
import com.attendance.auth.entity.Staff;
import com.attendance.auth.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;  // đang sửa

@Slf4j
@Service
@RequiredArgsConstructor
public class StaffService {

    private final StaffRepository staffRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    /**
     * Tạo nhân viên mới (Admin Flow).
     * - Tự động sinh staff_id theo format "NV" + 6 chữ số (VD: NV000001).
     * - Mật khẩu mặc định = ngày sinh định dạng ddMMyyyy, được hash bằng BCrypt.
     * - Trạng thái mặc định: ACTIVE.
     * - Role mặc định: USER (nếu không truyền).
     */
    @Transactional
    public StaffResponse createStaff(StaffCreationRequest request) {
        // 1. Kiểm tra email đã tồn tại chưa
        if (staffRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already exists: " + request.getEmail());
        }

        // 2. Tự động tạo staff_id duy nhất theo format NV + 6 chữ số
        String staffId = generateUniqueStaffId();

        // 3. Tạo mật khẩu mặc định từ ngày sinh (format: ddMMyyyy)
        //    Ví dụ: dob = 1999-05-20 -> password = "20051999"
        LocalDate dob = request.getDob();
        String rawPassword = dob.format(DateTimeFormatter.ofPattern("ddMMyyyy"));
        String hashedPassword = passwordEncoder.encode(rawPassword);
        log.debug("Staff {} - default password generated from dob (hashed)", staffId);

        // 4. Xác định role (mặc định USER)
        String role = (request.getRole() != null && !request.getRole().isBlank())
                ? request.getRole().toUpperCase()
                : "USER";

        // 5. Xác định ngày onboard (mặc định hôm nay nếu không truyền)
        LocalDate onboardDate = (request.getOnboardDate() != null)
                ? request.getOnboardDate()
                : LocalDate.now();

        // 6. Build và lưu entity Staff
        Staff staff = Staff.builder()
                .staffId(staffId)
                .name(request.getName())
                .email(request.getEmail())
                .dob(dob)
                .department(request.getDepartment())
                .position(request.getPosition())
                .onboardDate(onboardDate)
                .phone(request.getPhone())
                .identityCard(request.getIdentityCard())
                .bankAccount(request.getBankAccount())
                .bankName(request.getBankName())
                .password(hashedPassword)
                .role(role)
                .status("ACTIVE")
                .build();

        Staff savedStaff = staffRepository.save(staff);
        log.info("New staff created: staffId={}, name={}, role={}", savedStaff.getStaffId(), savedStaff.getName(), savedStaff.getRole());

        // 7. Map sang StaffResponse (không trả về password)
        return mapToResponse(savedStaff);
    }

    /**
     * Lấy danh sách toàn bộ nhân viên.
     * Ánh xạ từ Staff entity sang StaffResponse DTO.
     */
    public List<StaffResponse> getAllStaff() {
        log.info("Fetching all staff members from database");
        return staffRepository.findAll().stream()
                .map(this::mapToResponse)
                .toList();
    }

    /**
     * Cập nhật thông tin nhân viên (Tách biệt hoàn toàn với logic đổi trạng thái).
     * Đang sửa
     */
    @Transactional
    public StaffResponse updateStaff(UUID id, StaffUpdateRequest request) {
        Staff staff = staffRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Staff not found with ID: " + id));

        if (request.getName() != null && !request.getName().isBlank()) staff.setName(request.getName());
        if (request.getDepartment() != null) staff.setDepartment(request.getDepartment());
        if (request.getPosition() != null) staff.setPosition(request.getPosition());
        if (request.getPhone() != null) staff.setPhone(request.getPhone());
        if (request.getIdentityCard() != null) staff.setIdentityCard(request.getIdentityCard());
        if (request.getBankAccount() != null) staff.setBankAccount(request.getBankAccount());
        if (request.getBankName() != null) staff.setBankName(request.getBankName());
        if (request.getRole() != null && !request.getRole().isBlank()) staff.setRole(request.getRole().toUpperCase());

        Staff updatedStaff = staffRepository.save(staff);
        log.info("Staff updated: id={}, staffId={}", updatedStaff.getId(), updatedStaff.getStaffId());

        return mapToResponse(updatedStaff);
    }

    /**
     * Thay đổi trạng thái nhân viên (Ví dụ: ACTIVE, INACTIVE) phục vụ cho tính năng Khóa/Mở Khóa thay vì xóa vật lý.
     * Đang sửa
     */
    @Transactional
    public StaffResponse changeStaffStatus(UUID id, String status) {
        Staff staff = staffRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Staff not found with ID: " + id));

        staff.setStatus(status.toUpperCase());
        Staff savedStaff = staffRepository.save(staff);
        log.info("Staff status changed: id={}, staffId={}, newStatus={}", id, staff.getStaffId(), status);
        
        return mapToResponse(savedStaff);
    }

    /**
     * Sinh staff_id duy nhất theo format "NV" + 6 chữ số.
     * Tìm số thứ tự lớn nhất hiện có trong DB rồi tăng lên 1.
     * Nếu chưa có nhân viên nào, bắt đầu từ NV000001.
     */
    private String generateUniqueStaffId() {
        // Lấy tất cả staffId có prefix "NV" và tìm số lớn nhất
        long maxNumber = staffRepository.findAll().stream()
                .map(Staff::getStaffId)
                .filter(id -> id != null && id.startsWith("NV") && id.length() == 8)
                .mapToLong(id -> {
                    try {
                        return Long.parseLong(id.substring(2));
                    } catch (NumberFormatException e) {
                        return 0L;
                    }
                })
                .max()
                .orElse(0L);

        long nextNumber = maxNumber + 1;
        String candidateId = String.format("NV%06d", nextNumber);

        // Đảm bảo không trùng (phòng trường hợp race condition)
        while (staffRepository.existsByStaffId(candidateId)) {
            nextNumber++;
            candidateId = String.format("NV%06d", nextNumber);
        }

        return candidateId;
    }

    /**
     * Map Staff entity sang StaffResponse DTO (không bao gồm password).
     */
    private StaffResponse mapToResponse(Staff staff) {
        return StaffResponse.builder()
                .id(staff.getId())
                .staffId(staff.getStaffId())
                .name(staff.getName())
                .email(staff.getEmail())
                .dob(staff.getDob())
                .department(staff.getDepartment())
                .position(staff.getPosition())
                .onboardDate(staff.getOnboardDate())
                .phone(staff.getPhone())
                .identityCard(staff.getIdentityCard())
                .bankAccount(staff.getBankAccount())
                .bankName(staff.getBankName())
                .role(staff.getRole())
                .status(staff.getStatus())
                .build();
    }
}
