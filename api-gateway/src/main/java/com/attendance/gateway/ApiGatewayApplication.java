package com.attendance.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class ApiGatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ApiGatewayApplication.class, args);
    }

    @Bean
    public RouteLocator attendanceRoutes(RouteLocatorBuilder builder) {
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
                .build();
    }
}
