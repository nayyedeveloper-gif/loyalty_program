<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpinPromoResponse extends Model
{
    protected $fillable = [
        'spin_promo_id',
        'user_id',
        'action',
    ];

    public function promo(): BelongsTo
    {
        return $this->belongsTo(SpinPromo::class, 'spin_promo_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
