<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PointLedger;
use App\Models\User;
use App\Services\AuditService;
use App\Services\PointsEngine;
use App\Support\DateRangeQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LedgerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PointLedger::query()
            ->with('user:id,customer_code,name,email,phone,tier,redeemable_points')
            ->latest();

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->integer('user_id'));
        }

        if ($request->filled('type')) {
            $query->where('type', (string) $request->string('type'));
        }

        if ($request->filled('source')) {
            $query->where('source', (string) $request->string('source'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        DateRangeQuery::apply($query, $request);

        $ledger = $query->paginate((int) $request->integer('per_page', 20));

        return response()->json(['ledger' => $ledger]);
    }

    public function adjust(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'points' => ['required', 'integer', 'not_in:0'],
            'reason' => ['required', 'string', 'max:255'],
            'tier_eligible' => ['sometimes', 'boolean'],
        ]);

        $customer = User::query()
            ->where('id', $data['user_id'])
            ->where('role', 'customer')
            ->firstOrFail();

        $entry = DB::transaction(function () use ($request, $data, $customer) {
            $locked = User::where('id', $customer->id)->lockForUpdate()->firstOrFail();

            return PointsEngine::adjustPoints(
                user: $locked,
                points: (int) $data['points'],
                reason: $data['reason'],
                tierEligible: (bool) ($data['tier_eligible'] ?? false),
                adminId: $request->user()?->id,
            );
        });

        AuditService::log(
            $request->user(),
            'points_adjusted',
            "Points adjusted for {$customer->name}: {$data['points']}",
            $customer,
            ['points' => $data['points'], 'reason' => $data['reason']],
            $request,
        );

        return response()->json([
            'message' => 'Points adjusted.',
            'entry' => $entry->load('user:id,customer_code,name,email,phone,tier,redeemable_points'),
            'user' => $customer->fresh(),
        ]);
    }
}
