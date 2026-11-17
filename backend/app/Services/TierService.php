<?php

namespace App\Services;

use App\Models\LoyaltyTier;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class TierService
{
    public static function tiers(): Collection
    {
        return Cache::remember('loyalty_tiers_ordered', 60, function () {
            return LoyaltyTier::ordered();
        });
    }

    public static function tiersMap(): array
    {
        $map = [];
        foreach (self::tiers() as $tier) {
            $map[$tier->name] = [
                'min' => (int) $tier->min_spend_mmk,
                'min_spend_mmk' => (int) $tier->min_spend_mmk,
                'min_lakh' => (int) round(((int) $tier->min_spend_mmk) / 100_000),
                'multiplier' => (float) $tier->earn_multiplier,
                'perks' => $tier->perks ?? [],
                'sort_order' => (int) $tier->sort_order,
            ];
        }

        return $map;
    }

    public static function tierForSpend(int $totalSpentMmk): string
    {
        $tier = 'Care';
        foreach (self::tiers() as $row) {
            if ($totalSpentMmk >= (int) $row->min_spend_mmk) {
                $tier = $row->name;
            }
        }

        return $tier;
    }

    /** @deprecated Use tierForSpend — kept for temporary call-site compat */
    public static function tierForPoints(int $tierPoints365d): string
    {
        return self::tierForSpend($tierPoints365d);
    }

    public static function multiplierForTier(string $tier): float
    {
        $map = self::tiersMap();

        return (float) ($map[$tier]['multiplier'] ?? 1.0);
    }

    public static function nextTier(User $user): ?array
    {
        $ordered = self::tiers()->values();
        $index = $ordered->search(fn ($row) => $row->name === $user->tier);
        if ($index === false || $index >= $ordered->count() - 1) {
            return null;
        }

        $next = $ordered[$index + 1];
        $currentSpend = (int) $user->total_spent;
        $min = (int) $next->min_spend_mmk;
        $remaining = max(0, $min - $currentSpend);

        return [
            'name' => $next->name,
            'min_points' => $min, // legacy key used by some clients
            'min_spend_mmk' => $min,
            'min_lakh' => (int) round($min / 100_000),
            'remaining' => $remaining,
            'remaining_lakh' => (int) ceil($remaining / 100_000),
            'progress' => $min > 0 ? min(100, round(($currentSpend / $min) * 100, 1)) : 100,
            'multiplier' => (float) $next->earn_multiplier,
            'estimated_spend_mmk' => $remaining,
            'at_multiplier' => round(self::multiplierForTier($user->tier ?? 'Care'), 2),
        ];
    }

    /** @deprecated Auto discounts removed — kept for temporary API compat */
    public static function discountForTier(string $tier): int
    {
        return 0;
    }
}
