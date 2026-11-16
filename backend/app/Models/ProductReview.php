<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductReview extends Model
{
    protected $fillable = [
        'user_id',
        'product_code',
        'product_name',
        'rating',
        'body',
        'points_awarded',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'points_awarded' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
