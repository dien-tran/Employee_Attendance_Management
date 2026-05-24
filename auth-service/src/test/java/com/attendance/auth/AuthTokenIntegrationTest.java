package com.attendance.auth;

import com.attendance.auth.entity.Staff;
import com.attendance.auth.repository.InvalidatedTokenRepository;
import com.attendance.auth.repository.StaffRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jwt.SignedJWT;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthTokenIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StaffRepository staffRepository;

    @Autowired
    private InvalidatedTokenRepository invalidatedTokenRepository;

    @Test
    @DisplayName("Refresh rotates token and logout blacklists refreshed token")
    void refreshThenLogoutInvalidatesOldTokens() throws Exception {
        createActiveStaff("refresh.user@company.test", "Pass12345!");

        String originalToken = login("refresh.user@company.test", "Pass12345!");
        String originalJti = SignedJWT.parse(originalToken).getJWTClaimsSet().getJWTID();

        MvcResult refreshResult = mockMvc.perform(
                        post("/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("token", originalToken)))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Token refreshed successfully"))
                .andExpect(jsonPath("$.result.token").isNotEmpty())
                .andExpect(cookie().exists("access_token"))
                .andReturn();

        String refreshedToken = com.jayway.jsonpath.JsonPath.read(
                refreshResult.getResponse().getContentAsString(),
                "$.result.token"
        );
        String refreshedJti = SignedJWT.parse(refreshedToken).getJWTClaimsSet().getJWTID();

        assertThat(refreshedToken).isNotEqualTo(originalToken);
        assertThat(invalidatedTokenRepository.existsById(originalJti)).isTrue();
        assertTokenValidity(originalToken, false);
        assertTokenValidity(refreshedToken, true);

        mockMvc.perform(
                        post("/auth/logout")
                                .cookie(new Cookie("access_token", refreshedToken))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logout successful"))
                .andExpect(cookie().maxAge("access_token", 0));

        assertThat(invalidatedTokenRepository.existsById(refreshedJti)).isTrue();
        assertTokenValidity(refreshedToken, false);
    }

    private void assertTokenValidity(String token, boolean valid) throws Exception {
        mockMvc.perform(
                        post("/auth/introspect")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of("token", token)))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.valid").value(valid));
    }

    private String login(String username, String password) throws Exception {
        MvcResult loginResult = mockMvc.perform(
                        post("/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(Map.of(
                                        "username", username,
                                        "password", password
                                )))
                )
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.result.token").isNotEmpty())
                .andExpect(cookie().exists("access_token"))
                .andReturn();

        return com.jayway.jsonpath.JsonPath.read(
                loginResult.getResponse().getContentAsString(),
                "$.result.token"
        );
    }

    private void createActiveStaff(String email, String rawPassword) {
        Staff staff = Staff.builder()
                .staffId("TESTREF001")
                .name("Refresh Token User")
                .email(email)
                .dob(LocalDate.of(1995, 2, 15))
                .department("QA")
                .position("Tester")
                .onboardDate(LocalDate.now())
                .phone("0901234567")
                .identityCard("012345678901")
                .bankAccount("1234567890")
                .bankName("Test Bank")
                .password(new BCryptPasswordEncoder(10).encode(rawPassword))
                .role("USER")
                .status("ACTIVE")
                .build();

        staffRepository.save(staff);
    }
}
