package com.attendance.core.repository;

import com.attendance.core.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {

    List<Attendance> findByStaffIdOrderByTimestampDesc(String staffId);

    List<Attendance> findByStaffIdAndDateOrderByTimestampAsc(String staffId, LocalDate date);

    List<Attendance> findByDateOrderByTimestampAsc(LocalDate date);

    Optional<Attendance> findTopByStaffIdAndTypeAndDateOrderByTimestampDesc(
            String staffId, String type, LocalDate date);

    @Query("SELECT a FROM Attendance a WHERE a.staffId = :staffId AND a.date BETWEEN :startDate AND :endDate ORDER BY a.date ASC, a.timestamp ASC")
    List<Attendance> findByStaffIdAndDateBetween(
            @Param("staffId") String staffId,
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);

    @Query("SELECT a FROM Attendance a WHERE a.date BETWEEN :startDate AND :endDate ORDER BY a.date ASC, a.staffId ASC")
    List<Attendance> findAllByDateBetween(
            @Param("startDate") LocalDate startDate,
            @Param("endDate") LocalDate endDate);
}
