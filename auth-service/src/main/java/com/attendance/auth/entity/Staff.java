package com.attendance.auth.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "staffs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Staff {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "staff_id", unique = true, nullable = false, length = 20)
    private String staffId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "department")
    private String department;

    @Column(name = "position")
    private String position;

    @Column(name = "onboard_date")
    private LocalDate onboardDate;

    @Column(name = "status", length = 20)
    private String status; // ACTIVE / INACTIVE

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "email", unique = true, nullable = false)
    private String email;

    @Column(name = "identity_card", length = 20)
    private String identityCard;

    @Column(name = "bank_account", length = 30)
    private String bankAccount;

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "dob")
    private LocalDate dob;

    @Column(name = "password", nullable = false)
    private String password;

    @Column(name = "role", length = 10)
    private String role; // ADMIN / USER
}
