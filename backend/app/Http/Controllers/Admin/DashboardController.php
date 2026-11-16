<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PointLedger;
use App\Models\Purchase;
use App\Models\User;
use App\Services\TierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $customers = User::where('role', 'customer');

        $tierDistribution = (clone $customers)
            ->select('tier', DB::raw('count(*) as total'))
            ->groupBy('tier')
            ->pluck('total', 'tier');

        $recentPurchases = Purchase::with('user:id,customer_code,name,email,phone')
            ->latest()
            ->limit(8)
            ->get();

        $distribution = [];
        foreach (array_keys(TierService::tiersMap()) as $tierName) {
            $distribution[$tierName] = (int) ($tierDistribution[$tierName] ?? 0);
        }

        return response()->json([
            'stats' => [
                'customers' => $customers->count(),
                'purchases' => Purchase::count(),
                'revenue' => (int) Purchase::sum('net_amount'),
                'points_issued' => (int) PointLedger::where('points', '>', 0)->sum('points'),
                'redeemable_points' => (int) User::where('role', 'customer')->sum('redeemable_points'),
            ],
            'tier_distribution' => $distribution,
            'recent_purchases' => $recentPurchases,
        ]);
    }
}
