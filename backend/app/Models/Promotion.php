<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'multiplier',
        'starts_at',
        'ends_at',
        'product_types',
        'weekends_only',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'multiplier' => 'float',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'product_types' => 'array',
            'weekends_only' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
