<?php

namespace App\Console\Commands;

use App\Models\AppNotification;
use App\Models\LoyaltySetting;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

class SendExpiryReminders extends Command
{
    protected $signature = 'loyalty:expiry-reminders';

    protected $description = 'Notify members whose wallets will expire soon due to inactivity (30 and 7 days)';

    public function handle(): int
    {
        $inactivityDays = max(1, LoyaltySetting::getInt('inactivity_days', 365));
        $sent = 0;

        foreach ([30, 7] as $daysLeft) {
            if ($daysLeft >= $inactivityDays) {
                continue;
            }

            // last_activity_at around (now - inactivityDays + daysLeft)
            $target = now()->subDays($inactivityDays - $daysLeft)->startOfDay();
            $windowStart = $target->copy();
            $windowEnd = $target->copy()->endOfDay();
            $type = $daysLeft <= 7 ? 'expiry_reminder_7' : 'expiry_reminder_30';

            User::query()
                ->where('role', 'customer')
                ->where('redeemable_points', '>', 0)
                ->whereNotNull('last_activity_at')
                ->whereBetween('last_activity_at', [$windowStart, $windowEnd])
                ->orderBy('id')
                ->chunkById(100, function ($users) use ($daysLeft, $type, &$sent) {
                    foreach ($users as $user) {
                        $already = AppNotification::query()
                            ->where('user_id', $user->id)
                            ->where('type', $type)
                            ->where('created_at', '>=', $user->last_activity_at)
                            ->exists();

                        if ($already) {
                            continue;
                        }

                        NotificationService::expiryReminder(
                            $user,
                            $daysLeft,
                            (int) $user->redeemable_points,
                        );
                        $sent++;
                    }
                });
        }

        $this->info("Sent {$sent} expiry reminders.");

        return self::SUCCESS;
    }
}
