package com.attendance.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

/**
 * Integration Test cho StaffController.
 *
 * - @SpringBootTest: Khởi động toàn bộ ApplicationContext (không mock service/repository).
 * - @AutoConfigureMockMvc: Tự động cấu hình MockMvc để gửi HTTP request mà không cần bật server thật.
 * - @ActiveProfiles("test"): Dùng application-test.yml (H2 in-memory DB).
 * - @Transactional: Spring tự động rollback sau mỗi test, không cần dọn dẹp tay.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class StaffIntegrationTest {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";
    private static final String TEST_INTERNAL_SIGNING_KEY = "test-internal-signing-key-for-hs512-must-be-at-least-64-bytes-long";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Kịch bản End-to-End liền mạch:
     * 1. POST /api/staff  → Tạo nhân viên mới, trích xuất UUID id từ response.
     * 2. PATCH /api/staff/{id}/status?status=INACTIVE → Đổi trạng thái sang INACTIVE.
     * 3. PATCH /api/staff/{id}/face-status?hasFace=true → Đánh dấu đã đăng ký khuôn mặt.
     * 4. GET /api/staff   → Lấy danh sách, kiểm tra nhân viên đó đã là INACTIVE và hasFace=true.
     */
    @Test
    @DisplayName("E2E: Tạo nhân viên → Đổi trạng thái → Đổi face status → Kiểm tra danh sách")
    void testCreateStaff_ThenChangeStatusAndFaceStatus_ThenVerifyInList() throws Exception {

        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: POST /api/staff — Tạo nhân viên mới
        // ─────────────────────────────────────────────────────────────────────
        Map<String, Object> createRequest = Map.of(
                "name", "Nguyen Van Test",
                "email", "test.integration@company.com",
                "dob", "1998-03-20",
                "department", "IT",
                "position", "Developer",
                "phone", "0912345678",
                "identityCard", "079098001234",
                "bankAccount", "9876543210",
                "bankName", "Techcombank",
                "role", "USER"
        );

        MvcResult createResult = mockMvc.perform(
                        post("/api/staff")
                                .header("X-User-Roles", "ROLE_ADMIN")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(createRequest))
                )
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(201))
                .andExpect(jsonPath("$.message").value("Staff created successfully"))
                .andExpect(jsonPath("$.result.id").isNotEmpty())
                .andExpect(jsonPath("$.result.name").value("Nguyen Van Test"))
                .andExpect(jsonPath("$.result.email").value("test.integration@company.com"))
                .andExpect(jsonPath("$.result.status").value("ACTIVE"))
                .andExpect(jsonPath("$.result.hasFace").value(false))
                .andReturn();

        // Trích xuất UUID id từ JSON response bằng JsonPath
        String createResponseBody = createResult.getResponse().getContentAsString();
        String staffId = com.jayway.jsonpath.JsonPath.read(createResponseBody, "$.result.id");

        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: PATCH /api/staff/{id}/status?status=INACTIVE
        // ─────────────────────────────────────────────────────────────────────
        mockMvc.perform(
                        patch("/api/staff/{id}/status", staffId)
                                .header("X-User-Roles", "ROLE_ADMIN")
                                .param("status", "INACTIVE")
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.status").value("INACTIVE"));

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: PATCH /api/staff/{id}/face-status?hasFace=true
        // ─────────────────────────────────────────────────────────────────────
        mockMvc.perform(
                        patch("/api/staff/{id}/face-status", staffId)
                                .header("X-User-Roles", "ROLE_ADMIN")
                                .param("hasFace", "true")
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.hasFace").value(true));

        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: GET /api/staff — Kiểm tra nhân viên đã chuyển sang INACTIVE và hasFace=true
        // ─────────────────────────────────────────────────────────────────────
        mockMvc.perform(
                        get("/api/staff")
                                .header("X-User-Roles", "ROLE_ADMIN")
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result[*].id", hasItem(staffId)))
                .andExpect(jsonPath(
                        "$.result[?(@.id == '" + staffId + "')].status",
                        hasItem("INACTIVE")
                ))
                .andExpect(jsonPath(
                        "$.result[?(@.id == '" + staffId + "')].hasFace",
                        hasItem(true)
                ));
    }

    @Test
    @DisplayName("Internal staff lookup: valid JWT returns staff by staffId")
    void internalStaffLookup_WithValidJwt_ReturnsStaff() throws Exception {
        Map<String, Object> createRequest = Map.of(
                "name", "Internal Lookup User",
                "email", "internal.lookup@company.com",
                "dob", "1998-03-20",
                "department", "IT",
                "position", "Developer",
                "phone", "0912345678",
                "identityCard", "079098001235",
                "bankAccount", "9876543211",
                "bankName", "Techcombank",
                "role", "USER"
        );

        MvcResult createResult = mockMvc.perform(
                        post("/api/staff")
                                .header("X-User-Roles", "ROLE_ADMIN")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(createRequest))
                )
                .andExpect(status().isCreated())
                .andReturn();

        String createResponseBody = createResult.getResponse().getContentAsString();
        String staffCode = com.jayway.jsonpath.JsonPath.read(createResponseBody, "$.result.staffId");

        mockMvc.perform(
                        get("/api/internal/staff/{staffId}", staffCode)
                                .header(INTERNAL_TOKEN_HEADER, "Bearer " + createInternalJwt())
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.staffId").value(staffCode))
                .andExpect(jsonPath("$.result.name").value("Internal Lookup User"))
                .andExpect(jsonPath("$.result.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("Internal staff lookup: missing staffId returns employee not found")
    void internalStaffLookup_WithMissingStaff_ReturnsNotFound() throws Exception {
        mockMvc.perform(
                        get("/api/internal/staff/{staffId}", "NV999999")
                                .header(INTERNAL_TOKEN_HEADER, "Bearer " + createInternalJwt())
                )
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("EMPLOYEE_NOT_FOUND"));
    }

    private String createInternalJwt() throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("ai-service")
                .audience("auth-service")
                .claim("scope", "staff:face-status")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(900)))
                .jwtID(UUID.randomUUID().toString())
                .build();

        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS512), claims);
        signedJWT.sign(new MACSigner(TEST_INTERNAL_SIGNING_KEY.getBytes()));
        return signedJWT.serialize();
    }
}
