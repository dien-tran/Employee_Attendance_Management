package com.attendance.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.http.HttpMethod;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.web.reactive.socket.server.WebSocketService;
import org.springframework.web.reactive.socket.server.support.HandshakeWebSocketService;
import org.springframework.web.reactive.socket.server.upgrade.ReactorNettyRequestUpgradeStrategy;
import reactor.netty.http.server.WebsocketServerSpec;

@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    @Bean
    @Primary
    public WebSocketService largeFrameWebSocketService(
            @Value("${spring.cloud.gateway.httpclient.websocket.max-frame-payload-length:2097152}") int maxFramePayloadLength) {
        return new HandshakeWebSocketService(
                new ReactorNettyRequestUpgradeStrategy(
                        () -> WebsocketServerSpec.builder()
                                .maxFramePayloadLength(maxFramePayloadLength)));
    }

    @Bean
    public RouteLocator attendanceRoutes(
            RouteLocatorBuilder builder,
            @Value("${app.face-service.url}") String faceServiceUrl,
            @Value("${app.chat-service.url}") String chatServiceUrl) {
        return builder.routes()
                .route("auth-service-public", route -> route
                        .path("/api/auth/**")
                        .filters(filters -> filters.stripPrefix(1))
                        .uri("lb://auth-service"))
                .route("auth-service-staff", route -> route
                        .path("/api/staff/**")
                        .uri("lb://auth-service"))
                .route("auth-service-profile", route -> route
                        .path("/api/profile/**")
                        .uri("lb://auth-service"))
                .route("core-service", route -> route
                        .path("/api/core/**")
                        .filters(filters -> filters.stripPrefix(2))
                        .uri("lb://core-service"))
                .route("face-service-health", route -> route
                        .path("/api/face/health")
                        .filters(filters -> filters.setPath("/health"))
                        .uri(faceServiceUrl))
                .route("face-service-api", route -> route
                        .path("/api/face/**")
                        .filters(filters -> filters.rewritePath("/api/face/(?<segment>.*)", "/api/v1/${segment}"))
                        .uri(faceServiceUrl))
                .route("chat-service-health", route -> route
                        .path("/api/chatbot/health")
                        .and()
                        .method(HttpMethod.GET)
                        .filters(filters -> filters.setPath("/health"))
                        .uri(chatServiceUrl))
                .route("chat-service-message", route -> route
                        .path("/api/chatbot/message")
                        .and()
                        .method(HttpMethod.POST)
                        .filters(filters -> filters.setPath("/message"))
                        .uri(chatServiceUrl))
                .build();
    }
}
