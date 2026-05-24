package com.attendance.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class StaffResponse {

    private UUID id;

    private String staffId;

    private String name;

    private String email;

    private String department;

    private String position;

    private LocalDate onboardDate;

    private String status;

    private String phone;

    private String identityCard;

    private String bankAccount;

    private String bankName;

    private LocalDate dob;

    private String role;

    private Boolean hasFace;
}
