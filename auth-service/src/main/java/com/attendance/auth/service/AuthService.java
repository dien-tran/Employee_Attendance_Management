package com.attendance.auth.service;

import com.attendance.auth.dto.request.IntrospectRequest;
import com.attendance.auth.dto.request.LoginRequest;
import com.attendance.auth.dto.response.IntrospectResponse;
import com.attendance.auth.dto.response.LoginResponse;
import com.attendance.auth.entity.InvalidatedToken;
import com.attendance.auth.entity.Staff;
import com.attendance.auth.repository.InvalidatedTokenRepository;
import com.attendance.auth.repository.StaffRepository;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String SESSION_ID_CLAIM = "sessionId";
    private static final String SESSION_STARTED_AT_CLAIM = "sessionStartedAt";
    private static final String SESSION_EXPIRES_AT_CLAIM = "sessionExpiresAt";

    @Value("${app.jwt.signed-key}")
    private String signedKey;

    @Value("${app.jwt.access-token-ttl-seconds}")
    private long accessTokenTtlSeconds;

    @Value("${app.jwt.sliding-session-ttl-seconds}")
    private long slidingSessionTtlSeconds;

    private final StaffRepository staffRepository;
    private final InvalidatedTokenRepository invalidatedTokenRepository;
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(10);

    /**
     * Đăng nhập: hỗ trợ cả email và staffId
     */
    public LoginResponse login(LoginRequest request) {
        // Tìm staff theo email hoặc staffId
        Staff staff = staffRepository.findByEmail(request.getUsername())
                .or(() -> staffRepository.findByStaffId(request.getUsername()))
                .orElseThrow(() -> new RuntimeException("Invalid credentials"));

        // Kiểm tra trạng thái tài khoản
        if ("INACTIVE".equals(staff.getStatus())) {
            throw new RuntimeException("Account is inactive");
        }

        // Verify password
        if (!passwordEncoder.matches(request.getPassword(), staff.getPassword())) {
            throw new RuntimeException("Invalid credentials");
        }

        // Tạo JWT token
        Instant now = Instant.now();
        Instant sessionExpiresAt = now.plus(slidingSessionTtlSeconds, ChronoUnit.SECONDS);
        String token = generateToken(staff, UUID.randomUUID().toString(), now, sessionExpiresAt, now);

        return LoginResponse.builder()
                .token(token)
                .tokenType("Bearer")
                .expiresIn(secondsUntilTokenExpiry(now, sessionExpiresAt))
                .staffId(staff.getStaffId())
                .name(staff.getName())
                .role(staff.getRole())
                .build();
    }

    public LoginResponse refresh(String token) {
        if (token == null || token.isBlank()) {
            throw new RuntimeException("Token is required");
        }

        IntrospectRequest introspectRequest = new IntrospectRequest();
        introspectRequest.setToken(token);
        IntrospectResponse introspection = introspect(introspectRequest);
        if (!introspection.isValid()) {
            throw new RuntimeException("Invalid token");
        }

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            Staff staff = resolveStaffFromClaims(claims);
            if ("INACTIVE".equals(staff.getStatus())) {
                throw new RuntimeException("Account is inactive");
            }

            Instant now = Instant.now();
            Instant sessionStartedAt = getSessionStartedAt(claims);
            Instant sessionExpiresAt = getSessionExpiresAt(claims);
            if (!sessionExpiresAt.isAfter(now)) {
                throw new RuntimeException("Session has expired");
            }

            logout(token);
            String refreshedToken = generateToken(staff, getSessionId(claims), sessionStartedAt, sessionExpiresAt, now);

            return LoginResponse.builder()
                    .token(refreshedToken)
                    .tokenType("Bearer")
                    .expiresIn(secondsUntilTokenExpiry(now, sessionExpiresAt))
                    .staffId(staff.getStaffId())
                    .name(staff.getName())
                    .role(staff.getRole())
                    .build();
        } catch (ParseException e) {
            log.warn("Failed to parse token during refresh: {}", e.getMessage());
            throw new RuntimeException("Invalid token");
        }
    }

    /**
     * Introspect: kiểm tra token có hợp lệ và không bị blacklist không
     * Được gọi bởi API Gateway
     */
    public IntrospectResponse introspect(IntrospectRequest request) {
        String token = request.getToken();

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(signedKey.getBytes());

            // Verify chữ ký
            if (!signedJWT.verify(verifier)) {
                return IntrospectResponse.builder().valid(false).build();
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            // Kiểm tra thời hạn
            Date expirationTime = claims.getExpirationTime();
            if (expirationTime == null || expirationTime.before(new Date())) {
                return IntrospectResponse.builder().valid(false).build();
            }

            // Kiểm tra blacklist (đã logout chưa)
            Instant sessionExpiresAt = getSessionExpiresAt(claims);
            if (!sessionExpiresAt.isAfter(Instant.now())) {
                return IntrospectResponse.builder().valid(false).build();
            }

            String jti = claims.getJWTID();
            if (invalidatedTokenRepository.existsById(jti)) {
                log.info("Token {} is blacklisted (logged out)", jti);
                return IntrospectResponse.builder().valid(false).build();
            }

            String userId = claims.getClaim("userId") != null
                    ? claims.getClaim("userId").toString()
                    : claims.getSubject();
            String roles = claims.getClaim("scope") != null
                    ? claims.getClaim("scope").toString()
                    : "";

            return IntrospectResponse.builder()
                    .valid(true)
                    .userId(userId)
                    .roles(roles)
                    .build();

        } catch (ParseException | JOSEException e) {
            log.warn("Token introspect failed: {}", e.getMessage());
            return IntrospectResponse.builder().valid(false).build();
        }
    }

    /**
     * Logout: thêm token vào blacklist
     */
    public void logout(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            String jti = claims.getJWTID();
            Date expiryTime = claims.getExpirationTime();

            InvalidatedToken invalidatedToken = InvalidatedToken.builder()
                    .id(jti)
                    .expiryTime(expiryTime)
                    .build();

            invalidatedTokenRepository.save(invalidatedToken);
            log.info("Token {} has been invalidated (logout)", jti);

        } catch (ParseException e) {
            log.warn("Failed to parse token during logout: {}", e.getMessage());
            throw new RuntimeException("Invalid token");
        }
    }

    private Staff resolveStaffFromClaims(JWTClaimsSet claims) {
        Object userId = claims.getClaim("userId");
        if (userId != null) {
            try {
                return staffRepository.findById(UUID.fromString(userId.toString()))
                        .orElseThrow(() -> new RuntimeException("Staff not found"));
            } catch (IllegalArgumentException e) {
                throw new RuntimeException("Invalid userId claim");
            }
        }

        return staffRepository.findByEmail(claims.getSubject())
                .orElseThrow(() -> new RuntimeException("Staff not found"));
    }

    private String getSessionId(JWTClaimsSet claims) {
        Object sessionId = claims.getClaim(SESSION_ID_CLAIM);
        return sessionId != null ? sessionId.toString() : UUID.randomUUID().toString();
    }

    private Instant getSessionStartedAt(JWTClaimsSet claims) {
        Object sessionStartedAt = claims.getClaim(SESSION_STARTED_AT_CLAIM);
        if (sessionStartedAt == null) {
            return claims.getIssueTime().toInstant();
        }

        return Instant.ofEpochSecond(Long.parseLong(sessionStartedAt.toString()));
    }

    private Instant getSessionExpiresAt(JWTClaimsSet claims) {
        Object sessionExpiresAt = claims.getClaim(SESSION_EXPIRES_AT_CLAIM);
        if (sessionExpiresAt == null) {
            return claims.getExpirationTime().toInstant();
        }

        return Instant.ofEpochSecond(Long.parseLong(sessionExpiresAt.toString()));
    }

    private long secondsUntilTokenExpiry(Instant now, Instant sessionExpiresAt) {
        validateTokenTtlConfig();
        return Math.min(accessTokenTtlSeconds, Math.max(0, now.until(sessionExpiresAt, ChronoUnit.SECONDS)));
    }

    private void validateTokenTtlConfig() {
        if (accessTokenTtlSeconds <= 0) {
            throw new IllegalStateException("JWT_ACCESS_TOKEN_TTL_SECONDS must be greater than 0");
        }

        if (slidingSessionTtlSeconds <= 0) {
            throw new IllegalStateException("JWT_SLIDING_SESSION_TTL_SECONDS must be greater than 0");
        }
    }

    /**
     * Tạo JWT token với HS512
     */
    private String generateToken(
            Staff staff,
            String sessionId,
            Instant sessionStartedAt,
            Instant sessionExpiresAt,
            Instant issuedAt) {
        try {
            validateTokenTtlConfig();
            JWSHeader header = new JWSHeader(JWSAlgorithm.HS512);

            // Scope: ROLE_ADMIN hoặc ROLE_USER
            String scope = "ROLE_" + staff.getRole();
            Instant tokenExpiresAt = issuedAt.plus(secondsUntilTokenExpiry(issuedAt, sessionExpiresAt), ChronoUnit.SECONDS);

            JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                    .subject(staff.getEmail())
                    .issuer("attendance-system")
                    .issueTime(Date.from(issuedAt))
                    .expirationTime(Date.from(tokenExpiresAt))
                    .jwtID(UUID.randomUUID().toString())
                    .claim("userId", staff.getId().toString())
                    .claim("staffId", staff.getStaffId())
                    .claim("scope", scope)
                    .claim(SESSION_ID_CLAIM, sessionId)
                    .claim(SESSION_STARTED_AT_CLAIM, sessionStartedAt.getEpochSecond())
                    .claim(SESSION_EXPIRES_AT_CLAIM, sessionExpiresAt.getEpochSecond())
                    .build();

            Payload payload = new Payload(claimsSet.toJSONObject());
            JWSObject jwsObject = new JWSObject(header, payload);
            jwsObject.sign(new MACSigner(signedKey.getBytes()));

            return jwsObject.serialize();

        } catch (JOSEException e) {
            log.error("Failed to generate JWT token: {}", e.getMessage());
            throw new RuntimeException("Failed to generate token");
        }
    }
}
