package com.attendance.core.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncAttendanceRequest {

    @NotBlank(message = "Staff ID is required")
    private String staffId;

    @NotBlank(message = "Attendance type is required")
    @Pattern(regexp = "CHECK_IN|CHECK_OUT", message = "Attendance type must be CHECK_IN or CHECK_OUT")
    private String type;

    @NotNull(message = "Timestamp is required")
    private LocalDateTime timestamp;

    private LocalDate date;

    @NotNull(message = "On-time status is required")
    private Boolean onTime;
}
