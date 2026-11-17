<?php

namespace App\Console\Commands;

use App\Models\BirthdayBonusClaim;
use App\Models\LoyaltySetting;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\PointsEngine;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class GrantBirthdayBonuses extends Command
{
    protected $signature = 'loyalty:birthday-bonuses';

    protected $description = 'Grant once-per-year birthday bonus points to members with a birthday today';

    public function handle(): int
    {
        $today = now();
        $month = (int) $today->month;
        $day = (int) $today->day;
        $year = (int) $today->year;
        $granted = 0;

        User::query()
            ->where('role', 'customer')
            ->whereNotNull('date_of_birth')
            ->whereMonth('date_of_birth', $month)
            ->whereDay('date_of_birth', $day)
            ->orderBy('id')
            ->chunkById(100, function ($users) use ($year, &$granted) {
                foreach ($users as $user) {
                    if (BirthdayBonusClaim::where('user_id', $user->id)->where('year', $year)->exists()) {
                        continue;
                    }

                    $points = $this->bonusForTier((string) ($user->tier ?: 'Care'));
                    if ($points <= 0) {
                        continue;
                    }

                    DB::transaction(function () use ($user, $year, $points, &$granted) {
                        $locked = User::where('id', $user->id)->lockForUpdate()->first();
                        if (! $locked) {
                            return;
                        }
                        if (BirthdayBonusClaim::where('user_id', $locked->id)->where('year', $year)->exists()) {
                            return;
                        }

                        $ledger = PointsEngine::creditBonus($locked, $points, 'birthday', [
                            'year' => $year,
                        ], tierEligible: false);

                        BirthdayBonusClaim::create([
                            'user_id' => $locked->id,
                            'year' => $year,
                            'points' => $points,
                            'ledger_id' => $ledger->id,
                        ]);

                        NotificationService::birthdayBonus($locked->fresh(), $points);
                        $granted++;
                    });
                }
            });

        $this->info("Granted birthday bonuses to {$granted} members.");

        return self::SUCCESS;
    }

    private function bonusForTier(string $tier): int
    {
        $key = 'birthday_bonus_'.strtolower($tier);

        return max(0, LoyaltySetting::getInt($key, match (strtolower($tier)) {
            'vip' => 200,
            'vvip' => 350,
            'cip' => 500,
            default => 100,
        }));
    }
}
