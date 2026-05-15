package com.attendance.auth.config;

import com.attendance.auth.entity.Staff;
import com.attendance.auth.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * DataInitializer: Tự động tạo tài khoản ADMIN hệ thống khi khởi động.
 * Chỉ tạo nếu chưa tồn tại (idempotent).
 *
 * Tài khoản mặc định:
 *   - Email   : admin@example.com
 *   - Password: admin123
 *   - Role    : ADMIN
 *   - StaffId : SYS000001
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final StaffRepository staffRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    private static final String ADMIN_EMAIL    = "admin@example.com";
    private static final String ADMIN_PASSWORD = "admin123";
    private static final String ADMIN_STAFF_ID = "SYS000001";

    @Override
    public void run(ApplicationArguments args) {
        if (staffRepository.existsByEmail(ADMIN_EMAIL)) {
            log.info("[DataInitializer] Admin account already exists, skipping seed.");
            return;
        }

        Staff admin = Staff.builder()
                .staffId(ADMIN_STAFF_ID)
                .name("System Administrator")
                .email(ADMIN_EMAIL)
                .dob(LocalDate.of(1990, 1, 1))
                .department("IT")
                .position("System Admin")
                .onboardDate(LocalDate.now())
                .phone("0900000000")
                .identityCard("000000000000")
                .bankAccount("0000000000")
                .bankName("Vietcombank")
                .password(passwordEncoder.encode(ADMIN_PASSWORD))
                .role("ADMIN")
                .status("ACTIVE")
                .build();

        staffRepository.save(admin);
        log.info("[DataInitializer] ✅ Admin account created: email={}, staffId={}", ADMIN_EMAIL, ADMIN_STAFF_ID);
    }
}
