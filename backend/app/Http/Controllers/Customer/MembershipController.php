<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\LoyaltySetting;
use App\Models\Mission;
use App\Models\PointLedger;
use App\Models\ProductReview;
use App\Models\RewardItem;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Models\UserMissionProgress;
use App\Services\PointsEngine;
use App\Services\TierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MembershipController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user()->fresh();
        PointsEngine::ensureReferralCode($user);
        PointsEngine::refreshUserBalances($user, touchActivity: false);
        $user = $user->fresh();

        return response()->json([
            'membership' => [
                'customer_code' => $user->customer_code,
                'referral_code' => $user->referral_code,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'tier' => $user->tier,
                'earn_multiplier' => $user->earn_multiplier,
                'discount_percent' => 0,
                'points' => $user->redeemable_points,
                'redeemable_points' => $user->redeemable_points,
                'tier_points_365d' => $user->tier_points_365d,
                'total_spent' => $user->total_spent,
                'next_tier' => $user->next_tier,
                'last_activity_at' => optional($user->last_activity_at)?->toIso8601String(),
                'points_expire_at' => $user->points_expire_at,
                'login_streak' => $user->login_streak,
                'tiers' => TierService::tiersMap(),
                'settings' => PointsEngine::settings(),
            ],
        ]);
    }

    public function purchases(Request $request): JsonResponse
    {
        $purchases = $request->user()
            ->purchases()
            ->latest()
            ->paginate(12);

        return response()->json(['purchases' => $purchases]);
    }

    public function ledger(Request $request): JsonResponse
    {
        $entries = PointLedger::where('user_id', $request->user()->id)
            ->where('type', 'redeem')
            ->latest()
            ->paginate(20);

        return response()->json(['ledger' => $entries]);
    }

    public function profile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'phone' => ['sometimes', 'required', 'string', 'max:30', 'unique:users,phone,'.$request->user()->id],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $request->user()->update($data);

        return response()->json([
            'message' => 'Profile updated.',
            'user' => $request->user()->fresh(),
        ]);
    }

    public function rewards(Request $request): JsonResponse
    {
        $items = RewardItem::query()->where('is_active', true)->orderBy('points_cost')->get();

        return response()->json(['rewards' => $items]);
    }

    public function redeemReward(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reward_item_id' => ['required', 'integer', 'exists:reward_items,id'],
        ]);

        $redemption = DB::transaction(function () use ($request, $data) {
            $user = User::where('id', $request->user()->id)->lockForUpdate()->firstOrFail();
            $item = RewardItem::where('id', $data['reward_item_id'])->lockForUpdate()->firstOrFail();

            if (! $item->is_active) {
                throw ValidationException::withMessages(['reward_item_id' => ['Reward is not available.']]);
            }
            if ($item->stock !== null && $item->stock <= 0) {
                throw ValidationException::withMessages(['reward_item_id' => ['Reward is out of stock.']]);
            }

            $ledger = PointsEngine::redeemCatalog($user, (int) $item->points_cost, 'catalog', [
                'reward_item_id' => $item->id,
                'reward_name' => $item->name,
            ]);

            if ($item->stock !== null) {
                $item->stock -= 1;
                $item->save();
            }

            return RewardRedemption::create([
                'user_id' => $user->id,
                'reward_item_id' => $item->id,
                'ledger_id' => $ledger->id,
                'points_spent' => $item->points_cost,
                'status' => 'fulfilled',
            ])->load('rewardItem');
        });

        return response()->json([
            'message' => 'Reward redeemed.',
            'redemption' => $redemption,
            'user' => $request->user()->fresh(),
        ]);
    }

    public function missions(Request $request): JsonResponse
    {
        $missions = Mission::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->get()
            ->map(function (Mission $mission) use ($request) {
                $progress = UserMissionProgress::where('user_id', $request->user()->id)
                    ->where('mission_id', $mission->id)
                    ->first();

                return [
                    'id' => $mission->id,
                    'code' => $mission->code,
                    'title' => $mission->title,
                    'description' => $mission->description,
                    'goal_type' => $mission->goal_type,
                    'goal_target' => $mission->goal_target,
                    'bonus_points' => $mission->bonus_points,
                    'starts_at' => optional($mission->starts_at)?->toIso8601String(),
                    'ends_at' => optional($mission->ends_at)?->toIso8601String(),
                    'progress' => $progress?->progress ?? 0,
                    'completed' => (bool) ($progress?->completed ?? false),
                ];
            });

        return response()->json(['missions' => $missions]);
    }

    public function reviews(Request $request): JsonResponse
    {
        $reviews = ProductReview::where('user_id', $request->user()->id)->latest()->get();

        return response()->json(['reviews' => $reviews]);
    }

    public function storeReview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product_code' => ['required', 'string', 'max:80'],
            'product_name' => ['nullable', 'string', 'max:180'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'body' => ['nullable', 'string', 'max:2000'],
        ]);

        $review = DB::transaction(function () use ($request, $data) {
            $existing = ProductReview::where('user_id', $request->user()->id)
                ->where('product_code', $data['product_code'])
                ->first();

            if ($existing) {
                throw ValidationException::withMessages([
                    'product_code' => ['You already reviewed this product.'],
                ]);
            }

            $review = ProductReview::create([
                'user_id' => $request->user()->id,
                'product_code' => $data['product_code'],
                'product_name' => $data['product_name'] ?? null,
                'rating' => $data['rating'],
                'body' => $data['body'] ?? null,
                'points_awarded' => false,
            ]);

            $bonus = LoyaltySetting::getInt('review_bonus_points', 20);
            if ($bonus > 0) {
                PointsEngine::creditBonus(
                    $request->user(),
                    $bonus,
                    'review',
                    ['product_code' => $data['product_code'], 'review_id' => $review->id],
                    tierEligible: true,
                );
                $review->points_awarded = true;
                $review->save();
            }

            return $review;
        });

        return response()->json([
            'message' => 'Review submitted.',
            'review' => $review,
            'user' => $request->user()->fresh(),
        ], 201);
    }
}
