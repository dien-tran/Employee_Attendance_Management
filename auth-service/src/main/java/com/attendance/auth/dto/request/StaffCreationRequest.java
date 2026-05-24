package com.attendance.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffCreationRequest {

    @NotBlank(message = "Name is required")
    private String name;

    @NotBlank(message = "Email is required")
    @Email(message = "Email is invalid")
    private String email;

    @NotNull(message = "Date of birth is required")
    private LocalDate dob;

    private String department;

    private String position;

    private LocalDate onboardDate;

    private String phone;

    private String identityCard;

    private String bankAccount;

    private String bankName;

    /**
     * Quyền của nhân viên: ADMIN hoặc USER.
     * Mặc định là USER nếu không truyền.
     */
    private String role;
}
