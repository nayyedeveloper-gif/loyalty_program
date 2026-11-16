<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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
        'points_redeemed',
        'amount_offset_mmk',
        'payment_method',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'discount_percent' => 'integer',
            'net_amount' => 'integer',
            'points_earned' => 'integer',
            'points_redeemed' => 'integer',
            'amount_offset_mmk' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(PointLedger::class);
    }
}
