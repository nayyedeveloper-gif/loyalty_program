<?php

namespace App\Console\Commands;

use App\Services\PointsEngine;
use Illuminate\Console\Command;

class ExpireInactivePoints extends Command
{
    protected $signature = 'loyalty:expire-inactive';

    protected $description = 'Expire redeemable points for members inactive for the configured inactivity window';

    public function handle(): int
    {
        $count = PointsEngine::expireInactiveWallets();
        $this->info("Expired wallets for {$count} members.");

        return self::SUCCESS;
    }
}
