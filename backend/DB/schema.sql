CREATE DATABASE IF NOT EXISTS bokyak CHARACTER SET utf8mb4;
USE bokyak;

-- 1. 사용자/보호자
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NULL,
  role ENUM('user', 'guardian') NOT NULL,
  linked_user_id INT NULL,
  push_token VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  email VARCHAR(100) NULL,
  password_hash VARCHAR(255) NULL,
  invite_code VARCHAR(10) NULL,
  UNIQUE KEY email (email),
  UNIQUE KEY invite_code (invite_code),
  FOREIGN KEY (linked_user_id) REFERENCES users(id)
);

-- 2. 복약 시간표 (period: morning / noon / evening)
CREATE TABLE schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  time VARCHAR(5) NOT NULL,
  period VARCHAR(10) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 큐브(통) 7개의 현재 상태
CREATE TABLE cube_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cube_id INT NOT NULL,
  user_id INT NOT NULL,
  target_date DATE NOT NULL,
  status ENUM('inserted', 'removed') DEFAULT 'inserted',
  UNIQUE KEY uq_user_cube (user_id, cube_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. 복약 확인 이력
CREATE TABLE medication_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  cube_id INT NOT NULL,
  target_date DATE NOT NULL,
  period VARCHAR(10) NOT NULL,
  confirmed_at DATETIME NOT NULL,
  method ENUM('sensor', 'manual') NOT NULL,
  KEY cube_id (cube_id)
);

-- 5. 알림 발송 기록 (같은 날·시간대·단계는 한 번만 발송)
CREATE TABLE notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_date DATE NOT NULL,
  period VARCHAR(10) NOT NULL,
  stage INT NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notify (user_id, target_date, period, stage),
  FOREIGN KEY (user_id) REFERENCES users(id)
);