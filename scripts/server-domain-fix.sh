#!/usr/bin/env bash
# Run on the droplet as root after DNS points loyalty.29jewellery.com here.
set -euo pipefail

DOMAIN=https://loyalty.29jewellery.com
ENV=/var/www/loyalty/backend/.env

sed -i "s|^APP_URL=.*|APP_URL=${DOMAIN}|" "$ENV"
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=${DOMAIN}|" "$ENV"
grep -q '^SANCTUM_STATEFUL_DOMAINS=' "$ENV" \
  && sed -i 's/^SANCTUM_STATEFUL_DOMAINS=.*/SANCTUM_STATEFUL_DOMAINS=loyalty.29jewellery.com/' "$ENV" \
  || echo 'SANCTUM_STATEFUL_DOMAINS=loyalty.29jewellery.com' >>"$ENV"

cd /var/www/loyalty/backend
php artisan config:clear
php artisan config:cache
php artisan route:cache

nginx -t && systemctl reload nginx
echo "DOMAIN_ENV_OK"