<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WheelSegment extends Model
{
    protected $fillable = [
        'wheel_id',
        'name',
        'prize_label',
        'display_label',
        'description',
        'image_path',
        'weight',
        'winning_message',
        'instructions',
        'requires_claim',
        'claim_days',
        'tier',
        'color',
        'sort_order',
        'is_active',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return [
            'weight' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'requires_claim' => 'boolean',
            'claim_days' => 'integer',
        ];
    }

    public function wheel(): BelongsTo
    {
        return $this->belongsTo(Wheel::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return '/storage/'.$this->image_path;
    }
}
