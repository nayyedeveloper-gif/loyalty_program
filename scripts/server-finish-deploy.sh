#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/var/www/loyalty
URL=http://206.189.153.151:8080

cd "$APP_DIR"
git fetch origin
git checkout feature/spinwheel
git pull --ff-only origin feature/spinwheel

cd "$APP_DIR/backend"
composer install --no-dev --optimize-autoloader --no-interaction

# MySQL (keep existing APP_KEY and integration secrets)
sed -i 's/^APP_ENV=.*/APP_ENV=production/' .env
sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' .env
sed -i "s|^APP_URL=.*|APP_URL=${URL}|" .env
if grep -q '^FRONTEND_URL=' .env; then
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${URL}|" .env
else
  echo "FRONTEND_URL=${URL}" >> .env
fi
sed -i 's/^DB_CONNECTION=.*/DB_CONNECTION=mysql/' .env
grep -q '^DB_HOST=' .env || {
  echo 'DB_HOST=127.0.0.1' >> .env
  echo 'DB_PORT=3306' >> .env
  echo 'DB_DATABASE=loyalty' >> .env
  echo 'DB_USERNAME=loyalty' >> .env
  echo 'DB_PASSWORD=loyalty' >> .env
}
sed -i 's/^DB_HOST=.*/DB_HOST=127.0.0.1/' .env
sed -i 's/^DB_PORT=.*/DB_PORT=3306/' .env
sed -i 's/^DB_DATABASE=.*/DB_DATABASE=loyalty/' .env
sed -i 's/^DB_USERNAME=.*/DB_USERNAME=loyalty/' .env
sed -i 's/^DB_PASSWORD=.*/DB_PASSWORD=loyalty/' .env

php artisan migrate --force
php artisan storage:link 2>/dev/null || true
php artisan config:cache
php artisan route:cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwx storage bootstrap/cache

cd "$APP_DIR/frontend"
npm ci
npm run build
chown -R www-data:www-data dist

systemctl reload php8.3-fpm || systemctl reload php8.2-fpm || true
systemctl reload nginx

curl -s -o /dev/null -w "HTTP_HOME:%{http_code}\n" http://127.0.0.1:8080/ || true
curl -s -o /dev/null -w "HTTP_API:%{http_code}\n" http://127.0.0.1:8080/api/settings/app || true
echo "DEPLOY_FINISH_OK"