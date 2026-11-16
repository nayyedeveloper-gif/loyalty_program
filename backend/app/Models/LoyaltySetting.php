<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class LoyaltySetting extends Model
{
    protected $fillable = ['key', 'value'];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        return Cache::rememberForever("loyalty_setting_{$key}", function () use ($key, $default) {
            return static::query()->where('key', $key)->value('value') ?? $default;
        });
    }

    public static function getInt(string $key, int $default = 0): int
    {
        return (int) (static::getValue($key, (string) $default) ?? $default);
    }

    public static function getFloat(string $key, float $default = 0): float
    {
        return (float) (static::getValue($key, (string) $default) ?? $default);
    }

    public static function allMapped(): array
    {
        return [
            'base_earn_divisor' => static::getInt('base_earn_divisor', 10000),
            'redemption_rate' => static::getInt('redemption_rate', 1),
            'redeem_increment' => static::getInt('redeem_increment', 100),
            'inactivity_days' => static::getInt('inactivity_days', 365),
            'signup_bonus_points' => static::getInt('signup_bonus_points', 100),
            'referral_bonus_points' => static::getInt('referral_bonus_points', 100),
            'review_bonus_points' => static::getInt('review_bonus_points', 20),
            'winback_bonus_points' => static::getInt('winback_bonus_points', 50),
            'winback_inactive_days' => static::getInt('winback_inactive_days', 180),
        ];
    }
}
