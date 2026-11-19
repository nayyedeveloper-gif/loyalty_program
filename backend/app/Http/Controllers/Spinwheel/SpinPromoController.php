<?php

namespace App\Http\Controllers\Spinwheel;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\SpinPromo;
use App\Models\SpinPromoResponse;
use App\Models\User;
use App\Services\SpinGrantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SpinPromoController extends Controller
{
    public function __construct(private SpinGrantService $grants) {}

    public function index()
    {
        return SpinPromo::query()
            ->withCount([
                'responses as claimed_count' => fn ($q) => $q->where('action', 'claimed'),
                'responses as dismissed_count' => fn ($q) => $q->where('action', 'dismissed'),
            ])
            ->latest('id')
            ->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request, true);
        $data['created_by'] = $request->user()?->id;
        $data['is_active'] = array_key_exists('is_active', $data)
            ? filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN)
            : true;

        $promo = SpinPromo::create($data);

        AdminAuditLog::record(
            $request->user()?->id,
            'promo.created',
            'spin_promo',
            $promo->id,
            ['title' => $promo->title, 'spin_count' => $promo->spin_count]
        );

        return response()->json($promo->fresh(), 201);
    }

    public function update(Request $request, SpinPromo $promo)
    {
        $data = $this->validated($request, false);

        if (array_key_exists('is_active', $data)) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        $promo->fill($data)->save();

        AdminAuditLog::record(
            $request->user()?->id,
            'promo.updated',
            'spin_promo',
            $promo->id,
            ['fields' => array_keys($data)]
        );

        return $promo->fresh();
    }

    public function destroy(Request $request, SpinPromo $promo)
    {
        $id = $promo->id;
        $promo->delete();

        AdminAuditLog::record(
            $request->user()?->id,
            'promo.deleted',
            'spin_promo',
            $id
        );

        return response()->json(['ok' => true]);
    }

    public function pending(Request $request)
    {
        /** @var User $user */
        $user = $request->user();
        $promo = SpinPromo::pendingForUser($user->id);

        return [
            'promo' => $promo ? $this->customerPromoPayload($promo) : null,
            'has_pending' => (bool) $promo,
        ];
    }

    public function claim(Request $request, SpinPromo $promo)
    {
        /** @var User $user */
        $user = $request->user();

        return $this->respond($request, $promo, $user, 'claimed');
    }

    public function dismiss(Request $request, SpinPromo $promo)
    {
        /** @var User $user */
        $user = $request->user();

        return $this->respond($request, $promo, $user, 'dismissed');
    }

    private function respond(Request $request, SpinPromo $promo, User $user, string $action)
    {
        if (! $promo->isRunnable()) {
            throw ValidationException::withMessages([
                'promo' => ['This promotion is no longer available.'],
            ]);
        }

        $existing = SpinPromoResponse::where('spin_promo_id', $promo->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You already responded to this promotion.',
                'action' => $existing->action,
                'granted' => 0,
                'has_pending' => (bool) SpinPromo::pendingForUser($user->id),
            ], 422);
        }

        $granted = 0;

        DB::transaction(function () use ($promo, $user, $action, $request, &$granted) {
            SpinPromoResponse::create([
                'spin_promo_id' => $promo->id,
                'user_id' => $user->id,
                'action' => $action,
            ]);

            if ($action === 'claimed') {
                $created = $this->grants->grant(
                    user: $user,
                    count: (int) $promo->spin_count,
                    source: 'promo',
                    actorId: $request->user()?->id,
                    validHours: (int) $promo->valid_hours,
                );

                if ($created->isEmpty()) {
                    throw ValidationException::withMessages([
                        'promo' => ['Unable to grant spins for this promotion.'],
                    ]);
                }

                $granted = $created->count();
            }

            AdminAuditLog::record(
                $request->user()?->id,
                $action === 'claimed' ? 'promo.claimed' : 'promo.dismissed',
                'spin_promo',
                $promo->id,
                ['user_id' => $user->id, 'granted' => $granted]
            );
        });

        return [
            'ok' => true,
            'action' => $action,
            'granted' => $granted,
            'has_pending' => (bool) SpinPromo::pendingForUser($user->id),
            'promo' => $this->customerPromoPayload($promo),
        ];
    }

    private function customerPromoPayload(SpinPromo $promo): array
    {
        return [
            'id' => $promo->id,
            'title' => $promo->title,
            'message' => $promo->message,
            'spin_count' => $promo->spin_count,
            'valid_hours' => $promo->valid_hours,
            'ends_at' => $promo->ends_at,
        ];
    }

    private function validated(Request $request, bool $creating): array
    {
        return $request->validate([
            'title' => ($creating ? 'required' : 'sometimes').'|string|max:160',
            'message' => ($creating ? 'required' : 'sometimes').'|string|max:2000',
            'spin_count' => ($creating ? 'required' : 'sometimes').'|integer|min:1|max:50',
            'valid_hours' => ($creating ? 'required' : 'sometimes').'|integer|min:1|max:8760',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'is_active' => 'sometimes',
        ]);
    }
}
