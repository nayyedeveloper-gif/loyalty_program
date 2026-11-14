<?php

namespace App\Services;

use App\Models\User;

class TierService
{
    public const TIERS = [
        'Silver' => ['min' => 0, 'discount' => 0],
        'Gold' => ['min' => 1_000_000, 'discount' => 2],
        'Platinum' => ['min' => 5_000_000, 'discount' => 5],
        'Diamond' => ['min' => 15_000_000, 'discount' => 8],
    ];

    public static function pointsFromAmount(int $netAmount): int
    {
        return intdiv($netAmount, 1000);
    }

    public static function tierForSpend(int $totalSpent): string
    {
        $tier = 'Silver';

        foreach (self::TIERS as $name => $config) {
            if ($totalSpent >= $config['min']) {
                $tier = $name;
            }
        }

        return $tier;
    }

    public static function discountForTier(string $tier): int
    {
        return self::TIERS[$tier]['discount'] ?? 0;
    }

    public static function nextTier(User $user): ?array
    {
        $order = array_keys(self::TIERS);
        $index = array_search($user->tier, $order, true);

        if ($index === false || $index >= count($order) - 1) {
            return null;
        }

        $next = $order[$index + 1];
        $min = self::TIERS[$next]['min'];

        return [
            'name' => $next,
            'min_spend' => $min,
            'remaining' => max(0, $min - $user->total_spent),
            'progress' => min(100, round(($user->total_spent / $min) * 100, 1)),
        ];
    }

    public static function syncUser(User $user): void
    {
        $user->tier = self::tierForSpend((int) $user->total_spent);
        $user->save();
    }
}
