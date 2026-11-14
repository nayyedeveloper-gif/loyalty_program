<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Purchase extends Model
{
    protected $fillable = [
        'user_id',
        'product_name',
        'product_code',
        'product_type',
        'amount',
        'discount_percent',
        'net_amount',
        'points_earned',
        'payment_method',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'discount_percent' => 'integer',
            'net_amount' => 'integer',
            'points_earned' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
