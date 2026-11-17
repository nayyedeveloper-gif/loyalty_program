<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IdempotencyKey extends Model
{
    protected $fillable = [
        'user_id',
        'key',
        'route',
        'status_code',
        'response_body',
    ];

    protected function casts(): array
    {
        return [
            'response_body' => 'array',
            'status_code' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
