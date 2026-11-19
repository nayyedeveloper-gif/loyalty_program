<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class GuestSpinEntitlement extends Model
{
    public const STATUS_AVAILABLE = 'available';

    public const STATUS_RESERVED = 'reserved';

    public const STATUS_USED = 'used';

    public const STATUS_EXPIRED = 'expired';

    public const STATUS_REVOKED = 'revoked';

    protected $fillable = [
        'reference',
        'token_hash',
        'status',
        'wheel_id',
        'created_by',
        'expires_at',
        'activated_at',
        'reserved_at',
        'reserved_until',
        'guest_session_token_hash',
        'used_at',
        'spin_usage_id',
        'spin_result_id',
        'revoked_at',
        'revoked_by',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'activated_at' => 'datetime',
            'reserved_at' => 'datetime',
            'reserved_until' => 'datetime',
            'used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function wheel(): BelongsTo
    {
        return $this->belongsTo(Wheel::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function revoker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    public function spinUsage(): BelongsTo
    {
        return $this->belongsTo(SpinUsage::class, 'spin_usage_id');
    }

    public function spinResult(): BelongsTo
    {
        return $this->belongsTo(SpinResult::class, 'spin_result_id');
    }

    public static function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    public static function generateReference(): string
    {
        do {
            $reference = 'GS-'.strtoupper(Str::random(10));
        } while (self::where('reference', $reference)->exists());

        return $reference;
    }

    public static function generatePlainToken(): string
    {
        return Str::random(48);
    }

    public function syncLifecycleStatus(): void
    {
        if (in_array($this->status, [self::STATUS_USED, self::STATUS_REVOKED], true)) {
            return;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            $this->status = self::STATUS_EXPIRED;
            $this->save();
        }
    }

    public function reservationExpired(): bool
    {
        return $this->status === self::STATUS_RESERVED
            && $this->reserved_until
            && $this->reserved_until->isPast();
    }

    public function releaseAbandonedReservation(): void
    {
        if (! $this->reservationExpired()) {
            return;
        }

        $this->forceFill([
            'status' => self::STATUS_AVAILABLE,
            'activated_at' => null,
            'reserved_at' => null,
            'reserved_until' => null,
            'guest_session_token_hash' => null,
        ])->save();
    }

    public function belongsToGuestSession(string $plainSessionToken): bool
    {
        if (! $this->guest_session_token_hash) {
            return false;
        }

        return hash_equals($this->guest_session_token_hash, self::hashToken($plainSessionToken));
    }

    /**
     * @return array<string, mixed>
     */
    public function toAdminArray(?string $publicUrl = null): array
    {
        $this->loadMissing(['creator:id,name', 'spinResult']);

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'created_at' => $this->created_at,
            'created_by' => $this->creator?->only(['id', 'name']),
            'expires_at' => $this->expires_at,
            'activated_at' => $this->activated_at,
            'reserved_until' => $this->reserved_until,
            'used_at' => $this->used_at,
            'revoked_at' => $this->revoked_at,
            'reward_code' => $this->spinResult?->reward_code,
            'prize_label' => $this->spinResult?->prize_label,
            'public_url' => $publicUrl,
        ];
    }
}
