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

    /**
     * @return array{count: int, message: string, source: string, title: string}|null
     */
    public function grantOnRegistration(User $user): ?array
    {
        $count = SpinwheelSetting::getInt('grant_on_registration', 0);
        $created = $this->grant($user, $count, 'registration');
        if ($created->isEmpty()) {
            return null;
        }

        $template = SpinwheelSetting::getValue(
            'registration_grant_message',
            'Welcome! You received {count} free spin(s). Open Spinwheel to try your luck.'
        );

        return [
            'count' => $created->count(),
            'message' => str_replace(
                ['{count}', '{spins}', '[count]'],
                [(string) $created->count(), (string) $created->count(), (string) $created->count()],
                (string) $template
            ),
            'source' => 'registration',
            'title' => 'Welcome spins',
        ];
    }

    /** Login promo grants removed — kept as no-op for callers. */
    public function grantOnLoginPromo(User $user): ?array
    {
        return null;
    }

    /**
     * Notice for members who still have fresh registration spins (shown on login / first visit).
     *
     * @return array{count: int, message: string, source: string, title: string}|null
     */
    public function pendingRegistrationNotice(User $user): ?array
    {
        $count = SpinUsage::where('user_id', $user->id)
            ->where('source', 'registration')
            ->where('status', 'available')
            ->where('expires_at', '>', now())
            ->where('granted_at', '>=', now()->subDay())
            ->count();

        if ($count < 1) {
            return null;
        }

        $template = SpinwheelSetting::getValue(
            'registration_grant_message',
            'Welcome! You received {count} free spin(s). Open Spinwheel to try your luck.'
        );

        return [
            'count' => $count,
            'message' => str_replace(
                ['{count}', '{spins}', '[count]'],
                [(string) $count, (string) $count, (string) $count],
                (string) $template
            ),
            'source' => 'registration',
            'title' => 'Welcome spins',
        ];
    }
}
