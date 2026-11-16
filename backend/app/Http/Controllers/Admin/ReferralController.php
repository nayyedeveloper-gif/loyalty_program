<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PointLedger;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->string('search'));

        $query = User::query()
            ->where('role', 'customer')
            ->whereHas('referrals')
            ->withCount('referrals')
            ->with(['referrals' => function ($q) {
                $q->select('id', 'name', 'email', 'phone', 'customer_code', 'tier', 'referred_by', 'created_at')
                    ->latest()
                    ->limit(8);
            }])
            ->orderByDesc('referrals_count');

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
                    ->orWhere('referral_code', 'like', "%{$search}%");
            });
        }

        $referrers = $query->paginate((int) $request->integer('per_page', 20));

        $bonusPaid = (int) PointLedger::query()
            ->where('source', 'referral')
            ->where('type', 'bonus')
            ->where('points', '>', 0)
            ->sum('points');

        $totalReferred = (int) User::query()
            ->where('role', 'customer')
            ->whereNotNull('referred_by')
            ->count();

        $top = User::query()
            ->where('role', 'customer')
            ->whereHas('referrals')
            ->withCount('referrals')
            ->orderByDesc('referrals_count')
            ->limit(5)
            ->get(['id', 'name', 'customer_code', 'referral_code', 'tier']);

        return response()->json([
            'stats' => [
                'total_referred' => $totalReferred,
                'active_referrers' => (int) User::query()
                    ->where('role', 'customer')
                    ->whereHas('referrals')
                    ->count(),
                'bonus_points_paid' => $bonusPaid,
            ],
            'top_referrers' => $top,
            'referrers' => $referrers,
        ]);
    }
}
