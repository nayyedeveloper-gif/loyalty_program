<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SpinResult extends Model
{
    protected $fillable = [
        'reward_code',
        'spin_usage_id',
        'user_id',
        'is_guest',
        'guest_reference',
        'guest_spin_entitlement_id',
        'idempotency_key',
        'wheel_id',
        'wheel_version',
        'segment_id',
        'prize_label',
        'display_label',
        'description',
        'image_path',
        'winning_message',
        'instructions',
        'requires_claim',
        'claim_deadline_at',
        'claimed_at',
        'claimed_by',
        'tier',
        'claim_status',
    ];

    protected $appends = ['image_url', 'display_status', 'status_label'];

    protected function casts(): array
    {
        return [
            'requires_claim' => 'boolean',
            'is_guest' => 'boolean',
            'claim_deadline_at' => 'datetime',
            'claimed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $result) {
            if (! $result->reward_code) {
                $result->reward_code = self::generateCode();
            }
        });
    }

    public static function generateCode(): string
    {
        do {
            $code = 'RW-'.strtoupper(Str::random(10));
        } while (self::where('reward_code', $code)->exists());

        return $code;
    }

    public function usage(): BelongsTo
    {
        return $this->belongsTo(SpinUsage::class, 'spin_usage_id');
    }

    public function segment(): BelongsTo
    {
        return $this->belongsTo(WheelSegment::class, 'segment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function claimedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'claimed_by');
    }

    public function guestEntitlement(): BelongsTo
    {
        return $this->belongsTo(GuestSpinEntitlement::class, 'guest_spin_entitlement_id');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return '/storage/'.$this->image_path;
    }

    public function refreshClaimStatus(): void
    {
        if (in_array($this->claim_status, ['claimed', 'not_required'], true)) {
            return;
        }

        if (! $this->requires_claim) {
            if ($this->claim_status !== 'not_required') {
                $this->claim_status = 'not_required';
                $this->save();
            }

            return;
        }

        if ($this->claim_deadline_at && $this->claim_deadline_at->isPast() && $this->claim_status !== 'claimed') {
            $this->claim_status = 'expired';
            $this->save();
        }
    }

    public function getDisplayStatusAttribute(): string
    {
        if ($this->claim_status === 'claimed') {
            return 'claimed';
        }

        if (! $this->requires_claim || $this->claim_status === 'not_required') {
            return 'no_collection_required';
        }

        if ($this->claim_status === 'expired' || ($this->claim_deadline_at && $this->claim_deadline_at->isPast())) {
            return 'expired';
        }

        return 'ready_to_collect';
    }

    public function getStatusLabelAttribute(): string
    {
        return match ($this->display_status) {
            'ready_to_collect' => 'Ready to collect',
            'claimed' => 'Claimed',
            'expired' => 'Expired',
            'no_collection_required' => 'No collection required',
            default => $this->claim_status,
        };
    }

    public function canBeClaimedByStaff(): bool
    {
        $this->refreshClaimStatus();

        return $this->requires_claim
            && $this->claim_status === 'available'
            && (! $this->claim_deadline_at || $this->claim_deadline_at->isFuture());
    }
}
