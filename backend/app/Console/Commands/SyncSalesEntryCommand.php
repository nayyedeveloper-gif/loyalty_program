<?php

namespace App\Console\Commands;

use App\Services\SalesEntry\SalesEntrySyncService;
use Illuminate\Console\Command;

class SyncSalesEntryCommand extends Command
{
    protected $signature = 'loyalty:sync-salesentry
        {--fresh : Drop local customer names/purchase history before import}
        {--full : Walk every page (needed to backfill older history)}
        {--all-transactions : Import buybacks as well as sales}
        {--no-points : Store history without awarding loyalty points}
        {--max-pages=0 : Limit pages fetched (0 = all / until known streak)}';

    protected $description = 'Replace local purchase history and customer names from Sales Entry master-setup API';

    public function handle(SalesEntrySyncService $sync): int
    {
        if (! config('salesentry.api_key')) {
            $this->error('Set SALESENTRY_API_KEY in backend/.env first.');

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('Wiping local customers and purchase history…');
            $wiped = $sync->wipeLocalCustomerData();
            $this->line("Removed {$wiped['customers']} customers, {$wiped['purchases']} purchases, {$wiped['ledger']} ledger rows.");
        }

        $this->info('Syncing from Sales Entry…');
        $stats = $sync->sync(
            salesOnly: ! $this->option('all-transactions'),
            awardPoints: ! $this->option('no-points'),
            maxPages: (int) $this->option('max-pages'),
            full: (bool) $this->option('full'),
            onProgress: fn (string $message) => $this->line($message),
        );

        $this->info(sprintf(
            'Done. imported=%d skipped=%d customers_created=%d pages=%d%s',
            $stats['imported'],
            $stats['skipped'],
            $stats['customersCreated'],
            $stats['pages'],
            ! empty($stats['stopped_early']) ? ' (stopped early on known rows)' : '',
        ));

        return self::SUCCESS;
    }
}
