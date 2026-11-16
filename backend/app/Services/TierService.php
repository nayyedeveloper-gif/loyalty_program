<?php

namespace App\Services;

use App\Models\LoyaltySetting;
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
                'min' => (int) $tier->min_tier_points,
                'multiplier' => (float) $tier->earn_multiplier,
                'perks' => $tier->perks ?? [],
                'sort_order' => (int) $tier->sort_order,
            ];
        }

        return $map;
    }

    public static function tierForPoints(int $tierPoints365d): string
    {
        $tier = 'Bronze';
        foreach (self::tiers() as $row) {
            if ($tierPoints365d >= (int) $row->min_tier_points) {
                $tier = $row->name;
            }
        }

        return $tier;
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
        $currentPoints = (int) $user->tier_points_365d;
        $min = (int) $next->min_tier_points;
        $remaining = max(0, $min - $currentPoints);
        $divisor = max(1, LoyaltySetting::getInt('base_earn_divisor', 10000));
        $currentMultiplier = max(0.01, self::multiplierForTier($user->tier ?? 'Bronze'));
        // Approximate payable MMK needed at current earn rate (base × tier, no promo).
        $estimatedMmk = (int) ceil(($remaining * $divisor) / $currentMultiplier);

        return [
            'name' => $next->name,
            'min_points' => $min,
            'remaining' => $remaining,
            'progress' => $min > 0 ? min(100, round(($currentPoints / $min) * 100, 1)) : 100,
            'multiplier' => (float) $next->earn_multiplier,
            'estimated_spend_mmk' => $estimatedMmk,
            'earn_divisor' => $divisor,
            'at_multiplier' => round($currentMultiplier, 2),
        ];
    }

    /** @deprecated Auto discounts removed — kept for temporary API compat */
    public static function discountForTier(string $tier): int
    {
        return 0;
    }
}
