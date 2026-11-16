<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyTier extends Model
{
    protected $fillable = [
        'name',
        'sort_order',
        'min_tier_points',
        'earn_multiplier',
        'perks',
    ];

    protected function casts(): array
    {
        return [
            'min_tier_points' => 'integer',
            'earn_multiplier' => 'float',
            'perks' => 'array',
            'sort_order' => 'integer',
        ];
    }

    public static function ordered()
    {
        return static::query()->orderBy('sort_order')->get();
    }
}
