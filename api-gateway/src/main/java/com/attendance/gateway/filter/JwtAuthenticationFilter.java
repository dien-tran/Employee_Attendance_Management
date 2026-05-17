package com.attendance.gateway.filter;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Date;
import java.util.List;

@Slf4j
@Component
public class JwtAuthenticationFilter implements GlobalFilter, Ordered {

    // Các path công khai không cần xác thực
    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/introspect",
            "/api/face/checkin/ws"
    );

    @Value("${app.jwt.signed-key}")
    private String signedKey;

    @Value("${app.auth-service.introspect-url}")
    private String introspectUrl;

    private final WebClient webClient;

    public JwtAuthenticationFilter(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getURI().getPath();

        // Bỏ qua các public paths
        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        // Lấy token từ HttpOnly Cookie hoặc Authorization Header
        String token = extractToken(exchange);

        if (token == null) {
            log.warn("No JWT token found for path: {}", path);
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // Bước 1: Local Verification - verify chữ ký HS512 và thời hạn
        JWTClaimsSet claimsSet;
        try {
            claimsSet = verifyTokenLocally(token);
        } catch (Exception e) {
            log.warn("JWT local verification failed: {}", e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // Bước 2: Blacklist Check - gọi Auth Service kiểm tra token đã logout chưa
        String jti = claimsSet.getJWTID();
        final JWTClaimsSet finalClaimsSet = claimsSet;

        return checkBlacklist(token)
                .flatMap(isBlacklisted -> {
                    if (isBlacklisted) {
                        log.warn("Token {} is blacklisted", jti);
                        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                        return exchange.getResponse().setComplete();
                    }

                    // Bóc tách thông tin và gắn vào Header nội bộ
                    String userId = finalClaimsSet.getClaim("userId") != null
                            ? finalClaimsSet.getClaim("userId").toString()
                            : finalClaimsSet.getSubject();
                    String roles = finalClaimsSet.getClaim("scope") != null
                            ? finalClaimsSet.getClaim("scope").toString()
                            : "";
                    String staffId = finalClaimsSet.getClaim("staffId") != null
                            ? finalClaimsSet.getClaim("staffId").toString()
                            : "";

                    ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                            .header("X-User-Id", userId)
                            .header("X-Staff-Id", staffId)
                            .header("X-User-Roles", roles)
                            // Xóa Authorization header để downstream service không thấy JWT
                            .headers(headers -> headers.remove(HttpHeaders.AUTHORIZATION))
                            .build();

                    log.debug("JWT verified. UserId={}, StaffId={}, Roles={}", userId, staffId, roles);
                    return chain.filter(exchange.mutate().request(mutatedRequest).build());
                })
                .onErrorResume(e -> {
                    log.error("Error during blacklist check: {}", e.getMessage());
                    // Nếu Auth Service không phản hồi, vẫn cho qua (fail-open) hoặc chặn (fail-closed)
                    // Theo thiết kế: fail-closed để bảo mật
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                });
    }

    /**
     * Kiểm tra path có phải public không
     */
    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    /**
     * Lấy JWT token từ HttpOnly Cookie hoặc Authorization Header
     */
    private String extractToken(ServerWebExchange exchange) {
        // Ưu tiên lấy từ HttpOnly Cookie
        HttpCookie cookie = exchange.getRequest().getCookies().getFirst("access_token");
        if (cookie != null) {
            return cookie.getValue();
        }

        // Fallback: lấy từ Authorization Header
        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        return null;
    }

    /**
     * Bước 1: Verify chữ ký HS512 và thời hạn token cục bộ (không cần network)
     */
    private JWTClaimsSet verifyTokenLocally(String token) throws Exception {
        SignedJWT signedJWT = SignedJWT.parse(token);
        JWSVerifier verifier = new MACVerifier(signedKey.getBytes());

        if (!signedJWT.verify(verifier)) {
            throw new Exception("Invalid JWT signature");
        }

        JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

        // Kiểm tra thời hạn
        Date expirationTime = claims.getExpirationTime();
        if (expirationTime == null || expirationTime.before(new Date())) {
            throw new Exception("JWT token has expired");
        }

        return claims;
    }

    /**
     * Bước 2: Gọi Auth Service kiểm tra token có trong Blacklist không
     */
    private Mono<Boolean> checkBlacklist(String token) {
        return webClient.post()
                .uri(introspectUrl)
                .bodyValue(new IntrospectRequest(token))
                .retrieve()
                .bodyToMono(IntrospectResponse.class)
                .map(response -> !response.isValid()) // isValid=false nghĩa là đã blacklisted
                .onErrorReturn(false); // Nếu Auth Service lỗi, coi như không blacklisted
    }

    @Override
    public int getOrder() {
        return -1; // Chạy trước tất cả các filter khác
    }

    // Inner record classes cho request/response
    record IntrospectRequest(String token) {}

    /**
     * Wrapper response từ Auth Service:
     * {"code":200,"message":"...","result":{"valid":true,"userId":"...","roles":"..."}}
     */
    record IntrospectResponse(int code, String message, IntrospectResult result) {
        public boolean isValid() {
            return result != null && result.valid();
        }
    }

    record IntrospectResult(boolean valid, String userId, String roles) {}
}
