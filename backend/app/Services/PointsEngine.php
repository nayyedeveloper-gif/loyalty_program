<?php

namespace App\Services;

use App\Models\LoyaltySetting;
use App\Models\PointLedger;
use App\Models\Promotion;
use App\Models\Purchase;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PointsEngine
{
    public static function settings(): array
    {
        return LoyaltySetting::allMapped();
    }

    public static function basePointsFromAmount(int $amountMmK): int
    {
        $divisor = max(1, LoyaltySetting::getInt('base_earn_divisor', 10000));

        return intdiv(max(0, $amountMmK), $divisor);
    }

    public static function activePromoMultiplier(?string $productType = null, ?Carbon $at = null): float
    {
        $at = $at ?: now();
        $best = 1.0;

        $promos = Promotion::query()->where('is_active', true)->get();
        foreach ($promos as $promo) {
            if ($promo->starts_at && $at->lt($promo->starts_at)) {
                continue;
            }
            if ($promo->ends_at && $at->gt($promo->ends_at)) {
                continue;
            }
            if ($promo->weekends_only && ! $at->isWeekend()) {
                continue;
            }
            if (is_array($promo->product_types) && count($promo->product_types) > 0) {
                if (! $productType || ! in_array($productType, $promo->product_types, true)) {
                    continue;
                }
            }
            $best = max($best, (float) $promo->multiplier);
        }

        return $best;
    }

    public static function computePurchaseEarn(User $customer, int $amountMmK, ?string $productType = null): array
    {
        $base = self::basePointsFromAmount($amountMmK);
        $tierMultiplier = TierService::multiplierForTier($customer->tier ?? 'Bronze');
        $promoMultiplier = self::activePromoMultiplier($productType);
        $points = (int) floor($base * $tierMultiplier * $promoMultiplier);

        return [
            'base_points' => $base,
            'tier_multiplier' => $tierMultiplier,
            'promo_multiplier' => $promoMultiplier,
            'points' => $points,
        ];
    }

    public static function validateRedeemAmount(User $customer, int $pointsToRedeem, int $purchaseAmount): array
    {
        $settings = self::settings();
        $increment = max(1, $settings['redeem_increment']);
        $rate = max(1, $settings['redemption_rate']);

        if ($pointsToRedeem < 0) {
            throw ValidationException::withMessages(['points_to_redeem' => ['Points to redeem cannot be negative.']]);
        }

        if ($pointsToRedeem === 0) {
            return ['points' => 0, 'offset_mmk' => 0];
        }

        if ($pointsToRedeem % $increment !== 0) {
            throw ValidationException::withMessages([
                'points_to_redeem' => ["Redeem in increments of {$increment} points."],
            ]);
        }

        if ($pointsToRedeem > (int) $customer->redeemable_points) {
            throw ValidationException::withMessages([
                'points_to_redeem' => ['Insufficient redeemable points.'],
            ]);
        }

        $offset = $pointsToRedeem * $rate;
        if ($offset > $purchaseAmount) {
            throw ValidationException::withMessages([
                'points_to_redeem' => ['Redeemed value cannot exceed purchase amount.'],
            ]);
        }

        return ['points' => $pointsToRedeem, 'offset_mmk' => $offset];
    }

    public static function writeLedger(
        User $user,
        string $type,
        string $source,
        int $points,
        bool $tierEligible = false,
        ?int $purchaseId = null,
        ?array $meta = null,
        ?int $relatedLedgerId = null,
        ?Carbon $createdAt = null,
    ): PointLedger {
        $entry = PointLedger::create([
            'user_id' => $user->id,
            'type' => $type,
            'source' => $source,
            'points' => $points,
            'tier_eligible' => $tierEligible && $points > 0,
            'purchase_id' => $purchaseId,
            'related_ledger_id' => $relatedLedgerId,
            'meta' => $meta,
            'created_at' => $createdAt ?: now(),
            'updated_at' => $createdAt ?: now(),
        ]);

        return $entry;
    }

    public static function refreshUserBalances(User $user, bool $touchActivity = false): User
    {
        $wallet = (int) PointLedger::where('user_id', $user->id)->sum('points');
        $windowStart = now()->subDays(365);
        $tierPoints = (int) PointLedger::where('user_id', $user->id)
            ->where('tier_eligible', true)
            ->where('points', '>', 0)
            ->where('created_at', '>=', $windowStart)
            ->sum('points');

        $previousTier = (string) ($user->tier ?: 'Bronze');

        $user->redeemable_points = max(0, $wallet);
        $user->points = max(0, $wallet); // legacy mirror
        $user->tier_points_365d = max(0, $tierPoints);
        $user->tier = TierService::tierForPoints((int) $user->tier_points_365d);

        if ($touchActivity) {
            $user->last_activity_at = now();
        }

        $user->save();

        $fresh = $user->fresh();
        if ($fresh && $previousTier !== (string) $fresh->tier) {
            $ordered = TierService::tiers()->pluck('name')->values();
            $prevIndex = $ordered->search($previousTier);
            $nextIndex = $ordered->search($fresh->tier);
            if ($prevIndex !== false && $nextIndex !== false && $nextIndex > $prevIndex) {
                NotificationService::tierUpgraded($fresh, $previousTier, (string) $fresh->tier);
            }
        }

        return $fresh;
    }

    public static function reversePurchaseLedger(Purchase $purchase): void
    {
        $entries = PointLedger::where('purchase_id', $purchase->id)
            ->whereIn('type', ['earn', 'redeem', 'bonus'])
            ->orderBy('id')
            ->get();

        foreach ($entries as $entry) {
            // Skip if already reversed
            $already = PointLedger::where('related_ledger_id', $entry->id)->where('type', 'reverse')->exists();
            if ($already) {
                continue;
            }

            self::writeLedger(
                user: User::findOrFail($entry->user_id),
                type: 'reverse',
                source: $entry->source,
                points: -1 * (int) $entry->points,
                tierEligible: false,
                purchaseId: $purchase->id,
                meta: ['reverses_ledger_id' => $entry->id],
                relatedLedgerId: $entry->id,
            );
        }

        if ($purchase->user_id) {
            self::refreshUserBalances(User::findOrFail($purchase->user_id), touchActivity: false);
        }
    }

    public static function applyPurchasePoints(
        User $customer,
        Purchase $purchase,
        int $earnPoints,
        int $redeemPoints,
        array $earnMeta = [],
    ): void {
        if ($earnPoints > 0) {
            self::writeLedger(
                user: $customer,
                type: 'earn',
                source: 'purchase',
                points: $earnPoints,
                tierEligible: true,
                purchaseId: $purchase->id,
                meta: $earnMeta,
            );
        }

        if ($redeemPoints > 0) {
            self::writeLedger(
                user: $customer,
                type: 'redeem',
                source: 'purchase',
                points: -1 * $redeemPoints,
                tierEligible: false,
                purchaseId: $purchase->id,
                meta: ['offset_mmk' => $purchase->amount_offset_mmk],
            );
        }

        self::refreshUserBalances($customer, touchActivity: true);
    }

    public static function creditBonus(User $user, int $points, string $source, array $meta = [], bool $tierEligible = true): PointLedger
    {
        $entry = self::writeLedger(
            user: $user,
            type: 'bonus',
            source: $source,
            points: $points,
            tierEligible: $tierEligible,
            meta: $meta,
        );
        self::refreshUserBalances($user, touchActivity: true);

        return $entry;
    }

    public static function adjustPoints(
        User $user,
        int $points,
        string $reason,
        bool $tierEligible = false,
        ?int $adminId = null,
    ): PointLedger {
        if ($points === 0) {
            throw ValidationException::withMessages(['points' => ['Adjustment points cannot be zero.']]);
        }

        $reason = trim($reason);
        if ($reason === '') {
            throw ValidationException::withMessages(['reason' => ['A reason is required for point adjustments.']]);
        }

        if ($points < 0 && abs($points) > (int) $user->redeemable_points) {
            throw ValidationException::withMessages([
                'points' => ['Cannot deduct more than the customer redeemable balance.'],
            ]);
        }

        $entry = self::writeLedger(
            user: $user,
            type: 'adjust',
            source: 'admin',
            points: $points,
            tierEligible: $points > 0 && $tierEligible,
            meta: [
                'reason' => $reason,
                'admin_id' => $adminId,
            ],
        );
        self::refreshUserBalances($user, touchActivity: true);

        return $entry;
    }

    public static function redeemCatalog(User $user, int $pointsCost, string $source = 'catalog', array $meta = []): PointLedger
    {
        if ($pointsCost <= 0) {
            throw ValidationException::withMessages(['points' => ['Invalid catalog cost.']]);
        }
        if ($pointsCost > (int) $user->redeemable_points) {
            throw ValidationException::withMessages(['points' => ['Insufficient redeemable points.']]);
        }

        $entry = self::writeLedger(
            user: $user,
            type: 'redeem',
            source: $source,
            points: -1 * $pointsCost,
            tierEligible: false,
            meta: $meta,
        );
        self::refreshUserBalances($user, touchActivity: true);

        return $entry;
    }

    public static function refundCatalogRedemption(User $user, PointLedger $redeemEntry, array $meta = []): PointLedger
    {
        if ($redeemEntry->type !== 'redeem' || (int) $redeemEntry->points >= 0) {
            throw ValidationException::withMessages(['redemption' => ['Invalid redemption ledger entry.']]);
        }

        $already = PointLedger::where('related_ledger_id', $redeemEntry->id)->where('type', 'reverse')->exists();
        if ($already) {
            throw ValidationException::withMessages(['redemption' => ['This redemption was already refunded.']]);
        }

        $entry = self::writeLedger(
            user: $user,
            type: 'reverse',
            source: 'catalog',
            points: -1 * (int) $redeemEntry->points,
            tierEligible: false,
            meta: array_merge(['reverses_ledger_id' => $redeemEntry->id], $meta),
            relatedLedgerId: $redeemEntry->id,
        );
        self::refreshUserBalances($user, touchActivity: true);

        return $entry;
    }

    public static function expireInactiveWallets(): int
    {
        $days = LoyaltySetting::getInt('inactivity_days', 365);
        $cutoff = now()->subDays($days);
        $expiredCount = 0;

        User::query()
            ->where('role', 'customer')
            ->where('redeemable_points', '>', 0)
            ->where(function ($q) use ($cutoff) {
                $q->whereNull('last_activity_at')->orWhere('last_activity_at', '<', $cutoff);
            })
            ->orderBy('id')
            ->chunkById(100, function ($users) use (&$expiredCount) {
                foreach ($users as $user) {
                    DB::transaction(function () use ($user, &$expiredCount) {
                        $balance = (int) $user->redeemable_points;
                        if ($balance <= 0) {
                            return;
                        }
                        self::writeLedger(
                            user: $user,
                            type: 'expire',
                            source: 'system',
                            points: -1 * $balance,
                            tierEligible: false,
                            meta: ['reason' => 'inactivity'],
                        );
                        self::refreshUserBalances($user, touchActivity: false);
                        NotificationService::pointsExpired($user->fresh(), $balance);
                        $expiredCount++;
                    });
                }
            });

        return $expiredCount;
    }

    public static function ensureReferralCode(User $user): string
    {
        if ($user->referral_code) {
            return $user->referral_code;
        }

        $code = 'R'.strtoupper(substr(md5($user->id.$user->email.uniqid('', true)), 0, 8));
        $user->referral_code = $code;
        $user->save();

        return $code;
    }
}
