package com.attendance.core;

import com.attendance.core.repository.AttendanceRepository;
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
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class InternalAttendanceIntegrationTest {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";
    private static final String TEST_SIGNING_KEY = "test-internal-signing-key-for-hs512-must-be-at-least-64-bytes-long";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AttendanceRepository attendanceRepository;

    @Test
    @DisplayName("M2M sync: valid internal JWT returns 201 and persists attendance")
    void syncAttendance_WithValidInternalJwt_ReturnsCreatedAndPersistsAttendance() throws Exception {
        Map<String, Object> request = Map.of(
                "staffId", "NV000001",
                "type", "CHECK_IN",
                "timestamp", "2026-05-16T08:02:15",
                "date", "2026-05-16",
                "onTime", true
        );

        mockMvc.perform(post("/api/internal/attendance/sync")
                        .header(INTERNAL_TOKEN_HEADER, "Bearer " + createInternalJwt(TEST_SIGNING_KEY))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value(201))
                .andExpect(jsonPath("$.message").value("Attendance synced successfully"))
                .andExpect(jsonPath("$.result.id").isNotEmpty())
                .andExpect(jsonPath("$.result.staffId").value("NV000001"))
                .andExpect(jsonPath("$.result.type").value("CHECK_IN"))
                .andExpect(jsonPath("$.result.timestamp").value("2026-05-16T08:02:15"))
                .andExpect(jsonPath("$.result.date").value("2026-05-16"))
                .andExpect(jsonPath("$.result.onTime").value(true));

        var savedRecords = attendanceRepository.findByStaffIdAndDateOrderByTimestampAsc(
                "NV000001",
                LocalDate.of(2026, 5, 16)
        );

        assertThat(savedRecords).hasSize(1);
        assertThat(savedRecords.getFirst().getType()).isEqualTo("CHECK_IN");
        assertThat(savedRecords.getFirst().getTimestamp()).isEqualTo(LocalDateTime.of(2026, 5, 16, 8, 2, 15));
        assertThat(savedRecords.getFirst().getOnTime()).isTrue();
    }

    @Test
    @DisplayName("M2M sync: invalid internal JWT returns 401 and does not persist attendance")
    void syncAttendance_WithInvalidInternalJwt_ReturnsUnauthorizedAndDoesNotPersistAttendance() throws Exception {
        Map<String, Object> request = Map.of(
                "staffId", "NV000002",
                "type", "CHECK_OUT",
                "timestamp", "2026-05-16T17:30:00",
                "date", "2026-05-16",
                "onTime", false
        );

        mockMvc.perform(post("/api/internal/attendance/sync")
                        .header(INTERNAL_TOKEN_HEADER, "Bearer " + createInternalJwt("wrong-internal-signing-key-for-hs512-must-be-at-least-64-bytes-long"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("Invalid internal JWT"));

        assertThat(attendanceRepository.findByStaffIdAndDateOrderByTimestampAsc(
                "NV000002",
                LocalDate.of(2026, 5, 16)
        )).isEmpty();
    }

    private String createInternalJwt(String signingKey) throws Exception {
        Instant now = Instant.now();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer("ai-service")
                .audience("core-service")
                .claim("scope", "attendance:sync")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(900)))
                .jwtID(UUID.randomUUID().toString())
                .build();

        SignedJWT signedJWT = new SignedJWT(new JWSHeader(JWSAlgorithm.HS512), claims);
        signedJWT.sign(new MACSigner(signingKey.getBytes()));
        return signedJWT.serialize();
    }
}
