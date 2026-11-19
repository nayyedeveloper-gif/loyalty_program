<?php

namespace App\Http\Controllers\Spinwheel;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\SpinPromo;
use App\Models\SpinResult;
use App\Models\SpinUsage;
use App\Models\SpinwheelSetting;
use App\Models\User;
use App\Services\SpinEngine;
use App\Services\SpinGrantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SpinController extends Controller
{
    public function __construct(
        private SpinEngine $spins,
        private SpinGrantService $grants,
    ) {}

    public function customerState(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $this->spins->expireStaleUsages($user->id);
        $this->spins->expireRewardsForUser($user->id);

        $wheel = $this->spins->publishedWheel();

        $usages = SpinUsage::where('user_id', $user->id)
            ->where('status', 'available')
            ->where('expires_at', '>', now())
            ->orderBy('expires_at')
            ->get();

        $rewards = SpinResult::with(['segment', 'user'])
            ->where('user_id', $user->id)
            ->where('is_guest', false)
            ->latest()
            ->limit(100)
            ->get()
            ->each(fn (SpinResult $r) => $r->refreshClaimStatus());

        $pendingPromo = SpinPromo::pendingForUser($user->id);

        return [
            'user' => $user->only(['id', 'name', 'email', 'customer_code', 'role']),
            'wheel' => $wheel,
            'spins_remaining' => $usages->count(),
            'usages' => $usages,
            'next_expiry' => $usages->first()?->expires_at,
            'expiry_groups' => $usages
                ->groupBy(fn ($u) => optional($u->expires_at)->toDateString())
                ->map(fn ($group, $date) => [
                    'expires_on' => $date,
                    'count' => $group->count(),
                    'expires_at' => $group->first()->expires_at,
                ])
                ->values(),
            'history' => $rewards->take(10)->values(),
            'rewards' => $rewards->values(),
            'pending_promo' => $pendingPromo ? [
                'id' => $pendingPromo->id,
                'title' => $pendingPromo->title,
                'message' => $pendingPromo->message,
                'spin_count' => $pendingPromo->spin_count,
                'valid_hours' => $pendingPromo->valid_hours,
                'ends_at' => $pendingPromo->ends_at,
            ] : null,
            'has_pending_promo' => (bool) $pendingPromo,
        ];
    }

    public function rewards(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $this->spins->expireRewardsForUser($user->id);

        return SpinResult::with('segment')
            ->where('user_id', $user->id)
            ->where('is_guest', false)
            ->latest()
            ->get()
            ->each(fn (SpinResult $r) => $r->refreshClaimStatus())
            ->values();
    }

    public function showReward(Request $request, SpinResult $result)
    {
        /** @var User $user */
        $user = $request->user();

        if ($result->user_id !== $user->id || $result->is_guest) {
            return response()->json(['message' => 'Reward not found'], 404);
        }

        $result->refreshClaimStatus();

        return $result->load('segment');
    }

    public function spinByKey(Request $request, string $key)
    {
        /** @var User $user */
        $user = $request->user();

        $result = SpinResult::with('segment')
            ->where('user_id', $user->id)
            ->where('idempotency_key', $key)
            ->first();

        if (! $result) {
            return response()->json(['message' => 'No recorded spin for this key'], 404);
        }

        $result->refreshClaimStatus();

        return $this->spins->spinPayload($result, $user->id, true);
    }

    public function spin(Request $request)
    {
        $data = $request->validate([
            'idempotency_key' => 'required|string|min:8|max:64',
        ]);

        /** @var User $user */
        $user = $request->user();

        return $this->spins->spinForCustomer($user, $data['idempotency_key']);
    }

    public function grant(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'wheel_id' => 'nullable|exists:wheels,id',
            'count' => 'required|integer|min:1|max:50',
            'valid_hours' => 'required|integer|min:1|max:8760',
            'source' => 'nullable|string|max:40',
        ]);

        $target = User::findOrFail($data['user_id']);
        if ($target->role !== 'customer') {
            return response()->json(['message' => 'Spins can only be granted to registered customers'], 422);
        }

        $created = $this->grants->grant(
            user: $target,
            count: (int) $data['count'],
            source: $data['source'] ?? 'manual',
            wheelId: $data['wheel_id'] ?? null,
            actorId: $request->user()?->id,
            validHours: (int) $data['valid_hours'],
        );

        if ($created->isEmpty()) {
            return response()->json(['message' => 'No wheel to attach spins to'], 422);
        }

        return response()->json(['granted' => $created->count(), 'usages' => $created->values()], 201);
    }

    public function usageIndex(Request $request)
    {
        $query = SpinUsage::with(['user:id,name,email,customer_code', 'result'])->latest();

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        return $query->limit(100)->get();
    }

    public function adjust(Request $request, SpinUsage $usage)
    {
        $data = $request->validate([
            'status' => 'required|in:available,revoked,expired',
            'expires_at' => 'nullable|date',
        ]);

        if ($usage->status === 'used') {
            return response()->json(['message' => 'Used spins cannot be adjusted'], 422);
        }

        if (isset($data['expires_at'])) {
            $usage->expires_at = $data['expires_at'];
        }
        $usage->status = $data['status'];
        $usage->save();

        AdminAuditLog::record(
            $request->user()?->id,
            'usage.adjusted',
            'spin_usage',
            $usage->id,
            ['status' => $usage->status, 'expires_at' => optional($usage->expires_at)->toIso8601String()]
        );

        return $usage;
    }

    public function searchRewards(Request $request)
    {
        $this->spins->expireAllDueRewards();

        $data = $request->validate([
            'q' => 'nullable|string|max:120',
            'user_id' => 'nullable|exists:users,id',
            'audience' => 'nullable|in:all,customer,guest',
            'status' => 'nullable|in:ready_to_collect,claimed,expired,no_collection_required,available',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        $query = SpinResult::with(['user:id,name,email,customer_code,phone', 'segment'])->latest();

        if (($data['audience'] ?? 'all') === 'guest') {
            $query->where('is_guest', true);
        } elseif (($data['audience'] ?? 'all') === 'customer') {
            $query->where('is_guest', false);
        }

        if (! empty($data['user_id'])) {
            $query->where('user_id', $data['user_id']);
        }

        if (! empty($data['from'])) {
            $query->whereDate('created_at', '>=', $data['from']);
        }

        if (! empty($data['to'])) {
            $query->whereDate('created_at', '<=', $data['to']);
        }

        if (! empty($data['q'])) {
            $q = trim($data['q']);
            $query->where(function ($builder) use ($q) {
                $builder->where('reward_code', 'like', '%'.$q.'%')
                    ->orWhere('prize_label', 'like', '%'.$q.'%')
                    ->orWhere('guest_reference', 'like', '%'.$q.'%')
                    ->orWhereHas('user', function ($userQuery) use ($q) {
                        $userQuery->where('name', 'like', '%'.$q.'%')
                            ->orWhere('email', 'like', '%'.$q.'%')
                            ->orWhere('customer_code', 'like', '%'.$q.'%')
                            ->orWhere('phone', 'like', '%'.$q.'%')
                            ->orWhere('id', $q);
                    });
            });
        }

        $results = $query->limit(50)->get()->each(fn (SpinResult $r) => $r->refreshClaimStatus());

        if (! empty($data['status'])) {
            $wanted = $data['status'] === 'available' ? 'ready_to_collect' : $data['status'];
            $results = $results->filter(fn (SpinResult $r) => $r->display_status === $wanted)->values();
        }

        return $results->values();
    }

    public function showAdminReward(SpinResult $result)
    {
        $result->refreshClaimStatus();

        return $result->load(['user:id,name,email,customer_code,phone', 'segment', 'claimedByUser:id,name']);
    }

    public function staffClaim(Request $request, SpinResult $result)
    {
        $data = $request->validate([
            'override_expired' => 'sometimes|boolean',
        ]);

        $actor = $request->user();

        return DB::transaction(function () use ($result, $data, $actor) {
            $locked = SpinResult::where('id', $result->id)->lockForUpdate()->first();
            $locked->refreshClaimStatus();

            if (! $locked->requires_claim || $locked->claim_status === 'not_required') {
                return response()->json(['message' => 'This reward does not require collection'], 422);
            }

            if ($locked->claim_status === 'claimed') {
                return response()->json(['message' => 'Reward already claimed'], 422);
            }

            $isExpired = $locked->claim_status === 'expired'
                || ($locked->claim_deadline_at && $locked->claim_deadline_at->isPast());

            if ($isExpired && ! ($data['override_expired'] ?? false)) {
                $locked->claim_status = 'expired';
                $locked->save();

                return response()->json(['message' => 'Cannot claim an expired reward without authorized override'], 422);
            }

            $locked->update([
                'claim_status' => 'claimed',
                'claimed_at' => now(),
                'claimed_by' => $actor?->id,
            ]);

            AdminAuditLog::record(
                $actor?->id,
                ($data['override_expired'] ?? false) ? 'reward.claimed_override' : 'reward.claimed',
                'spin_result',
                $locked->id,
                [
                    'reward_code' => $locked->reward_code,
                    'is_guest' => $locked->is_guest,
                    'guest_reference' => $locked->guest_reference,
                    'override_expired' => (bool) ($data['override_expired'] ?? false),
                ]
            );

            return $locked->fresh()->load(['user:id,name,email,customer_code,phone', 'segment', 'claimedByUser:id,name']);
        });
    }

    public function settings()
    {
        return SpinwheelSetting::allKeyed();
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'grant_on_registration' => 'sometimes|integer|min:0|max:50',
            'registration_grant_message' => 'sometimes|string|max:500',
            'default_valid_hours' => 'sometimes|integer|min:1|max:8760',
        ]);

        foreach ($data as $key => $value) {
            SpinwheelSetting::setValue($key, $value);
        }

        AdminAuditLog::record(
            $request->user()?->id,
            'spinwheel.settings_updated',
            'spinwheel_settings',
            null,
            $data
        );

        return SpinwheelSetting::allKeyed();
    }
}
