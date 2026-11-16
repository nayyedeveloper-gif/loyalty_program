<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('loyalty:expiry-reminders')->dailyAt('01:00');
Schedule::command('loyalty:birthday-bonuses')->dailyAt('01:15');
Schedule::command('loyalty:expire-inactive')->dailyAt('02:00');
