<?php

namespace App\Http\Controllers\Spinwheel;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\GuestSpinEntitlement;
use App\Models\SpinResult;
use App\Models\SpinUsage;
use App\Models\User;
use App\Services\SpinEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class GuestSpinController extends Controller
{
    public function __construct(private SpinEngine $spins) {}

    public function index(Request $request)
    {
        $this->releaseExpiredReservations();
        $this->expireDueLinks();

        $query = GuestSpinEntitlement::with(['creator:id,name', 'spinResult'])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('q')) {
            $q = trim($request->string('q')->toString());
            $query->where(function ($builder) use ($q) {
                $builder->where('reference', 'like', '%'.$q.'%')
                    ->orWhereHas('spinResult', fn ($r) => $r->where('reward_code', 'like', '%'.$q.'%')
                        ->orWhere('prize_label', 'like', '%'.$q.'%'));
            });
        }

        return $query->limit(100)->get()->map(fn (GuestSpinEntitlement $e) => $e->toAdminArray());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'valid_hours' => 'nullable|integer|min:1|max:8760',
            'actor_id' => 'nullable|exists:users,id',
        ]);

        $wheel = $this->spins->publishedWheel();
        if (! $wheel) {
            return response()->json(['message' => 'No published wheel available'], 422);
        }

        /** @var User $actor */
        $actor = $request->user();
        $hours = $data['valid_hours'] ?? (int) config('spinwheel.guest_link_hours', 72);
        $plainToken = GuestSpinEntitlement::generatePlainToken();

        $entitlement = GuestSpinEntitlement::create([
            'reference' => GuestSpinEntitlement::generateReference(),
            'token_hash' => GuestSpinEntitlement::hashToken($plainToken),
            'status' => GuestSpinEntitlement::STATUS_AVAILABLE,
            'wheel_id' => $wheel->id,
            'created_by' => $actor->id,
            'expires_at' => now()->addHours($hours),
        ]);

        AdminAuditLog::record(
            $actor->id,
            'guest_link.created',
            'guest_spin_entitlement',
            $entitlement->id,
            ['reference' => $entitlement->reference, 'valid_hours' => $hours]
        );

        $path = '/guest/'.$plainToken;
        $publicUrl = config('spinwheel.frontend_url').$path;

        return response()->json([
            'entitlement' => $entitlement->toAdminArray($publicUrl),
            'access_token' => $plainToken,
            'path' => $path,
            'url' => $publicUrl,
            'note' => 'Copy this link now. The raw access token is shown only once.',
        ], 201);
    }

    public function show(GuestSpinEntitlement $guest)
    {
        $guest->syncLifecycleStatus();
        $guest->load(['creator:id,name', 'spinResult.segment', 'revoker:id,name']);

        return [
            'entitlement' => $guest->toAdminArray(),
            'result' => $guest->spinResult,
        ];
    }

    public function revoke(Request $request, GuestSpinEntitlement $guest)
    {
        return DB::transaction(function () use ($request, $guest) {
            $locked = GuestSpinEntitlement::where('id', $guest->id)->lockForUpdate()->first();
            $locked->releaseAbandonedReservation();
            $locked->syncLifecycleStatus();
            $locked->refresh();

            if (! in_array($locked->status, [GuestSpinEntitlement::STATUS_AVAILABLE, GuestSpinEntitlement::STATUS_RESERVED], true)) {
                return response()->json(['message' => 'Only unused guest links can be revoked'], 422);
            }

            /** @var User $actor */
            $actor = $request->user();

            $locked->update([
                'status' => GuestSpinEntitlement::STATUS_REVOKED,
                'revoked_at' => now(),
                'revoked_by' => $actor->id,
                'guest_session_token_hash' => null,
                'reserved_until' => null,
            ]);

            AdminAuditLog::record(
                $actor->id,
                'guest_link.revoked',
                'guest_spin_entitlement',
                $locked->id,
                ['reference' => $locked->reference]
            );

            return $locked->fresh()->toAdminArray();
        });
    }

    public function activate(Request $request, string $token)
    {
        $rateKey = 'guest-activate:'.$request->ip();
        if (RateLimiter::tooManyAttempts($rateKey, 30)) {
            return response()->json(['message' => 'Too many attempts. Please try again shortly.'], 429);
        }
        RateLimiter::hit($rateKey, 60);

        $data = $request->validate([
            'guest_session_token' => 'nullable|string|min:16|max:128',
        ]);

        return DB::transaction(function () use ($token, $data) {
            $entitlement = GuestSpinEntitlement::where('token_hash', GuestSpinEntitlement::hashToken($token))
                ->lockForUpdate()
                ->first();

            if (! $entitlement) {
                return response()->json([
                    'status' => 'unavailable',
                    'message' => 'This guest spin link is unavailable.',
                ], 404);
            }

            $entitlement->releaseAbandonedReservation();
            $entitlement->syncLifecycleStatus();
            $entitlement->refresh();

            if ($entitlement->status === GuestSpinEntitlement::STATUS_REVOKED) {
                return response()->json([
                    'status' => 'revoked',
                    'message' => 'This guest spin link has been revoked.',
                ], 410);
            }

            if ($entitlement->status === GuestSpinEntitlement::STATUS_EXPIRED) {
                return response()->json([
                    'status' => 'expired',
                    'message' => 'This guest spin link has expired.',
                ], 410);
            }

            if ($entitlement->status === GuestSpinEntitlement::STATUS_USED) {
                $result = $entitlement->spinResult?->load('segment');
                $owns = ! empty($data['guest_session_token'])
                    && $entitlement->belongsToGuestSession($data['guest_session_token']);

                return response()->json([
                    'status' => 'used',
                    'message' => $owns
                        ? 'This spin has already been used. Here is your reward reference.'
                        : 'This guest spin link has already been used.',
                    'reference' => $entitlement->reference,
                    'result' => $owns ? $result : null,
                    'guest_session_token' => $owns ? $data['guest_session_token'] : null,
                    'spins_remaining' => 0,
                ], $owns ? 200 : 410);
            }

            $sessionToken = $data['guest_session_token'] ?? null;

            if ($entitlement->status === GuestSpinEntitlement::STATUS_RESERVED) {
                if ($sessionToken && $entitlement->belongsToGuestSession($sessionToken)) {
                    return $this->guestStateResponse($entitlement, $sessionToken, 'restored');
                }

                return response()->json([
                    'status' => 'reserved',
                    'message' => 'This guest spin link is already active in another session.',
                ], 409);
            }

            // available — always mint a fresh session so prior guest links cannot collide
            $sessionToken = Str::random(64);
            $minutes = (int) config('spinwheel.guest_reservation_minutes', 120);

            $entitlement->update([
                'status' => GuestSpinEntitlement::STATUS_RESERVED,
                'activated_at' => $entitlement->activated_at ?: now(),
                'reserved_at' => now(),
                'reserved_until' => now()->addMinutes($minutes),
                'guest_session_token_hash' => GuestSpinEntitlement::hashToken($sessionToken),
            ]);

            return $this->guestStateResponse($entitlement->fresh(), $sessionToken, 'activated');
        });
    }

    public function state(Request $request)
    {
        $data = $request->validate([
            'guest_session_token' => 'required|string|min:16|max:128',
        ]);

        $entitlement = GuestSpinEntitlement::where('guest_session_token_hash', GuestSpinEntitlement::hashToken($data['guest_session_token']))
            ->latest('id')
            ->first();

        if (! $entitlement) {
            return response()->json(['message' => 'Guest session not found'], 404);
        }

        $entitlement->releaseAbandonedReservation();
        $entitlement->syncLifecycleStatus();
        $entitlement->refresh();

        if (! $entitlement->belongsToGuestSession($data['guest_session_token'])) {
            return response()->json(['message' => 'Guest session not found'], 404);
        }

        if ($entitlement->status === GuestSpinEntitlement::STATUS_USED) {
            return [
                'status' => 'used',
                'reference' => $entitlement->reference,
                'spins_remaining' => 0,
                'result' => $entitlement->spinResult?->load('segment'),
                'wheel' => $this->spins->publishedWheel($entitlement->wheel_id),
                'guest_session_token' => $data['guest_session_token'],
            ];
        }

        if ($entitlement->status !== GuestSpinEntitlement::STATUS_RESERVED) {
            return response()->json([
                'status' => $entitlement->status,
                'message' => 'This guest session is no longer active.',
            ], 410);
        }

        // Extend reservation on active use
        $minutes = (int) config('spinwheel.guest_reservation_minutes', 120);
        $entitlement->update(['reserved_until' => now()->addMinutes($minutes)]);

        return $this->guestStateResponse($entitlement, $data['guest_session_token'], 'active');
    }

    public function spin(Request $request)
    {
        $data = $request->validate([
            'guest_session_token' => 'required|string|min:16|max:128',
            'idempotency_key' => 'required|string|min:8|max:64',
        ]);

        $rateKey = 'guest-spin:'.GuestSpinEntitlement::hashToken($data['guest_session_token']);
        if (RateLimiter::tooManyAttempts($rateKey, 10)) {
            return response()->json(['message' => 'Too many attempts. Please try again shortly.'], 429);
        }
        RateLimiter::hit($rateKey, 60);

        return DB::transaction(function () use ($data) {
            $entitlement = GuestSpinEntitlement::where('guest_session_token_hash', GuestSpinEntitlement::hashToken($data['guest_session_token']))
                ->lockForUpdate()
                ->first();

            if (! $entitlement || ! $entitlement->belongsToGuestSession($data['guest_session_token'])) {
                return response()->json(['message' => 'Guest session not found'], 404);
            }

            $entitlement->syncLifecycleStatus();
            $entitlement->refresh();

            if ($entitlement->status === GuestSpinEntitlement::STATUS_USED) {
                if ($entitlement->spinResult && $entitlement->spinResult->idempotency_key === $data['idempotency_key']) {
                    return $this->spins->spinPayload($entitlement->spinResult->load('segment'), 0, true, 0)
                        + ['reference' => $entitlement->reference, 'guest_session_token' => $data['guest_session_token']];
                }

                $existing = SpinResult::with('segment')
                    ->where('guest_spin_entitlement_id', $entitlement->id)
                    ->where('idempotency_key', $data['idempotency_key'])
                    ->first();

                if ($existing) {
                    return $this->spins->spinPayload($existing, 0, true, 0)
                        + ['reference' => $entitlement->reference, 'guest_session_token' => $data['guest_session_token']];
                }

                return response()->json(['message' => 'This guest spin has already been used'], 422);
            }

            if ($entitlement->status !== GuestSpinEntitlement::STATUS_RESERVED) {
                return response()->json(['message' => 'This guest spin is not available'], 422);
            }

            if ($entitlement->reservationExpired()) {
                $entitlement->releaseAbandonedReservation();

                return response()->json(['message' => 'Guest reservation expired. Re-open your link.'], 410);
            }

            $existing = SpinResult::with('segment')
                ->where('guest_spin_entitlement_id', $entitlement->id)
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();

            if ($existing) {
                return $this->spins->spinPayload($existing, 0, true, 0)
                    + ['reference' => $entitlement->reference, 'guest_session_token' => $data['guest_session_token']];
            }

            $guestUser = $this->guestPoolUser();
            $wheel = $this->spins->publishedWheel($entitlement->wheel_id);
            if (! $wheel || $wheel->segments->isEmpty()) {
                return response()->json(['message' => 'No active wheel'], 422);
            }

            $segment = $this->spins->pickWeighted($wheel->segments);
            if (! $segment) {
                return response()->json(['message' => 'Invalid prize weights'], 422);
            }

            $usage = SpinUsage::create([
                'user_id' => $guestUser->id,
                'wheel_id' => $wheel->id,
                'source' => 'guest_link',
                'granted_at' => $entitlement->created_at ?: now(),
                'expires_at' => $entitlement->expires_at ?: now()->addHour(),
                'status' => 'used',
                'used_at' => now(),
            ]);

            $result = $this->spins->createResult(
                usage: $usage,
                user: $guestUser,
                wheel: $wheel,
                segment: $segment,
                idempotencyKey: $data['idempotency_key'],
                isGuest: true,
                guestMeta: [
                    'guest_reference' => $entitlement->reference,
                    'guest_spin_entitlement_id' => $entitlement->id,
                ],
            );

            $entitlement->update([
                'status' => GuestSpinEntitlement::STATUS_USED,
                'used_at' => now(),
                'spin_usage_id' => $usage->id,
                'spin_result_id' => $result->id,
                'reserved_until' => null,
            ]);

            return $this->spins->spinPayload($result, 0, false, 0)
                + [
                    'reference' => $entitlement->reference,
                    'guest_session_token' => $data['guest_session_token'],
                    'wheel' => $wheel,
                ];
        });
    }

    private function guestStateResponse(GuestSpinEntitlement $entitlement, string $sessionToken, string $activation): array
    {
        $wheel = $this->spins->publishedWheel($entitlement->wheel_id);

        return [
            'status' => $entitlement->status,
            'activation' => $activation,
            'reference' => $entitlement->reference,
            'spins_remaining' => $entitlement->status === GuestSpinEntitlement::STATUS_RESERVED ? 1 : 0,
            'expires_at' => $entitlement->expires_at,
            'reserved_until' => $entitlement->reserved_until,
            'wheel' => $wheel,
            'guest_session_token' => $sessionToken,
            'result' => null,
        ];
    }

    private function guestPoolUser(): User
    {
        return User::firstOrCreate(
            ['email' => config('spinwheel.guest_pool_email')],
            [
                'name' => 'Guest Spin Pool',
                'phone' => '09000000000',
                'role' => 'customer',
                'tier' => 'Bronze',
                'password' => bcrypt(Str::random(32)),
            ]
        );
    }

    private function releaseExpiredReservations(): void
    {
        GuestSpinEntitlement::where('status', GuestSpinEntitlement::STATUS_RESERVED)
            ->whereNotNull('reserved_until')
            ->where('reserved_until', '<=', now())
            ->update([
                'status' => GuestSpinEntitlement::STATUS_AVAILABLE,
                'activated_at' => null,
                'reserved_at' => null,
                'reserved_until' => null,
                'guest_session_token_hash' => null,
            ]);
    }

    private function expireDueLinks(): void
    {
        GuestSpinEntitlement::whereIn('status', [
            GuestSpinEntitlement::STATUS_AVAILABLE,
            GuestSpinEntitlement::STATUS_RESERVED,
        ])
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => GuestSpinEntitlement::STATUS_EXPIRED]);
    }
}