#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/loyalty
URL=http://206.189.153.151:8080

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
sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/' .env

touch database/database.sqlite
php artisan key:generate --force
php artisan migrate --force
php artisan db:seed --force || true
php artisan storage:link || true
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache database
chmod -R ug+rwx storage bootstrap/cache database
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

    location ^~ /api {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
    }

    location ^~ /sanctum {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME /var/www/loyalty/backend/public/index.php;
        fastcgi_param SCRIPT_NAME /index.php;
        fastcgi_param REQUEST_URI $request_uri;
    }

    location ^~ /storage/ {
        alias /var/www/loyalty/backend/storage/app/public/;
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public";
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
