<?php

namespace App\Services;

use App\Models\AdminAuditLog;
use App\Models\SpinUsage;
use App\Models\SpinwheelSetting;
use App\Models\User;
use App\Models\Wheel;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class SpinGrantService
{
    /**
     * @return Collection<int, SpinUsage>
     */
    public function grant(
        User $user,
        int $count,
        string $source = 'manual',
        ?int $wheelId = null,
        ?CarbonInterface $expiresAt = null,
        ?int $actorId = null,
        ?int $validHours = null,
    ): Collection {
        if ($count < 1) {
            return collect();
        }

        if ($user->email === config('spinwheel.guest_pool_email')) {
            return collect();
        }

        if ($user->role !== 'customer') {
            return collect();
        }

        $resolvedWheelId = $wheelId
            ?? Wheel::where('status', 'published')->latest('id')->value('id');

        if (! $resolvedWheelId) {
            return collect();
        }

        $hours = $validHours
            ?? SpinwheelSetting::getInt('default_valid_hours', (int) config('spinwheel.default_spin_valid_hours', 168));

        $expiry = $expiresAt ?: now()->addHours(max(1, $hours));

        $created = collect();
        for ($i = 0; $i < $count; $i++) {
            $created->push(SpinUsage::create([
                'user_id' => $user->id,
                'wheel_id' => $resolvedWheelId,
                'source' => $source,
                'granted_at' => now(),
                'expires_at' => $expiry,
                'status' => 'available',
            ]));
        }

        AdminAuditLog::record(
            $actorId,
            'spins.granted',
            'user',
            $user->id,
            [
                'count' => $count,
                'source' => $source,
                'wheel_id' => $resolvedWheelId,
                'expires_at' => $expiry instanceof Carbon ? $expiry->toIso8601String() : (string) $expiry,
            ]
        );

        return $created;
    }

    public function grantOnRegistration(User $user): Collection
    {
        $count = SpinwheelSetting::getInt('grant_on_registration', 0);

        return $this->grant($user, $count, 'registration');
    }

    public function grantOnLoginPromo(User $user): Collection
    {
        if (! SpinwheelSetting::getBool('login_promo_active', false)) {
            return collect();
        }

        $count = SpinwheelSetting::getInt('grant_on_login_promo', 0);
        if ($count < 1) {
            return collect();
        }

        $already = SpinUsage::where('user_id', $user->id)
            ->where('source', 'login_promo')
            ->whereDate('granted_at', now()->toDateString())
            ->exists();

        if ($already) {
            return collect();
        }

        return $this->grant($user, $count, 'login_promo');
    }
}
