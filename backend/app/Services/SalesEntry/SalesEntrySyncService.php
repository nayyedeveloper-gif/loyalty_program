<?php

namespace App\Services\SalesEntry;

use App\Models\AppNotification;
use App\Models\BirthdayBonusClaim;
use App\Models\FeedbackMessage;
use App\Models\FeedbackReply;
use App\Models\PointLedger;
use App\Models\Purchase;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Models\UserMissionProgress;
use App\Services\PointsEngine;
use App\Services\TierService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SalesEntrySyncService
{
    /** @var array<int, true> */
    private array $knownExternalIds = [];

    /** @var array<string, array{id:int,phone:?string,nrc:?string,name:string}> */
    private array $customersByPhone = [];

    /** @var array<string, array{id:int,phone:?string,nrc:?string,name:string}> */
    private array $customersByNrc = [];

    /** @var array<int, true> */
    private array $customerIds = [];

    private int $nextCustomerSeq = 1;

    private string $importPasswordHash = '';

    /** @var list<array<string, mixed>> */
    private array $pendingUsers = [];

    /** @var list<array<string, mixed>> */
    private array $pendingPurchases = [];

    /** @var list<array<string, mixed>> */
    private array $pendingLedger = [];

    /** @var array<int, int> user_id => spend delta */
    private array $spendDelta = [];

    /** @var array<int, string> user_id => last activity iso */
    private array $activityAt = [];

    private int $flushSize = 250;

    public function __construct(private readonly SalesEntryClient $client) {}

    /**
     * Remove seeded/local customer purchase history so Sales Entry becomes the source of truth.
     */
    public function wipeLocalCustomerData(): array
    {
        $customerIds = User::query()->where('role', 'customer')->pluck('id');

        $stats = [
            'customers' => $customerIds->count(),
            'purchases' => 0,
            'ledger' => 0,
        ];

        DB::transaction(function () use ($customerIds, &$stats) {
            if ($customerIds->isEmpty()) {
                return;
            }

            $ids = $customerIds->all();
            $stats['purchases'] = Purchase::query()->whereIn('user_id', $ids)->count();
            $stats['ledger'] = PointLedger::query()->whereIn('user_id', $ids)->count();

            PointLedger::query()->whereIn('user_id', $ids)->delete();
            Purchase::query()->whereIn('user_id', $ids)->delete();
            RewardRedemption::query()->whereIn('user_id', $ids)->delete();
            BirthdayBonusClaim::query()->whereIn('user_id', $ids)->delete();
            AppNotification::query()->whereIn('user_id', $ids)->delete();

            if (Schema::hasTable('user_mission_progress')) {
                UserMissionProgress::query()->whereIn('user_id', $ids)->delete();
            }

            if (Schema::hasTable('feedback_messages')) {
                $feedbackIds = FeedbackMessage::query()->whereIn('user_id', $ids)->pluck('id');
                if ($feedbackIds->isNotEmpty() && Schema::hasTable('feedback_replies')) {
                    FeedbackReply::query()->whereIn('feedback_message_id', $feedbackIds)->delete();
                }
                FeedbackMessage::query()->whereIn('user_id', $ids)->delete();
            }

            User::query()->whereIn('id', $ids)->delete();
        });

        return $stats;
    }

    /**
     * @param  callable(string $message): void|null  $onProgress
     */
    public function sync(
        bool $salesOnly = true,
        bool $awardPoints = true,
        int $maxPages = 0,
        bool $full = false,
        ?callable $onProgress = null,
    ): array {
        $this->prepareSqliteFastPath();
        $this->bootCaches();

        $page = 1;
        $imported = 0;
        $skipped = 0;
        $customersCreated = 0;
        $consecutiveKnown = 0;
        // Sales Entry caps page size at 200; always use the max for backfills.
        $perPage = 200;

        do {
            $payload = $this->client->fetchMasterSetup($page, $perPage);
            $rows = $payload['data'] ?? [];
            $pagination = $payload['pagination'] ?? [];
            $lastPage = (int) ($pagination['last_page'] ?? $page);
            $total = (int) ($pagination['total'] ?? 0);

            if ($onProgress) {
                $onProgress(sprintf(
                    'Page %d/%d (%d rows) · imported=%d customers=%d',
                    $page,
                    $lastPage,
                    count($rows),
                    $imported,
                    count($this->customerIds),
                ));
            }

            if (! count($rows)) {
                break;
            }

            foreach ($rows as $row) {
                if (! is_array($row)) {
                    continue;
                }

                $side = $this->transactionSide($row);
                if ($salesOnly && $side !== 'sale') {
                    $skipped++;
                    continue;
                }

                $externalId = (int) ($row['id'] ?? 0);
                if ($externalId <= 0) {
                    $skipped++;
                    continue;
                }

                if (isset($this->knownExternalIds[$externalId])) {
                    $skipped++;
                    $consecutiveKnown++;
                    if (! $full && $maxPages === 0 && $consecutiveKnown >= 80) {
                        $this->flush(awardPoints: $awardPoints);
                        $this->finalizeSpendAndTiers($awardPoints);

                        return compact('imported', 'skipped', 'customersCreated') + [
                            'pages' => $page,
                            'stopped_early' => true,
                            'total_remote' => $total,
                        ];
                    }
                    continue;
                }

                $consecutiveKnown = 0;
                $amount = $this->moneyToInt($row['total_combined_value'] ?? $row['total_product_value'] ?? $row['product_value'] ?? 0);
                if ($amount <= 0) {
                    $skipped++;
                    continue;
                }

                [$customerId, $created] = $this->resolveCustomerId($row);
                if ($created) {
                    $customersCreated++;
                }

                $productType = $this->mapProductCategory((string) ($row['product_category'] ?? ''));
                $productName = trim((string) ($row['product_type'] ?? '')) ?: (string) ($row['product_code'] ?? 'Item');
                $soldAt = $this->parseDateTime($row['created_at'] ?? null)
                    ?: $this->parseDateTime($row['date'] ?? null)
                    ?: now();
                $soldAtStr = $soldAt->format('Y-m-d H:i:s');

                $points = 0;
                $snapshot = [
                    'base_points' => 0,
                    'tier_multiplier' => 1.0,
                    'promo_multiplier' => 1.0,
                    'points_earned' => 0,
                    'tier_at_purchase' => 'Care',
                    'payable' => $amount,
                    'source' => 'salesentry',
                    'external_id' => $externalId,
                ];

                if ($awardPoints && $side === 'sale') {
                    // Base earn only during bulk sync (promos applied later via refresh if needed).
                    $base = PointsEngine::basePointsFromAmount($amount);
                    $points = $base;
                    $snapshot['base_points'] = $base;
                    $snapshot['points_earned'] = $base;
                }

                $this->pendingPurchases[] = [
                    'external_id' => $externalId,
                    'user_id' => $customerId,
                    'product_name' => Str::limit($productName, 180, ''),
                    'product_code' => Str::limit((string) ($row['product_code'] ?? 'N/A'), 80, ''),
                    'voucher_number' => $row['voucher_number'] ?? null,
                    'branch_name' => $row['branch_name'] ?? $row['shop_branch_number'] ?? null,
                    'branch_id' => isset($row['branch_id']) ? (int) $row['branch_id'] : null,
                    'transaction_side' => $side,
                    'product_type' => $productType,
                    'amount' => $amount,
                    'discount_percent' => 0,
                    'net_amount' => $amount,
                    'points_earned' => $side === 'sale' ? $points : 0,
                    'points_redeemed' => 0,
                    'amount_offset_mmk' => 0,
                    'earn_snapshot' => json_encode($snapshot),
                    'payment_method' => $this->mapPaymentMethod($row),
                    'sold_at' => $soldAtStr,
                    'status' => 'recorded',
                    'created_at' => $soldAtStr,
                    'updated_at' => $soldAtStr,
                ];

                $this->knownExternalIds[$externalId] = true;

                if ($side === 'sale') {
                    $this->spendDelta[$customerId] = ($this->spendDelta[$customerId] ?? 0) + $amount;
                    $this->activityAt[$customerId] = $soldAtStr;

                    if ($awardPoints && $points > 0) {
                        $this->pendingLedger[] = [
                            'user_id' => $customerId,
                            'type' => 'earn',
                            'source' => 'purchase',
                            'points' => $points,
                            'tier_eligible' => 1,
                            'purchase_external_id' => $externalId,
                            'meta' => json_encode([
                                'base_points' => $points,
                                'payable' => $amount,
                                'source' => 'salesentry',
                            ]),
                            'created_at' => $soldAtStr,
                            'updated_at' => $soldAtStr,
                        ];
                    }
                }

                $imported++;

                if (count($this->pendingPurchases) >= $this->flushSize) {
                    $this->flush(awardPoints: $awardPoints);
                }
            }

            $page++;
            if ($maxPages > 0 && $page > $maxPages) {
                break;
            }
        } while ($page <= $lastPage);

        $this->flush(awardPoints: $awardPoints);
        $this->finalizeSpendAndTiers($awardPoints);

        if ($onProgress) {
            $onProgress(sprintf(
                'Finished. local_customers=%d local_purchases=%d',
                User::query()->where('role', 'customer')->count(),
                Purchase::query()->count(),
            ));
        }

        return compact('imported', 'skipped', 'customersCreated') + [
            'pages' => $page - 1,
            'stopped_early' => false,
            'total_remote' => $total ?? 0,
        ];
    }

    private function prepareSqliteFastPath(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        try {
            DB::statement('PRAGMA synchronous = OFF');
            DB::statement('PRAGMA temp_store = MEMORY');
            DB::statement('PRAGMA cache_size = -200000');
            DB::statement('PRAGMA mmap_size = 268435456');
        } catch (\Throwable) {
            // Best-effort speedups only.
        }
    }

    private function bootCaches(): void
    {
        $this->knownExternalIds = [];
        foreach (DB::table('purchases')->whereNotNull('external_id')->pluck('external_id') as $id) {
            $this->knownExternalIds[(int) $id] = true;
        }

        $this->customersByPhone = [];
        $this->customersByNrc = [];
        $this->customerIds = [];

        $rows = DB::table('users')
            ->where('role', 'customer')
            ->get(['id', 'phone', 'nrc_number', 'name']);

        foreach ($rows as $row) {
            $entry = [
                'id' => (int) $row->id,
                'phone' => $row->phone,
                'nrc' => $row->nrc_number,
                'name' => (string) $row->name,
            ];
            $this->customerIds[$entry['id']] = true;
            if ($entry['phone']) {
                $this->customersByPhone[(string) $entry['phone']] = $entry;
            }
            if ($entry['nrc']) {
                $this->customersByNrc[(string) $entry['nrc']] = $entry;
            }
        }

        $latest = DB::table('users')
            ->where('role', 'customer')
            ->whereNotNull('customer_code')
            ->where('customer_code', 'like', 'C%')
            ->orderByDesc('id')
            ->value('customer_code');

        $this->nextCustomerSeq = 1;
        if (is_string($latest) && preg_match('/^C(\d+)$/', $latest, $matches)) {
            $this->nextCustomerSeq = ((int) $matches[1]) + 1;
        }

        // One cheap bcrypt for all imported placeholders (members reset/sign in via OTP later).
        $this->importPasswordHash = password_hash('SalesEntryImportPlaceholder', PASSWORD_BCRYPT, ['cost' => 4]);
    }

    /**
     * @return array{0:int,1:bool} [customerId, created]
     */
    private function resolveCustomerId(array $row): array
    {
        $name = trim((string) ($row['customer_name'] ?? '')) ?: 'Sales Entry Customer';
        $phone = $this->normalizePhone((string) ($row['phone_number'] ?? ''));
        $nrc = trim((string) ($row['nrc_number'] ?? '')) ?: null;
        $address = trim((string) ($row['address'] ?? '')) ?: null;

        if ($phone !== '' && isset($this->customersByPhone[$phone])) {
            return [$this->customersByPhone[$phone]['id'], false];
        }
        if ($nrc && isset($this->customersByNrc[$nrc])) {
            return [$this->customersByNrc[$nrc]['id'], false];
        }

        $emailSeed = $phone !== '' ? $phone : ($nrc ?: Str::lower(Str::slug($name)).'-'.($row['id'] ?? Str::random(6)));
        $email = 'se_'.substr(hash('sha256', $emailSeed), 0, 20).'@salesentry.local';
        while (DB::table('users')->where('email', $email)->exists() || $this->pendingHasEmail($email)) {
            $email = 'se_'.Str::lower(Str::random(20)).'@salesentry.local';
        }

        $uniquePhone = $phone !== '' ? $phone : ('09'.substr(preg_replace('/\D/', '', hash('sha256', $emailSeed)) ?: '0', 0, 9));
        while (
            isset($this->customersByPhone[$uniquePhone])
            || DB::table('users')->where('phone', $uniquePhone)->exists()
            || $this->pendingHasPhone($uniquePhone)
        ) {
            $uniquePhone = '09'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        }

        $code = 'C'.str_pad((string) $this->nextCustomerSeq, 6, '0', STR_PAD_LEFT);
        $this->nextCustomerSeq++;
        $referral = 'R'.strtoupper(substr(md5($email.$code.uniqid('', true)), 0, 8));
        $now = now()->format('Y-m-d H:i:s');

        // Temporary negative ids until flush assigns real ids.
        $tempId = -1 * (count($this->pendingUsers) + 1);

        $this->pendingUsers[] = [
            '_temp_id' => $tempId,
            'customer_code' => $code,
            'referral_code' => $referral,
            'name' => Str::limit($name, 120, ''),
            'email' => $email,
            'phone' => $uniquePhone,
            'nrc_number' => $nrc,
            'address' => $address ? Str::limit($address, 255, '') : null,
            'role' => 'customer',
            'source' => 'salesentry',
            'tier' => 'Care',
            'password' => $this->importPasswordHash,
            'total_spent' => 0,
            'points' => 0,
            'redeemable_points' => 0,
            'tier_points_365d' => 0,
            'login_streak' => 0,
            'last_activity_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $entry = [
            'id' => $tempId,
            'phone' => $uniquePhone,
            'nrc' => $nrc,
            'name' => $name,
        ];
        $this->customersByPhone[$uniquePhone] = $entry;
        if ($nrc) {
            $this->customersByNrc[$nrc] = $entry;
        }

        return [$tempId, true];
    }

    private function pendingHasEmail(string $email): bool
    {
        foreach ($this->pendingUsers as $user) {
            if (($user['email'] ?? null) === $email) {
                return true;
            }
        }

        return false;
    }

    private function pendingHasPhone(string $phone): bool
    {
        foreach ($this->pendingUsers as $user) {
            if (($user['phone'] ?? null) === $phone) {
                return true;
            }
        }

        return false;
    }

    private function flush(bool $awardPoints): void
    {
        if ($this->pendingUsers === [] && $this->pendingPurchases === []) {
            return;
        }

        DB::transaction(function () use ($awardPoints) {
            $tempToReal = [];

            if ($this->pendingUsers !== []) {
                foreach (array_chunk($this->pendingUsers, 200) as $chunk) {
                    $insertRows = [];
                    foreach ($chunk as $user) {
                        $tempId = $user['_temp_id'];
                        unset($user['_temp_id']);
                        $insertRows[] = $user;
                    }
                    DB::table('users')->insert($insertRows);

                    // Map temp ids via email (unique).
                    $emails = array_column($insertRows, 'email');
                    $created = DB::table('users')->whereIn('email', $emails)->get(['id', 'email', 'phone', 'nrc_number', 'name']);
                    $byEmail = [];
                    foreach ($created as $row) {
                        $byEmail[$row->email] = $row;
                    }
                    foreach ($chunk as $user) {
                        $real = $byEmail[$user['email']] ?? null;
                        if (! $real) {
                            continue;
                        }
                        $tempToReal[(int) $user['_temp_id']] = (int) $real->id;
                        $entry = [
                            'id' => (int) $real->id,
                            'phone' => $real->phone,
                            'nrc' => $real->nrc_number,
                            'name' => (string) $real->name,
                        ];
                        $this->customerIds[$entry['id']] = true;
                        if ($entry['phone']) {
                            $this->customersByPhone[(string) $entry['phone']] = $entry;
                        }
                        if ($entry['nrc']) {
                            $this->customersByNrc[(string) $entry['nrc']] = $entry;
                        }
                    }
                }
                $this->pendingUsers = [];
            }

            // Remap spend/activity/purchases/ledger from temp user ids.
            if ($tempToReal !== []) {
                $newSpend = [];
                foreach ($this->spendDelta as $uid => $amount) {
                    $mapped = $tempToReal[$uid] ?? $uid;
                    $newSpend[$mapped] = ($newSpend[$mapped] ?? 0) + $amount;
                }
                $this->spendDelta = $newSpend;

                $newActivity = [];
                foreach ($this->activityAt as $uid => $at) {
                    $mapped = $tempToReal[$uid] ?? $uid;
                    $newActivity[$mapped] = $at;
                }
                $this->activityAt = $newActivity;

                foreach ($this->pendingPurchases as &$purchase) {
                    $uid = (int) $purchase['user_id'];
                    if (isset($tempToReal[$uid])) {
                        $purchase['user_id'] = $tempToReal[$uid];
                    }
                }
                unset($purchase);

                foreach ($this->pendingLedger as &$ledger) {
                    $uid = (int) $ledger['user_id'];
                    if (isset($tempToReal[$uid])) {
                        $ledger['user_id'] = $tempToReal[$uid];
                    }
                }
                unset($ledger);
            }

            if ($this->pendingPurchases !== []) {
                foreach (array_chunk($this->pendingPurchases, 200) as $chunk) {
                    DB::table('purchases')->insert($chunk);
                }

                if ($awardPoints && $this->pendingLedger !== []) {
                    $externalIds = array_values(array_unique(array_map(
                        fn ($row) => (int) $row['purchase_external_id'],
                        $this->pendingLedger,
                    )));
                    $purchaseIds = DB::table('purchases')
                        ->whereIn('external_id', $externalIds)
                        ->pluck('id', 'external_id');

                    $ledgerRows = [];
                    foreach ($this->pendingLedger as $row) {
                        $purchaseId = $purchaseIds[$row['purchase_external_id']] ?? null;
                        if (! $purchaseId) {
                            continue;
                        }
                        $ledgerRows[] = [
                            'user_id' => $row['user_id'],
                            'type' => $row['type'],
                            'source' => $row['source'],
                            'points' => $row['points'],
                            'tier_eligible' => $row['tier_eligible'],
                            'purchase_id' => $purchaseId,
                            'meta' => $row['meta'],
                            'created_at' => $row['created_at'],
                            'updated_at' => $row['updated_at'],
                        ];
                    }
                    foreach (array_chunk($ledgerRows, 200) as $chunk) {
                        DB::table('point_ledger')->insert($chunk);
                    }
                }

                $this->pendingPurchases = [];
                $this->pendingLedger = [];
            }
        });
    }

    private function finalizeSpendAndTiers(bool $awardPoints = false): void
    {
        if ($this->spendDelta !== []) {
            foreach ($this->spendDelta as $userId => $delta) {
                if ($delta <= 0 || $userId <= 0) {
                    continue;
                }
                $activity = $this->activityAt[$userId] ?? null;
                $payload = [
                    'total_spent' => DB::raw('total_spent + '.(int) $delta),
                    'updated_at' => now()->format('Y-m-d H:i:s'),
                ];
                if ($activity) {
                    $payload['last_activity_at'] = $activity;
                }
                DB::table('users')->where('id', $userId)->update($payload);
            }
            $this->spendDelta = [];
            $this->activityAt = [];
        }

        // Assign tiers from lifetime spend. Wallet recompute only when points were awarded.
        $tiers = TierService::tiers()->values();
        $touchedIds = array_keys($this->customerIds);
        if ($touchedIds === []) {
            return;
        }

        foreach (array_chunk($touchedIds, 500) as $idChunk) {
            $users = DB::table('users')->whereIn('id', $idChunk)->get(['id', 'total_spent']);
            $wallets = [];
            if ($awardPoints) {
                $wallets = DB::table('point_ledger')
                    ->whereIn('user_id', $idChunk)
                    ->groupBy('user_id')
                    ->selectRaw('user_id, COALESCE(SUM(points), 0) as wallet')
                    ->pluck('wallet', 'user_id');
            }

            foreach ($users as $user) {
                $tier = 'Care';
                $spend = (int) $user->total_spent;
                foreach ($tiers as $row) {
                    if ($spend >= (int) $row->min_spend_mmk) {
                        $tier = $row->name;
                    }
                }
                $update = [
                    'tier' => $tier,
                    'updated_at' => now()->format('Y-m-d H:i:s'),
                ];
                if ($awardPoints) {
                    $wallet = max(0, (int) ($wallets[$user->id] ?? 0));
                    $update['points'] = $wallet;
                    $update['redeemable_points'] = $wallet;
                }
                DB::table('users')->where('id', $user->id)->update($update);
            }
        }
    }

    private function transactionSide(array $row): string
    {
        $debitCredit = strtolower(trim((string) ($row['debit_credit'] ?? '')));
        if ($debitCredit === 'credit') {
            return 'sale';
        }
        if ($debitCredit === 'debit') {
            return 'buyback';
        }

        $account = strtolower((string) ($row['account_name'] ?? ''));
        if (str_starts_with($account, 'sale')) {
            return 'sale';
        }

        return 'buyback';
    }

    private function mapProductCategory(string $category): string
    {
        $key = strtolower(trim($category));

        return match (true) {
            $key === 'gold' => 'Gold',
            in_array($key, ['dia', 'diamond'], true) => 'Diamond',
            $key === 'jade' => 'Jade',
            $key === 'ruby' => 'Ruby',
            $key === 'silver' => 'Silver',
            $key === 'watch' => 'Watch',
            default => 'Other',
        };
    }

    private function mapPaymentMethod(array $row): string
    {
        $cashBook = strtolower((string) ($row['cash_book_type'] ?? ''));
        if (str_contains($cashBook, 'bank')) {
            return 'Bank';
        }

        return 'Cash';
    }

    private function normalizePhone(string $raw): string
    {
        $digits = preg_replace('/\D+/', '', $raw) ?: '';
        if ($digits === '') {
            return '';
        }
        if (str_starts_with($digits, '959') && strlen($digits) >= 11) {
            $digits = '0'.substr($digits, 2);
        }
        if (! str_starts_with($digits, '0') && strlen($digits) === 9) {
            $digits = '0'.$digits;
        }

        return $digits;
    }

    private function moneyToInt(mixed $value): int
    {
        if (is_string($value)) {
            $value = str_replace([',', ' '], '', $value);
        }

        return (int) round((float) $value);
    }

    private function parseDateTime(mixed $value): ?Carbon
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse((string) $value);
        } catch (\Throwable) {
            return null;
        }
    }
}
