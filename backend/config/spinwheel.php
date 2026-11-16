<?php

return [
    'guest_link_hours' => (int) env('SPIN_GUEST_LINK_HOURS', 72),
    'guest_reservation_minutes' => (int) env('SPIN_GUEST_RESERVATION_MINUTES', 120),
    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://127.0.0.1:5173'), '/'),
    'default_spin_valid_hours' => (int) env('SPIN_DEFAULT_VALID_HOURS', 168),
    'guest_pool_email' => 'guest-pool@spinwheel.local',
];
