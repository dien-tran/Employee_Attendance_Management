package com.attendance.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.Map;

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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Kịch bản End-to-End liền mạch:
     * 1. POST /api/staff  → Tạo nhân viên mới, trích xuất UUID id từ response.
     * 2. PATCH /api/staff/{id}/status?status=INACTIVE → Đổi trạng thái sang INACTIVE.
     * 3. GET /api/staff   → Lấy danh sách, kiểm tra nhân viên đó đã là INACTIVE.
     */
    @Test
    @DisplayName("E2E: Tạo nhân viên → Đổi trạng thái INACTIVE → Kiểm tra danh sách")
    void testCreateStaff_ThenChangeStatusToInactive_ThenVerifyInList() throws Exception {

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
                .andExpect(jsonPath("$.status").value("INACTIVE"));

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: GET /api/staff — Kiểm tra nhân viên đã chuyển sang INACTIVE
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
                ));
    }
}
