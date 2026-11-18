<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PointLedger;
use App\Models\RewardItem;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Services\AuditService;
use App\Services\PointsEngine;
use App\Support\DateRangeQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RedemptionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = RewardRedemption::query()
            ->with([
                'user:id,customer_code,name,email,phone',
                'rewardItem:id,name,category,fulfillment,points_cost',
            ])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('redemption_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('customer_code', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    })
                    ->orWhereHas('rewardItem', function ($itemQuery) use ($search) {
                        $itemQuery->where('name', 'like', "%{$search}%");
                    });
            });
        }

        DateRangeQuery::apply($query, $request);

        return response()->json([
            'redemptions' => $query->paginate($this->perPage($request, 20, 200)),
        ]);
    }

    public function update(Request $request, RewardRedemption $redemption): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:pending,collected,cancelled'],
        ]);

        $redemption = DB::transaction(function () use ($request, $redemption, $data) {
            $redemption = RewardRedemption::where('id', $redemption->id)->lockForUpdate()->firstOrFail();
            $redemption->load('rewardItem');
            $previous = $redemption->status;
            $next = $data['status'];

            if ($previous === $next) {
                return $redemption;
            }

            // Instant digital rewards stay collected — staff reopen is for in-store pickups only.
            if ($next === 'pending' && $redemption->rewardItem?->isInstant()) {
                throw ValidationException::withMessages([
                    'status' => ['Instant rewards cannot be reopened for pickup.'],
                ]);
            }

            if ($next === 'cancelled' && $previous === 'pending') {
                $user = User::where('id', $redemption->user_id)->lockForUpdate()->firstOrFail();
                if ($redemption->ledger_id) {
                    $ledger = PointLedger::find($redemption->ledger_id);
                    if ($ledger) {
                        PointsEngine::refundCatalogRedemption($user, $ledger, [
                            'redemption_id' => $redemption->id,
                            'reason' => 'staff_cancelled',
                        ]);
                    }
                }
                $item = RewardItem::where('id', $redemption->reward_item_id)->lockForUpdate()->first();
                if ($item && $item->stock !== null) {
                    $item->stock += 1;
                    $item->save();
                }
            }

            $redemption->status = $next;
            if ($next === 'collected' && ! $redemption->collected_at) {
                $redemption->collected_at = now();
            }
            if ($next !== 'collected') {
                $redemption->collected_at = null;
            }
            $redemption->save();

            return $redemption;
        });

        AuditService::log(
            $request->user(),
            'redemption_updated',
            "Redemption {$redemption->redemption_code} marked {$data['status']}",
            $redemption,
            ['status' => $data['status']],
            $request,
        );

        return response()->json([
            'message' => 'Redemption updated.',
            'redemption' => $redemption->fresh()->load([
                'user:id,customer_code,name,email,phone',
                'rewardItem:id,name,category,fulfillment,points_cost',
            ]),
        ]);
    }
}
