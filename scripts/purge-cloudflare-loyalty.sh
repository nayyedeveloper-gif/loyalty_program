#!/usr/bin/env bash
# Purge only loyalty.29jewellery.com URLs in Cloudflare — does not purge paukgyi / other hosts.
# Needs a token with Zone → Cache Purge (certbot's dns_cloudflare_api_token is DNS-only).
set -euo pipefail

INI=/root/cloudflare.ini
TOKEN=""
if [[ -f "$INI" ]]; then
  TOKEN=$(grep -E '^(cache_purge_|dns_cloudflare_)api_token' "$INI" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' ' || true)
fi
if [[ -z "$TOKEN" && -f "$INI" ]]; then
  TOKEN=$(grep -o 'dns_cloudflare_api_token = .*' "$INI" | cut -d= -f2- | tr -d ' ')
fi
ZONE=$(curl -sS -H "Authorization: Bearer ${TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones?name=29jewellery.com" \
  | python3 -c "import sys,json; r=json.load(sys.stdin)['result']; print(r[0]['id'] if r else '')")

if [[ -z "$ZONE" ]]; then
  echo "ZONE_NOT_FOUND"
  exit 1
fi

JS=$(grep -o 'index-[^"]*\.js' /var/www/loyalty/frontend/dist/index.html | head -1)
CSS=$(grep -o 'index-[^"]*\.css' /var/www/loyalty/frontend/dist/index.html | head -1)

PAYLOAD=$(python3 <<PY
import json
js, css = """$JS""", """$CSS"""
print(json.dumps({"files": [
  "https://loyalty.29jewellery.com/",
  "https://loyalty.29jewellery.com/index.html",
  "https://loyalty.29jewellery.com/sw.js",
  f"https://loyalty.29jewellery.com/assets/{js}",
  f"https://loyalty.29jewellery.com/assets/{css}",
]}))
PY
)

RESULT=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/purge_cache" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "$PAYLOAD")

if ! echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get('success') else 1)"; then
  echo "CLOUDFLARE_PURGE_FAILED: DNS-only certbot tokens cannot purge cache."
  echo "Add cache_purge_api_token = <token with Cache Purge> to $INI or use Dashboard → Caching → Custom Purge for loyalty URLs only."
  echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"
  exit 1
fi
echo "LOYALTY_CF_PURGE_OK"