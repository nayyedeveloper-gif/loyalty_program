<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BirthdayBonusClaim extends Model
{
    protected $fillable = [
        'user_id',
        'year',
        'points',
        'ledger_id',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'points' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
