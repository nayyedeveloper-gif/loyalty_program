<?php

namespace App\Models;

use App\Models\LoyaltySetting;
use App\Services\PointsEngine;
use App\Services\TierService;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'customer_code',
        'referral_code',
        'referred_by',
        'name',
        'email',
        'phone',
        'address',
        'avatar',
        'preferences',
        'role',
        'tier',
        'points',
        'redeemable_points',
        'tier_points_365d',
        'total_spent',
        'last_activity_at',
        'login_streak',
        'last_login_streak_date',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $appends = [
        'discount_percent',
        'next_tier',
        'avatar_url',
        'earn_multiplier',
        'points_expire_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if ($user->role === 'customer' && blank($user->customer_code)) {
                $user->customer_code = static::nextCustomerCode();
            }
            if ($user->role === 'customer' && blank($user->tier)) {
                $user->tier = 'Bronze';
            }
        });

        static::created(function (User $user) {
            if ($user->role === 'customer') {
                PointsEngine::ensureReferralCode($user);
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'points' => 'integer',
            'redeemable_points' => 'integer',
            'tier_points_365d' => 'integer',
            'total_spent' => 'integer',
            'preferences' => 'array',
            'last_activity_at' => 'datetime',
            'login_streak' => 'integer',
            'last_login_streak_date' => 'date',
        ];
    }

    public function getAvatarUrlAttribute(): ?string
    {
        if (! $this->avatar) {
            return null;
        }

        return '/storage/'.$this->avatar;
    }

    public static function nextCustomerCode(): string
    {
        $latest = static::query()
            ->where('role', 'customer')
            ->whereNotNull('customer_code')
            ->where('customer_code', 'like', 'C%')
            ->orderByDesc('id')
            ->value('customer_code');

        $next = 1;
        if (is_string($latest) && preg_match('/^C(\d+)$/', $latest, $matches)) {
            $next = ((int) $matches[1]) + 1;
        }

        return 'C'.str_pad((string) $next, 6, '0', STR_PAD_LEFT);
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(Purchase::class);
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(PointLedger::class);
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referred_by');
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    public function getDiscountPercentAttribute(): int
    {
        return 0;
    }

    public function getEarnMultiplierAttribute(): float
    {
        return TierService::multiplierForTier($this->tier ?? 'Bronze');
    }

    public function getNextTierAttribute(): ?array
    {
        return TierService::nextTier($this);
    }

    public function getPointsExpireAtAttribute(): ?string
    {
        if (! $this->last_activity_at) {
            return null;
        }
        $days = LoyaltySetting::getInt('inactivity_days', 365);

        return $this->last_activity_at->copy()->addDays($days)->toIso8601String();
    }
}
