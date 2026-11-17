<?php

namespace App\Services;

use App\Models\SpinResult;
use App\Models\SpinUsage;
use App\Models\User;
use App\Models\Wheel;
use App\Models\WheelSegment;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class SpinEngine
{
    public function publishedWheel(?int $preferredWheelId = null): ?Wheel
    {
        if ($preferredWheelId) {
            $wheel = Wheel::with(['segments' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
                ->where('id', $preferredWheelId)
                ->where('status', 'published')
                ->first();

            if ($wheel) {
                return $wheel;
            }
        }

        return Wheel::with(['segments' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
            ->where('status', 'published')
            ->latest('id')
            ->first();
    }

    public function pickWeighted(Collection $segments): ?WheelSegment
    {
        $total = $segments->sum('weight');
        if ($total <= 0) {
            return null;
        }

        $roll = random_int(1, $total);
        $running = 0;
        foreach ($segments as $segment) {
            $running += $segment->weight;
            if ($roll <= $running) {
                return $segment;
            }
        }

        return $segments->last();
    }

    public function expireStaleUsages(int $userId): void
    {
        SpinUsage::where('user_id', $userId)
            ->where('status', 'available')
            ->where('expires_at', '<=', now())
            ->update(['status' => 'expired']);
    }

    public function expireRewardsForUser(int $userId): void
    {
        SpinResult::where('user_id', $userId)
            ->where('requires_claim', true)
            ->where('claim_status', 'available')
            ->whereNotNull('claim_deadline_at')
            ->where('claim_deadline_at', '<=', now())
            ->update(['claim_status' => 'expired']);
    }

    public function expireAllDueRewards(): void
    {
        SpinResult::where('requires_claim', true)
            ->where('claim_status', 'available')
            ->whereNotNull('claim_deadline_at')
            ->where('claim_deadline_at', '<=', now())
            ->update(['claim_status' => 'expired']);
    }

    /**
     * @return array{result: SpinResult, segment_index: int, spins_remaining: int, recovered: bool}|JsonResponse
     */
    public function spinForCustomer(User $user, string $idempotencyKey)
    {
        $this->expireStaleUsages($user->id);

        $existing = SpinResult::with('segment')
            ->where('user_id', $user->id)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($existing) {
            return $this->spinPayload($existing, $user->id, true);
        }

        return DB::transaction(function () use ($user, $idempotencyKey) {
            $usage = SpinUsage::where('user_id', $user->id)
                ->where('status', 'available')
                ->where('expires_at', '>', now())
                ->orderBy('expires_at')
                ->lockForUpdate()
                ->first();

            if (! $usage) {
                return response()->json(['message' => 'No valid spins available'], 422);
            }

            $wheel = $this->publishedWheel($usage->wheel_id);
            if (! $wheel || $wheel->segments->isEmpty()) {
                return response()->json(['message' => 'No active wheel'], 422);
            }

            $eligible = $wheel->segments->filter(fn (WheelSegment $s) => $s->hasAvailableStock())->values();
            $segment = $this->pickWeighted($eligible);
            if (! $segment) {
                return response()->json(['message' => 'Invalid prize weights'], 422);
            }

            $lockedSegment = WheelSegment::query()->whereKey($segment->id)->lockForUpdate()->first();
            if (! $lockedSegment || ! $lockedSegment->is_active || ! $lockedSegment->hasAvailableStock()) {
                return response()->json(['message' => 'Selected prize is no longer available. Please try again.'], 422);
            }

            if (! $lockedSegment->consumeStock()) {
                return response()->json(['message' => 'Selected prize is out of stock. Please try again.'], 422);
            }

            if ($lockedSegment->is_out_of_stock) {
                $wheel->bumpContentRevision();
            }

            $usage->update([
                'status' => 'used',
                'used_at' => now(),
            ]);

            $result = $this->createResult(
                usage: $usage,
                user: $user,
                wheel: $wheel,
                segment: $lockedSegment->fresh(),
                idempotencyKey: $idempotencyKey,
                isGuest: false,
            );

            return $this->spinPayload($result, $user->id, false);
        });
    }

    /**
     * @param  array{guest_reference?: string|null, guest_spin_entitlement_id?: int|null, idempotency_key?: string|null}  $guestMeta
     */
    public function createResult(
        SpinUsage $usage,
        User $user,
        Wheel $wheel,
        WheelSegment $segment,
        ?string $idempotencyKey,
        bool $isGuest = false,
        array $guestMeta = [],
    ): SpinResult {
        $message = str_replace(
            ['[Prize]', '{prize}', '{name}'],
            [$segment->prize_label, $segment->prize_label, $user->name],
            $segment->winning_message
        );

        $requiresClaim = (bool) $segment->requires_claim;
        $claimStatus = $requiresClaim ? 'available' : 'not_required';
        $deadline = null;
        if ($requiresClaim && $segment->claim_days) {
            $deadline = now()->addDays((int) $segment->claim_days);
        }

        return SpinResult::create([
            'spin_usage_id' => $usage->id,
            'user_id' => $user->id,
            'is_guest' => $isGuest,
            'guest_reference' => $guestMeta['guest_reference'] ?? null,
            'guest_spin_entitlement_id' => $guestMeta['guest_spin_entitlement_id'] ?? null,
            'idempotency_key' => $idempotencyKey,
            'wheel_id' => $wheel->id,
            'wheel_version' => $wheel->version,
            'segment_id' => $segment->id,
            'prize_label' => $segment->prize_label,
            'display_label' => $segment->display_label,
            'description' => $segment->description,
            'image_path' => $segment->image_path,
            'winning_message' => $message,
            'instructions' => $segment->instructions,
            'requires_claim' => $requiresClaim,
            'claim_deadline_at' => $deadline,
            'tier' => $segment->tier ?: 'minor',
            'claim_status' => $claimStatus,
        ])->load('segment');
    }

    /**
     * @return array{result: SpinResult, segment_index: int, spins_remaining: int, recovered: bool}
     */
    public function spinPayload(SpinResult $result, int $userId, bool $recovered, ?int $remainingOverride = null): array
    {
        $wheel = Wheel::with(['segments' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
            ->find($result->wheel_id);

        $segmentIndex = 0;
        if ($wheel) {
            $found = $wheel->segments->values()->search(fn ($s) => $s->id === $result->segment_id);
            $segmentIndex = $found === false ? 0 : (int) $found;
        }

        $remaining = $remainingOverride;
        if ($remaining === null) {
            $remaining = SpinUsage::where('user_id', $userId)
                ->where('status', 'available')
                ->where('expires_at', '>', now())
                ->count();
        }

        return [
            'result' => $result->loadMissing('segment'),
            'segment_index' => $segmentIndex,
            'spins_remaining' => $remaining,
            'recovered' => $recovered,
        ];
    }
}
