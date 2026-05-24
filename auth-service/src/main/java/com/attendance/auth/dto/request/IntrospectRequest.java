package com.attendance.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class IntrospectRequest {

    @NotBlank(message = "Token is required")
    private String token;
}
