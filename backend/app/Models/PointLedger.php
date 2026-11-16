<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PointLedger extends Model
{
    protected $table = 'point_ledger';

    protected $fillable = [
        'user_id',
        'type',
        'source',
        'points',
        'tier_eligible',
        'purchase_id',
        'related_ledger_id',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'tier_eligible' => 'boolean',
            'meta' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }
}
