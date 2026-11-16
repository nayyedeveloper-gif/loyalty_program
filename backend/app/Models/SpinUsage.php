<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SpinUsage extends Model
{
    protected $fillable = [
        'user_id',
        'wheel_id',
        'source',
        'granted_at',
        'expires_at',
        'status',
        'used_at',
    ];

    protected function casts(): array
    {
        return [
            'granted_at' => 'datetime',
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function wheel(): BelongsTo
    {
        return $this->belongsTo(Wheel::class);
    }

    public function result(): HasOne
    {
        return $this->hasOne(SpinResult::class);
    }

    public function isUsable(): bool
    {
        return $this->status === 'available' && $this->expires_at->isFuture();
    }
}
