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
        'stock',
        'stock_depleted_at',
    ];

    protected $appends = ['image_url', 'stock_unlimited', 'is_out_of_stock'];

    protected function casts(): array
    {
        return [
            'weight' => 'integer',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
            'requires_claim' => 'boolean',
            'claim_days' => 'integer',
            'stock' => 'integer',
            'stock_depleted_at' => 'datetime',
        ];
    }

    public function getStockUnlimitedAttribute(): bool
    {
        return $this->stock === null;
    }

    public function getIsOutOfStockAttribute(): bool
    {
        return $this->stock !== null && (int) $this->stock <= 0;
    }

    public function hasAvailableStock(): bool
    {
        return $this->stock === null || (int) $this->stock > 0;
    }

    /**
     * Consume one unit of limited stock. Caller should lock the row first when concurrent.
     * Deactivates the prize when stock hits zero.
     */
    public function consumeStock(): bool
    {
        if ($this->stock === null) {
            return true;
        }

        if ((int) $this->stock <= 0) {
            return false;
        }

        $this->stock = (int) $this->stock - 1;
        if ($this->stock <= 0) {
            $this->stock = 0;
            $this->is_active = false;
            $this->stock_depleted_at = now();
        }
        $this->save();

        return true;
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
