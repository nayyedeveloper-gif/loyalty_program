-- Run as MySQL root on the app server (adjust passwords for production).
CREATE DATABASE IF NOT EXISTS loyalty
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'loyalty'@'localhost' IDENTIFIED BY 'loyalty';
GRANT ALL PRIVILEGES ON loyalty.* TO 'loyalty'@'localhost';

CREATE USER IF NOT EXISTS 'loyalty'@'127.0.0.1' IDENTIFIED BY 'loyalty';
GRANT ALL PRIVILEGES ON loyalty.* TO 'loyalty'@'127.0.0.1';

FLUSH PRIVILEGES;