#!/usr/bin/env bash
set -euo pipefail

mysql -uroot <<'SQL'
CREATE DATABASE IF NOT EXISTS loyalty CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'loyalty'@'localhost' IDENTIFIED BY 'loyalty';
GRANT ALL PRIVILEGES ON loyalty.* TO 'loyalty'@'localhost';
FLUSH PRIVILEGES;
SQL

mysql -uroot -e "DROP DATABASE IF EXISTS loyalty; CREATE DATABASE loyalty CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -uroot loyalty < /tmp/loyalty_local.sql

mysql -uroot loyalty -e "SELECT COUNT(*) AS users FROM users; SELECT COUNT(*) AS purchases FROM purchases;"
echo "MYSQL_IMPORT_OK"