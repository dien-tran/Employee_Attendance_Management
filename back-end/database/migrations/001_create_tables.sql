-- ============================================================
-- EAMS Database Migration: 001_create_tables.sql
-- Employee Attendance Management System
-- ============================================================
-- Execution order: departments → users → face_data → devices → attendance_records → attendance_logs → attendance_audit_logs
-- ============================================================

-- Create database if not exists
DROP DATABASE IF EXISTS employee_attendance_db;
CREATE DATABASE employee_attendance_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE employee_attendance_db;

-- ============================================================
-- 1. departments (Phòng ban)
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. users (Người dùng / Nhân viên)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(50) NOT NULL DEFAULT 'USER',

    department_id INT,
    position VARCHAR(150),
    avatar_url VARCHAR(500),

    status VARCHAR(50) DEFAULT 'offline',

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL,
        
    INDEX idx_user_department (department_id),
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. face_data (Dữ liệu khuôn mặt)
-- ============================================================
CREATE TABLE IF NOT EXISTS face_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,

    image_path VARCHAR(500),
    embedding_ref TEXT,

    registered_at TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. devices (Thiết bị)
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. attendance_records (Bản ghi chấm công theo ngày)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,

    work_date DATE NOT NULL,

    check_in DATETIME,
    check_out DATETIME,

    status VARCHAR(50) NOT NULL,

    confidence FLOAT,
    method VARCHAR(50) DEFAULT 'face_scan',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    UNIQUE KEY unique_user_date (user_id, work_date),
    INDEX idx_attendance_date (work_date),
    INDEX idx_attendance_user (user_id),
    INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. attendance_logs (Raw Events — Sự kiện chấm công thô)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    type VARCHAR(20) NOT NULL, -- check_in / check_out

    recorded_at DATETIME NOT NULL,

    confidence FLOAT,
    method VARCHAR(50),

    device_id INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
        
    FOREIGN KEY (device_id)
        REFERENCES devices(id)
        ON DELETE SET NULL,

    INDEX idx_logs_user (user_id),
    INDEX idx_logs_time (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. attendance_audit_logs (Nhật ký thay đổi chấm công)
-- ============================================================
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,

    attendance_id INT NOT NULL,
    changed_by INT NULL,

    old_check_in DATETIME,
    new_check_in DATETIME,

    old_check_out DATETIME,
    new_check_out DATETIME,

    old_status VARCHAR(50),
    new_status VARCHAR(50),

    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (attendance_id)
        REFERENCES attendance_records(id)
        ON DELETE CASCADE,

    FOREIGN KEY (changed_by)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
