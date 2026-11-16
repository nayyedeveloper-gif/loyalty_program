<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\PointsEngine;
use Illuminate\Console\Command;

class RefreshLoyaltyBalances extends Command
{
    protected $signature = 'loyalty:refresh-balances';

    protected $description = 'Recompute redeemable points, rolling tier points, and tier for all customers';

    public function handle(): int
    {
        $count = 0;
        User::where('role', 'customer')->orderBy('id')->chunkById(100, function ($users) use (&$count) {
            foreach ($users as $user) {
                PointsEngine::refreshUserBalances($user, touchActivity: false);
                $count++;
            }
        });

        $this->info("Refreshed {$count} customers.");

        return self::SUCCESS;
    }
}
