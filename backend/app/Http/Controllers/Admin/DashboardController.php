<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FeedbackMessage;
use App\Models\PointLedger;
use App\Models\Purchase;
use App\Models\RewardItem;
use App\Models\RewardRedemption;
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

        $newFeedback = FeedbackMessage::query()->where('status', 'new')->count();
        $pendingRedemptions = RewardRedemption::query()->where('status', 'pending')->count();
        $lowStockRewards = RewardItem::query()
            ->where('is_active', true)
            ->whereNotNull('stock')
            ->where('stock', '<=', 5)
            ->orderBy('stock')
            ->limit(8)
            ->get(['id', 'name', 'stock', 'points_cost']);

        return response()->json([
            'stats' => [
                'customers' => $customers->count(),
                'purchases' => Purchase::count(),
                'revenue' => (int) Purchase::sum('net_amount'),
                'points_issued' => (int) PointLedger::where('points', '>', 0)->sum('points'),
                'redeemable_points' => (int) User::where('role', 'customer')->sum('redeemable_points'),
            ],
            'alerts' => [
                'new_feedback' => $newFeedback,
                'pending_redemptions' => $pendingRedemptions,
                'low_stock_rewards' => $lowStockRewards,
            ],
            'tier_distribution' => $distribution,
            'recent_purchases' => $recentPurchases,
        ]);
    }
}
