package com.attendance.core.controller;

import com.attendance.core.dto.request.SyncAttendanceRequest;
import com.attendance.core.dto.response.ApiResponse;
import com.attendance.core.entity.Attendance;
import com.attendance.core.exception.InternalAttendanceSyncException;
import com.attendance.core.service.AttendanceService;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Date;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/internal/attendance")
@RequiredArgsConstructor
public class InternalAttendanceController {

    private static final String INTERNAL_TOKEN_HEADER = "X-Internal-Token";

    private final AttendanceService attendanceService;

    @Value("${app.internal.jwt.signed-key:}")
    private String internalJwtSignedKey;

    @Value("${app.internal.jwt.issuer:ai-service}")
    private String expectedIssuer;

    @Value("${app.internal.jwt.audience:core-service}")
    private String expectedAudience;

    @Value("${app.internal.jwt.required-scope:attendance:sync}")
    private String requiredScope;

    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<Attendance>> syncAttendance(
            @RequestHeader(value = INTERNAL_TOKEN_HEADER, required = false) String requestToken,
            @Valid @RequestBody SyncAttendanceRequest request) {

        ResponseEntity<ApiResponse<Attendance>> authError = validateInternalRequest(requestToken);
        if (authError != null) {
            return authError;
        }

        try {
            Attendance attendance = attendanceService.syncAttendance(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.<Attendance>builder()
                            .code(201)
                            .message("Attendance synced successfully")
                            .result(attendance)
                            .build());
        } catch (InternalAttendanceSyncException ex) {
            return ResponseEntity.status(ex.getStatus())
                    .body(ApiResponse.error(ex.getStatus().value(), ex.getCode()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteAttendance(
            @RequestHeader(value = INTERNAL_TOKEN_HEADER, required = false) String requestToken,
            @PathVariable UUID id) {

        ResponseEntity<ApiResponse<Void>> authError = validateInternalRequest(requestToken);
        if (authError != null) {
            return authError;
        }

        boolean deleted = attendanceService.deleteAttendance(id);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(404, "Attendance record not found"));
        }

        return ResponseEntity.noContent().build();
    }

    private <T> ResponseEntity<ApiResponse<T>> validateInternalRequest(String requestToken) {
        if (!StringUtils.hasText(internalJwtSignedKey)) {
            log.error("Internal attendance sync JWT signed key is not configured");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ApiResponse.error(503, "Internal attendance sync is not configured"));
        }

        if (!isValidInternalJwt(requestToken)) {
            log.warn("Rejected internal attendance sync request due to invalid internal JWT");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error(401, "Invalid internal JWT"));
        }

        return null;
    }

    private boolean isValidInternalJwt(String requestToken) {
        if (!StringUtils.hasText(requestToken)) {
            return false;
        }

        String token = requestToken.startsWith("Bearer ")
                ? requestToken.substring(7)
                : requestToken;

        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            if (!JWSAlgorithm.HS512.equals(signedJWT.getHeader().getAlgorithm())) {
                return false;
            }

            JWSVerifier verifier = new MACVerifier(internalJwtSignedKey.getBytes());

            if (!signedJWT.verify(verifier)) {
                return false;
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            Date expirationTime = claims.getExpirationTime();
            if (expirationTime == null || expirationTime.before(new Date())) {
                return false;
            }

            if (!expectedIssuer.equals(claims.getIssuer())) {
                return false;
            }

            if (claims.getAudience() == null || !claims.getAudience().contains(expectedAudience)) {
                return false;
            }

            return hasRequiredScope(claims.getClaim("scope"));
        } catch (Exception ex) {
            log.warn("Internal JWT verification failed: {}", ex.getMessage());
            return false;
        }
    }

    private boolean hasRequiredScope(Object scopeClaim) {
        if (scopeClaim == null) {
            return false;
        }

        return Arrays.asList(scopeClaim.toString().split("\\s+")).contains(requiredScope);
    }
}
