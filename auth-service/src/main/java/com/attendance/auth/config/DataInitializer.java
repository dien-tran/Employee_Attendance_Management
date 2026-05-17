package com.attendance.auth.config;

import com.attendance.auth.entity.Staff;
import com.attendance.auth.repository.StaffRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;

/**
 * DataInitializer: Tự động tạo tài khoản ADMIN hệ thống khi khởi động.
 * Chỉ tạo nếu chưa tồn tại (idempotent).
 *
 * Admin seed is controlled by environment-backed properties so production
 * deployments do not carry default credentials in source code.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final StaffRepository staffRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    @Value("${app.seed-admin.enabled:false}")
    private boolean seedAdminEnabled;

    @Value("${app.seed-admin.email:}")
    private String adminEmail;

    @Value("${app.seed-admin.password:}")
    private String adminPassword;

    @Value("${app.seed-admin.staff-id:SYS000001}")
    private String adminStaffId;

    @Override
    public void run(ApplicationArguments args) {
        if (!seedAdminEnabled) {
            log.info("[DataInitializer] Admin seed is disabled.");
            return;
        }

        if (!StringUtils.hasText(adminEmail) || !StringUtils.hasText(adminPassword)) {
            throw new IllegalStateException("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required when SEED_ADMIN_ENABLED=true");
        }

        if (staffRepository.existsByEmail(adminEmail)) {
            log.info("[DataInitializer] Admin account already exists, skipping seed.");
            return;
        }

        Staff admin = Staff.builder()
                .staffId(adminStaffId)
                .name("System Administrator")
                .email(adminEmail)
                .dob(LocalDate.of(1990, 1, 1))
                .department("IT")
                .position("System Admin")
                .onboardDate(LocalDate.now())
                .phone("0900000000")
                .identityCard("000000000000")
                .bankAccount("0000000000")
                .bankName("Vietcombank")
                .password(passwordEncoder.encode(adminPassword))
                .role("ADMIN")
                .status("ACTIVE")
                .build();

        staffRepository.save(admin);
        log.info("[DataInitializer] Admin account created: email={}, staffId={}", adminEmail, adminStaffId);
    }
}
