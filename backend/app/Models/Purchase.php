<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Purchase extends Model
{
    protected $fillable = [
        'external_id',
        'user_id',
        'product_name',
        'product_code',
        'voucher_number',
        'branch_name',
        'branch_id',
        'transaction_side',
        'product_type',
        'amount',
        'discount_percent',
        'net_amount',
        'points_earned',
        'points_redeemed',
        'amount_offset_mmk',
        'earn_snapshot',
        'payment_method',
        'sold_at',
        'status',
        'cancel_reason',
        'cancelled_at',
    ];

    protected function casts(): array
    {
        return [
            'external_id' => 'integer',
            'branch_id' => 'integer',
            'amount' => 'integer',
            'discount_percent' => 'integer',
            'net_amount' => 'integer',
            'points_earned' => 'integer',
            'points_redeemed' => 'integer',
            'amount_offset_mmk' => 'integer',
            'earn_snapshot' => 'array',
            'sold_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
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
