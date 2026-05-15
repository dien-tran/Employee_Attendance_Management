package com.attendance.auth.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StaffUpdateRequest {
    private String name;
    private String department;
    private String position;
    private String phone;
    private String identityCard;
    private String bankAccount;
    private String bankName;
    private String role;
}