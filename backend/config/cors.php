<?php

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL', 'http://localhost:5173'),
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        // Capacitor Android / iOS WebView origins
        'https://localhost',
        'capacitor://localhost',
        'http://localhost',
        env('MOBILE_ORIGIN'),
    ])),
    'allowed_origins_patterns' => [
        '#^https?://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        '#^https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$#',
        // Public share tunnels (any Wi‑Fi / mobile data)
        '#^https://[a-z0-9-]+\.ngrok(-free)?\.app$#',
        '#^https://[a-z0-9-]+\.ngrok\.io$#',
        '#^https://[a-z0-9-]+\.trycloudflare\.com$#',
    ],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
