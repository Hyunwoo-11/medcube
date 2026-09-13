CREATE DATABASE IF NOT EXISTS bokyak CHARACTER SET utf8mb4;
USE bokyak;

-- 1. 사용자/보호자
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50),
  role ENUM('user', 'guardian') NOT NULL,
  linked_user_id INT NULL,
  push_token VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (linked_user_id) REFERENCES users(id)
);

-- 2. 복약 시간표
CREATE TABLE schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  time VARCHAR(5) NOT NULL,
  period ENUM('morning', 'evening') NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. 큐브(통) 7개의 현재 상태
CREATE TABLE cube_slots (
  cube_id INT PRIMARY KEY,
  user_id INT NOT NULL,
  target_date DATE NOT NULL,
  status ENUM('inserted', 'removed') DEFAULT 'inserted',
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. 복약 확인 이력
CREATE TABLE medication_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cube_id INT NOT NULL,
  target_date DATE NOT NULL,
  period ENUM('morning', 'evening') NOT NULL,
  confirmed_at DATETIME NOT NULL,
  method ENUM('sensor', 'manual') NOT NULL,
  FOREIGN KEY (cube_id) REFERENCES cube_slots(cube_id)
);

-- 테스트용 샘플 데이터
INSERT INTO users (name, role) VALUES ('테스트 사용자', 'user');
INSERT INTO users (name, role, linked_user_id) VALUES ('테스트 보호자', 'guardian', 1);

INSERT INTO schedules (user_id, time, period) VALUES (1, '08:00', 'morning');
INSERT INTO schedules (user_id, time, period) VALUES (1, '19:00', 'evening');

INSERT INTO cube_slots (cube_id, user_id, target_date) VALUES
  (1, 1, CURDATE()),
  (2, 1, CURDATE() + INTERVAL 1 DAY),
  (3, 1, CURDATE() + INTERVAL 2 DAY),
  (4, 1, CURDATE() + INTERVAL 3 DAY),
  (5, 1, CURDATE() + INTERVAL 4 DAY),
  (6, 1, CURDATE() + INTERVAL 5 DAY),
  (7, 1, CURDATE() + INTERVAL 6 DAY);