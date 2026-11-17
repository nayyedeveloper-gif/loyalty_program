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
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class SalesEntrySyncService
{
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
        $page = 1;
        $imported = 0;
        $skipped = 0;
        $customersCreated = 0;
        $consecutiveKnown = 0;

        do {
            $payload = $this->client->fetchMasterSetup($page);
            $rows = $payload['data'] ?? [];
            $pagination = $payload['pagination'] ?? [];
            $lastPage = (int) ($pagination['last_page'] ?? $page);

            if ($onProgress) {
                $onProgress("Page {$page}/{$lastPage} (".count($rows).' rows)');
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

                if (Purchase::query()->where('external_id', $externalId)->exists()) {
                    $skipped++;
                    $consecutiveKnown++;
                    // Newest-first feed: incremental sync can stop once recent rows are already known.
                    if (! $full && $maxPages === 0 && $consecutiveKnown >= 40) {
                        return compact('imported', 'skipped', 'customersCreated') + [
                            'pages' => $page,
                            'stopped_early' => true,
                        ];
                    }
                    continue;
                }

                $consecutiveKnown = 0;
                $result = $this->importRowWithRetry($row, $side, $awardPoints);
                $imported += $result['imported'] ? 1 : 0;
                $skipped += $result['imported'] ? 0 : 1;
                $customersCreated += $result['customer_created'] ? 1 : 0;
            }

            $page++;
            if ($maxPages > 0 && $page > $maxPages) {
                break;
            }
        } while ($page <= $lastPage);

        return compact('imported', 'skipped', 'customersCreated') + [
            'pages' => $page - 1,
            'stopped_early' => false,
        ];
    }

    private function importRowWithRetry(array $row, string $side, bool $awardPoints, int $attempts = 5): array
    {
        $last = null;
        for ($i = 1; $i <= $attempts; $i++) {
            try {
                return $this->importRow($row, $side, $awardPoints);
            } catch (\Throwable $e) {
                $last = $e;
                $message = strtolower($e->getMessage());
                if (! str_contains($message, 'database is locked') && ! str_contains($message, 'database locked')) {
                    throw $e;
                }
                usleep(200_000 * $i);
            }
        }

        throw $last ?? new \RuntimeException('Sales Entry import failed.');
    }

    private function importRow(array $row, string $side, bool $awardPoints): array
    {
        $amount = $this->moneyToInt($row['total_combined_value'] ?? $row['total_product_value'] ?? $row['product_value'] ?? 0);
        if ($amount <= 0) {
            return ['imported' => false, 'customer_created' => false];
        }

        $customerCreated = false;

        $purchase = DB::transaction(function () use ($row, $side, $awardPoints, $amount, &$customerCreated) {
            [$customer, $created] = $this->findOrCreateCustomer($row);
            $customerCreated = $created;

            $productType = $this->mapProductCategory((string) ($row['product_category'] ?? ''));
            $productName = trim((string) ($row['product_type'] ?? '')) ?: (string) ($row['product_code'] ?? 'Item');
            $soldAt = $this->parseDateTime($row['created_at'] ?? null) ?: $this->parseDateTime($row['date'] ?? null) ?: now();

            $earn = PointsEngine::computePurchaseEarn($customer, $amount, $productType);
            $snapshot = [
                'base_points' => $earn['base_points'],
                'tier_multiplier' => $earn['tier_multiplier'],
                'promo_multiplier' => $earn['promo_multiplier'],
                'points_earned' => $earn['points'],
                'tier_at_purchase' => $customer->tier,
                'payable' => $amount,
                'source' => 'salesentry',
                'external_id' => (int) $row['id'],
            ];

            $purchase = new Purchase([
                'external_id' => (int) $row['id'],
                'user_id' => $customer->id,
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
                'points_earned' => $side === 'sale' ? $earn['points'] : 0,
                'points_redeemed' => 0,
                'amount_offset_mmk' => 0,
                'earn_snapshot' => $snapshot,
                'payment_method' => $this->mapPaymentMethod($row),
                'sold_at' => $soldAt,
                'status' => 'recorded',
            ]);
            $purchase->created_at = $soldAt;
            $purchase->updated_at = $soldAt;
            $purchase->save();

            if ($side === 'sale') {
                $customer->total_spent = (int) $customer->total_spent + $amount;
                $customer->save();

                if ($awardPoints && $earn['points'] > 0) {
                    PointsEngine::applyPurchasePoints(
                        $customer,
                        $purchase,
                        $earn['points'],
                        0,
                        [
                            'base_points' => $earn['base_points'],
                            'tier_multiplier' => $earn['tier_multiplier'],
                            'promo_multiplier' => $earn['promo_multiplier'],
                            'payable' => $amount,
                            'source' => 'salesentry',
                        ],
                        $soldAt,
                        notifyTierChange: false,
                    );
                } else {
                    PointsEngine::refreshUserBalances($customer, touchActivity: false);
                }
            }

            return $purchase;
        });

        return [
            'imported' => (bool) $purchase,
            'customer_created' => $customerCreated,
        ];
    }

    /**
     * @return array{0: User, 1: bool}
     */
    private function findOrCreateCustomer(array $row): array
    {
        $name = trim((string) ($row['customer_name'] ?? '')) ?: 'Sales Entry Customer';
        $phone = $this->normalizePhone((string) ($row['phone_number'] ?? ''));
        $nrc = trim((string) ($row['nrc_number'] ?? '')) ?: null;
        $address = trim((string) ($row['address'] ?? '')) ?: null;

        $query = User::query()->where('role', 'customer');
        if ($phone !== '') {
            $existing = (clone $query)->where('phone', $phone)->lockForUpdate()->first();
            if ($existing) {
                $this->touchCustomerProfile($existing, $name, $nrc, $address);
                return [$existing, false];
            }
        }

        if ($nrc) {
            $existing = (clone $query)->where('nrc_number', $nrc)->lockForUpdate()->first();
            if ($existing) {
                $this->touchCustomerProfile($existing, $name, $nrc, $address, $phone ?: null);
                return [$existing, false];
            }
        }

        $emailSeed = $phone !== '' ? $phone : ($nrc ?: Str::lower(Str::slug($name)).'-'.($row['id'] ?? Str::random(6)));
        $email = 'se_'.substr(hash('sha256', $emailSeed), 0, 20).'@salesentry.local';

        // Avoid rare collisions.
        while (User::query()->where('email', $email)->exists()) {
            $email = 'se_'.Str::lower(Str::random(20)).'@salesentry.local';
        }

        $uniquePhone = $phone !== '' ? $phone : ('09'.substr(preg_replace('/\D/', '', hash('sha256', $emailSeed)) ?: '0', 0, 9));
        while (User::query()->where('phone', $uniquePhone)->exists()) {
            $uniquePhone = '09'.str_pad((string) random_int(0, 999999999), 9, '0', STR_PAD_LEFT);
        }

        $customer = User::create([
            'name' => Str::limit($name, 120, ''),
            'email' => $email,
            'phone' => $uniquePhone,
            'nrc_number' => $nrc,
            'address' => $address ? Str::limit($address, 255, '') : null,
            'role' => 'customer',
            'source' => 'salesentry',
            'tier' => 'Care',
            'password' => Hash::make(Str::password(24)),
            'total_spent' => 0,
            'points' => 0,
            'redeemable_points' => 0,
            'last_activity_at' => now(),
        ]);

        return [$customer, true];
    }

    private function touchCustomerProfile(User $customer, string $name, ?string $nrc, ?string $address, ?string $phone = null): void
    {
        $dirty = false;
        if ($name && $customer->name !== $name) {
            $customer->name = Str::limit($name, 120, '');
            $dirty = true;
        }
        if ($nrc && ! $customer->nrc_number) {
            $customer->nrc_number = $nrc;
            $dirty = true;
        }
        if ($address && ! $customer->address) {
            $customer->address = Str::limit($address, 255, '');
            $dirty = true;
        }
        if ($phone && ! $customer->phone) {
            $customer->phone = $phone;
            $dirty = true;
        }
        if ($customer->source !== 'salesentry') {
            $customer->source = 'salesentry';
            $dirty = true;
        }
        if ($dirty) {
            $customer->save();
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
