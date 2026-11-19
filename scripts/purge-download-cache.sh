#!/usr/bin/env bash
set -euo pipefail

TOKEN="$(grep -E 'dns_cloudflare_api_token|CLOUDFLARE_API_TOKEN|CF_API_TOKEN' /root/cloudflare.ini | head -1 | cut -d= -f2- | tr -d ' "')"
if [ -z "$TOKEN" ]; then
  echo "No Cloudflare token found"
  exit 1
fi

ZONE_JSON="$(curl -s -X GET 'https://api.cloudflare.com/client/v4/zones?name=29jewellery.com' \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json')"

ZID="$(ZONE_JSON="$ZONE_JSON" python3 - <<'PY'
import json, os
d = json.loads(os.environ["ZONE_JSON"])
print(d["result"][0]["id"] if d.get("success") and d.get("result") else "")
PY
)"

echo "ZID=$ZID"
if [ -z "$ZID" ]; then
  echo "$ZONE_JSON" | head -c 500
  exit 1
fi

RESP="$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZID}/purge_cache" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H 'Content-Type: application/json' \
  --data '{"files":["https://loyalty.29jewellery.com/download/","https://loyalty.29jewellery.com/download","https://loyalty.29jewellery.com/downloads/29-gold-membership.apk"]}')"

echo "$RESP"
