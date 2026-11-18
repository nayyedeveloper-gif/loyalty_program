#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/loyalty
URL=http://206.189.153.151:8080

DB_HOST="${LOYALTY_DB_HOST:-127.0.0.1}"
DB_PORT="${LOYALTY_DB_PORT:-3306}"
DB_DATABASE="${LOYALTY_DB_DATABASE:-loyalty}"
DB_USERNAME="${LOYALTY_DB_USERNAME:-loyalty}"
DB_PASSWORD="${LOYALTY_DB_PASSWORD:-loyalty}"

cd "$APP_DIR/backend"
[ -f .env ] || cp .env.example .env

sed -i 's/^APP_ENV=.*/APP_ENV=production/' .env
sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' .env
sed -i "s|^APP_URL=.*|APP_URL=${URL}|" .env
if grep -q '^FRONTEND_URL=' .env; then
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${URL}|" .env
else
  echo "FRONTEND_URL=${URL}" >> .env
fi

sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=mysql/' .env
sed -i "s/^DB_HOST=.*/DB_HOST=${DB_HOST}/" .env
sed -i "s/^DB_PORT=.*/DB_PORT=${DB_PORT}/" .env
sed -i "s/^DB_DATABASE=.*/DB_DATABASE=${DB_DATABASE}/" .env
sed -i "s/^DB_USERNAME=.*/DB_USERNAME=${DB_USERNAME}/" .env
sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=${DB_PASSWORD}/" .env

if command -v mysqladmin >/dev/null 2>&1; then
  mysqladmin ping -h "$DB_HOST" --silent
fi

php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force || true
php artisan storage:link || true
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache
echo "BACKEND_OK"

cd "$APP_DIR/frontend"
npm ci
npm run build
chown -R www-data:www-data dist
echo "FRONTEND_OK"

cat >/etc/nginx/sites-available/loyalty <<'NGINX'
server {
    listen 8080;
    listen [::]:8080;
    server_name 206.189.153.151 loyalty.29jewellery.com;
    client_max_body_size 32M;

    root /var/www/loyalty/frontend/dist;
    index index.html;

    location ^~ /docs {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
    }

    location ^~ /api {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_read_timeout 120s;
    }

    location ^~ /sanctum {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
        fastcgi_read_timeout 120s;
    }

    location ^~ /up {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
        fastcgi_param QUERY_STRING $query_string;
    }

    location ^~ /storage/ {
        alias /var/www/loyalty/backend/storage/app/public/;
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control 'public';
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sfn /etc/nginx/sites-available/loyalty /etc/nginx/sites-enabled/loyalty
nginx -t
systemctl enable --now php8.3-fpm
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 8080/tcp || true
fi

echo "DEPLOY_DONE"
curl -s -o /dev/null -w "HTTP_HOME:%{http_code}\n" http://127.0.0.1:8080/ || true
curl -s -o /dev/null -w "HTTP_API:%{http_code}\n" http://127.0.0.1:8080/api/settings/app || true