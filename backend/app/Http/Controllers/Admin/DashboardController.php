<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\User;
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

        return response()->json([
            'stats' => [
                'customers' => $customers->count(),
                'purchases' => Purchase::count(),
                'revenue' => (int) Purchase::sum('net_amount'),
                'points_issued' => (int) Purchase::sum('points_earned'),
            ],
            'tier_distribution' => [
                'Silver' => (int) ($tierDistribution['Silver'] ?? 0),
                'Gold' => (int) ($tierDistribution['Gold'] ?? 0),
                'Platinum' => (int) ($tierDistribution['Platinum'] ?? 0),
                'Diamond' => (int) ($tierDistribution['Diamond'] ?? 0),
            ],
            'recent_purchases' => $recentPurchases,
        ]);
    }
}
