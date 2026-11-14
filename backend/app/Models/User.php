<?php

namespace App\Models;

use App\Services\TierService;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
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
        'name',
        'email',
        'phone',
        'address',
        'avatar',
        'preferences',
        'role',
        'tier',
        'points',
        'total_spent',
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
    ];

    protected static function booted(): void
    {
        static::creating(function (User $user) {
            if ($user->role === 'customer' && blank($user->customer_code)) {
                $user->customer_code = static::nextCustomerCode();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'points' => 'integer',
            'total_spent' => 'integer',
            'preferences' => 'array',
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
        return TierService::discountForTier($this->tier ?? 'Silver');
    }

    public function getNextTierAttribute(): ?array
    {
        return TierService::nextTier($this);
    }
}
