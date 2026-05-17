package com.attendance.core.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "attendances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "staff_id", nullable = false, length = 20)
    private String staffId; // Mapping với bảng staffs (auth_db) - KHÔNG JOIN trực tiếp

    @Column(name = "type", nullable = false, length = 20)
    private String type; // CHECK_IN / CHECK_OUT

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp; // Thời gian chấm công chính xác

    @Column(name = "date", nullable = false)
    private LocalDate date; // Ngày chấm công

    @Column(name = "on_time")
    private Boolean onTime; // Có trễ giờ hay không (TRUE: đúng giờ / FALSE: trễ)
}
