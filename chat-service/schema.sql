-- MySQL schema for HR chatbot
-- Database: RDBMS MySQL

CREATE DATABASE IF NOT EXISTS chatbot_hr
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chatbot_hr;

CREATE TABLE IF NOT EXISTS staffs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(30) NOT NULL COMMENT 'Mã nhân viên do hệ thống tạo',
  full_name VARCHAR(150) NOT NULL COMMENT 'Tên',
  department VARCHAR(100) NOT NULL COMMENT 'Phòng ban',
  position VARCHAR(100) NOT NULL COMMENT 'Vị trí',
  onboard_date DATE NULL COMMENT 'Ngày onboard',
  status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active' COMMENT 'Trạng thái',
  phone VARCHAR(20) NULL COMMENT 'Số điện thoại',
  personal_email VARCHAR(255) NULL COMMENT 'Email cá nhân',
  citizen_id VARCHAR(20) NULL COMMENT 'CCCD',
  bank_account_number VARCHAR(34) NULL COMMENT 'Số tài khoản ngân hàng',
  bank_name VARCHAR(100) NULL COMMENT 'Tên ngân hàng',
  date_of_birth DATE NOT NULL COMMENT 'Ngày sinh',
  password_hash VARCHAR(255) NOT NULL COMMENT 'Password: mặc định theo ngày sinh, lưu dạng hash',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_staffs_employee_code (employee_code),
  UNIQUE KEY uk_staffs_citizen_id (citizen_id),
  UNIQUE KEY uk_staffs_personal_email (personal_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendances (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_id BIGINT UNSIGNED NOT NULL COMMENT 'Mã nhân viên',
  attendance_type ENUM('Checkin', 'Checkout') NOT NULL COMMENT 'Loại chấm công',
  attendance_time DATETIME NOT NULL COMMENT 'Thời gian chấm công',
  attendance_date DATE NOT NULL COMMENT 'Ngày chấm công',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_attendances_staff_id (staff_id),
  KEY idx_attendances_date (attendance_date),
  KEY idx_attendances_staff_date (staff_id, attendance_date),
  CONSTRAINT fk_attendances_staffs
    FOREIGN KEY (staff_id)
    REFERENCES staffs (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
