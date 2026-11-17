<?php

return [
    'base_url' => rtrim((string) env('SALESENTRY_BASE_URL', 'https://salesentry.29jewellery.com'), '/'),
    'api_key' => (string) env('SALESENTRY_API_KEY', ''),
    'per_page' => (int) env('SALESENTRY_PER_PAGE', 100),
    'timeout' => (int) env('SALESENTRY_TIMEOUT', 60),
    // Path to a CA bundle (e.g. storage/certs/cacert.pem). Empty = PHP default.
    'ca_bundle' => (string) env('SALESENTRY_CA_BUNDLE', ''),
];
