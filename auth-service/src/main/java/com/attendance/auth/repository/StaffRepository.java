package com.attendance.auth.repository;

import com.attendance.auth.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface StaffRepository extends JpaRepository<Staff, UUID> {

    Optional<Staff> findByEmail(String email);

    Optional<Staff> findByStaffId(String staffId);

    boolean existsByEmail(String email);

    boolean existsByStaffId(String staffId);
}
