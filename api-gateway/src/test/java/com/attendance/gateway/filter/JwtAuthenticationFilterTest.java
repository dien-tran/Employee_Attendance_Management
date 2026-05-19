package com.attendance.gateway.filter;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

class JwtAuthenticationFilterTest {

    private static final String SIGNED_KEY = "test-only-signing-key-with-at-least-sixty-four-bytes-for-hs512-tests";

    @Test
    void allowsPublicFaceCheckinWebSocketWithoutToken() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(WebClient.builder());
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/face/checkin/ws").build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(chainInvoked).isTrue();
    }

    @Test
    void allowsPublicChatbotHealthWithoutToken() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(WebClient.builder());
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/chatbot/health").build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(chainInvoked).isTrue();
    }

    @Test
    void blocksProtectedChatbotMessageWithoutToken() {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(WebClient.builder());
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.post("/api/chatbot/message").build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(chainInvoked).isFalse();
    }

    @Test
    void forwardsProtectedChatbotMessageWithInternalHeadersWhenTokenValid() throws Exception {
        String token = signedUserToken();
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
                WebClient.builder().exchangeFunction(request -> Mono.just(
                        ClientResponse.create(HttpStatus.OK)
                                .header(HttpHeaders.CONTENT_TYPE, APPLICATION_JSON_VALUE)
                                .body("""
                                        {"code":200,"message":"Success","result":{"valid":true,"userId":"user-1","roles":"ROLE_USER"}}
                                        """)
                                .build()
                ))
        );
        ReflectionTestUtils.setField(filter, "signedKey", SIGNED_KEY);
        ReflectionTestUtils.setField(filter, "introspectUrl", "http://auth-service/auth/introspect");
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.post("/api/chatbot/message")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);
        AtomicBoolean internalHeadersInjected = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            String staffId = currentExchange.getRequest().getHeaders().getFirst("X-Staff-Id");
            String roles = currentExchange.getRequest().getHeaders().getFirst("X-User-Roles");
            String authHeader = currentExchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
            internalHeadersInjected.set("NV999999".equals(staffId)
                    && "ROLE_USER".equals(roles)
                    && authHeader == null);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(chainInvoked).isTrue();
        assertThat(internalHeadersInjected).isTrue();
    }

    @Test
    void blocksRequestWhenIntrospectMarksTokenAsBlacklisted() throws Exception {
        String token = signedUserToken();
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(
                WebClient.builder().exchangeFunction(request -> Mono.just(
                        ClientResponse.create(HttpStatus.OK)
                                .header(HttpHeaders.CONTENT_TYPE, APPLICATION_JSON_VALUE)
                                .body("""
                                        {"code":200,"message":"Success","result":{"valid":false,"userId":"user-1","roles":"ROLE_USER"}}
                                        """)
                                .build()
                ))
        );
        ReflectionTestUtils.setField(filter, "signedKey", SIGNED_KEY);
        ReflectionTestUtils.setField(filter, "introspectUrl", "http://auth-service/auth/introspect");

        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/staff")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(chainInvoked).isFalse();
    }

    private String signedUserToken() throws Exception {
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject("blacklisted.user@company.test")
                .issuer("attendance-system")
                .issueTime(new Date())
                .expirationTime(Date.from(Instant.now().plus(1, ChronoUnit.HOURS)))
                .jwtID(UUID.randomUUID().toString())
                .claim("userId", UUID.randomUUID().toString())
                .claim("staffId", "NV999999")
                .claim("scope", "ROLE_USER")
                .build();

        JWSObject jwsObject = new JWSObject(new JWSHeader(JWSAlgorithm.HS512), new Payload(claimsSet.toJSONObject()));
        jwsObject.sign(new MACSigner(SIGNED_KEY.getBytes()));
        return jwsObject.serialize();
    }
}
