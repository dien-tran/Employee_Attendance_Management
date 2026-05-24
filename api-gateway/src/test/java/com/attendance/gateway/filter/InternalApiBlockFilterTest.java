package com.attendance.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;

class InternalApiBlockFilterTest {

    private final InternalApiBlockFilter filter = new InternalApiBlockFilter();

    @Test
    void blocksInternalApiPrefixBeforeRouting() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.post("/api/internal/attendance/sync").build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(chainInvoked).isFalse();
    }

    @Test
    void blocksExactInternalApiPath() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/internal").build()
        );

        filter.filter(exchange, currentExchange -> Mono.empty()).block();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void allowsNonInternalApiPaths() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/internalized/status").build()
        );
        AtomicBoolean chainInvoked = new AtomicBoolean(false);

        filter.filter(exchange, currentExchange -> {
            chainInvoked.set(true);
            return Mono.empty();
        }).block();

        assertThat(exchange.getResponse().getStatusCode()).isNull();
        assertThat(chainInvoked).isTrue();
    }
}
