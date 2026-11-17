# Expose the local Vite app (port 5173) on a public HTTPS URL.
# Phones on any Wi‑Fi or mobile data can open it while this PC + servers stay running.
# Vite already proxies /api and /storage to Laravel :8000.
#
# Prefers Cloudflare Quick Tunnel (no account). Falls back to ngrok if installed.

$ErrorActionPreference = 'Stop'

function Test-PortOpen([int]$Port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    $ok = $async.AsyncWaitHandle.WaitOne(800)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($async)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-PortOpen 5173)) {
  Write-Host 'Vite is not running on :5173. Start it first: cd frontend && npm run dev' -ForegroundColor Yellow
  exit 1
}

if (-not (Test-PortOpen 8000)) {
  Write-Host 'Laravel is not running on :8000. Start it first: cd backend && php artisan serve --host=0.0.0.0 --port=8000' -ForegroundColor Yellow
  exit 1
}

$cloudflaredCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
$cloudflaredPath = if ($cloudflaredCmd) {
  $cloudflaredCmd.Source
} elseif (Test-Path 'C:\Program Files (x86)\cloudflared\cloudflared.exe') {
  'C:\Program Files (x86)\cloudflared\cloudflared.exe'
} elseif (Test-Path 'C:\Program Files\cloudflared\cloudflared.exe') {
  'C:\Program Files\cloudflared\cloudflared.exe'
} else {
  $null
}
$ngrok = Get-Command ngrok -ErrorAction SilentlyContinue

Write-Host 'Starting public HTTPS tunnel to http://127.0.0.1:5173 ...' -ForegroundColor Cyan
Write-Host 'Leave this window open. Use the printed https:// URL on any Wi‑Fi or mobile data.' -ForegroundColor Cyan
Write-Host 'Your PC must stay awake with Vite + Laravel running.' -ForegroundColor DarkGray
Write-Host ''

if ($cloudflaredPath) {
  # http2 is more stable than QUIC on some Myanmar ISPs / Wi‑Fi (avoids 502 flaps).
  & $cloudflaredPath tunnel --protocol http2 --url http://127.0.0.1:5173
  exit $LASTEXITCODE
}

if ($ngrok) {
  Write-Host 'cloudflared not found; using ngrok fallback.' -ForegroundColor DarkYellow
  & ngrok http 5173 --log=stdout
  exit $LASTEXITCODE
}

Write-Host 'No tunnel tool found. Install cloudflared: winget install Cloudflare.cloudflared' -ForegroundColor Yellow
exit 1
