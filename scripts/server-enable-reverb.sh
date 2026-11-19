#!/usr/bin/env bash
# Loyalty app only — writes /var/www/loyalty/backend/.env Reverb vars + supervisor unit.
set -euo pipefail

APP_DIR=/var/www/loyalty
ENV="$APP_DIR/backend/.env"
UNIT=/etc/supervisor/conf.d/loyalty-reverb.conf

if ! grep -q '^REVERB_APP_ID=' "$ENV" || grep -q '^REVERB_APP_ID=$' "$ENV"; then
  ID="$(openssl rand -hex 8)"
  KEY="$(openssl rand -hex 16)"
  SECRET="$(openssl rand -hex 32)"
  for line in \
    "REVERB_APP_ID=$ID" \
    "REVERB_APP_KEY=$KEY" \
    "REVERB_APP_SECRET=$SECRET" \
    "REVERB_HOST=loyalty.29jewellery.com" \
    "REVERB_PORT=443" \
    "REVERB_SCHEME=https" \
    "REVERB_SERVER_HOST=127.0.0.1" \
    "REVERB_SERVER_PORT=8090"; do
    KEYNAME="${line%%=*}"
    if grep -q "^${KEYNAME}=" "$ENV"; then
      sed -i "s|^${KEYNAME}=.*|${line}|" "$ENV"
    else
      echo "$line" >>"$ENV"
    fi
  done
fi

grep -q '^BROADCAST_CONNECTION=' "$ENV" \
  && sed -i 's/^BROADCAST_CONNECTION=.*/BROADCAST_CONNECTION=reverb/' "$ENV" \
  || echo 'BROADCAST_CONNECTION=reverb' >>"$ENV"

cat >"$UNIT" <<EOF
[program:loyalty-reverb]
process_name=%(program_name)s
command=php $APP_DIR/backend/artisan reverb:start --host=127.0.0.1 --port=8090
directory=$APP_DIR/backend
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=$APP_DIR/backend/storage/logs/reverb.log
stopwaitsecs=10
EOF

cd "$APP_DIR/backend"
php artisan config:cache

if command -v supervisorctl >/dev/null 2>&1; then
  supervisorctl reread
  supervisorctl update
  supervisorctl restart loyalty-reverb || supervisorctl start loyalty-reverb
else
  apt-get install -y -qq supervisor
  systemctl enable --now supervisor
  supervisorctl reread
  supervisorctl update
  supervisorctl start loyalty-reverb
fi

echo "REVERB_APP_KEY=$(grep '^REVERB_APP_KEY=' "$ENV" | cut -d= -f2-)"
echo "LOYALTY_REVERB_OK"