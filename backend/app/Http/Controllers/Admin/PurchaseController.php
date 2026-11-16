<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\User;
use App\Services\MissionService;
use App\Services\PointsEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Purchase::with('user:id,customer_code,name,email,phone,tier,redeemable_points')->latest();

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('product_name', 'like', "%{$search}%")
                    ->orWhere('product_code', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%")
                            ->orWhere('customer_code', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = min(200, max(1, (int) $request->input('per_page', 20)));

        return response()->json([
            'purchases' => $query->paginate($perPage),
            'loyalty' => PointsEngine::settings(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $purchase = DB::transaction(function () use ($data) {
            $customer = User::where('role', 'customer')->lockForUpdate()->findOrFail($data['user_id']);
            $amount = (int) $data['amount'];
            $redeemPoints = (int) ($data['points_to_redeem'] ?? 0);
            $redeem = PointsEngine::validateRedeemAmount($customer, $redeemPoints, $amount);
            $payable = $amount - $redeem['offset_mmk'];

            $earn = PointsEngine::computePurchaseEarn($customer, $payable, $data['product_type']);

            $purchase = Purchase::create([
                'user_id' => $customer->id,
                'product_name' => $data['product_name'],
                'product_code' => $data['product_code'],
                'product_type' => $data['product_type'],
                'amount' => $amount,
                'discount_percent' => 0,
                'net_amount' => $payable,
                'points_earned' => $earn['points'],
                'points_redeemed' => $redeem['points'],
                'amount_offset_mmk' => $redeem['offset_mmk'],
                'payment_method' => $data['payment_method'],
            ]);

            $customer->total_spent += $payable;
            $customer->save();

            PointsEngine::applyPurchasePoints(
                $customer,
                $purchase,
                $earn['points'],
                $redeem['points'],
                [
                    'base_points' => $earn['base_points'],
                    'tier_multiplier' => $earn['tier_multiplier'],
                    'promo_multiplier' => $earn['promo_multiplier'],
                    'payable' => $payable,
                ],
            );

            MissionService::recordPurchase($customer->fresh(), $payable);

            return $purchase->load('user:id,name,email,phone,tier,points,redeemable_points,tier_points_365d,total_spent');
        });

        return response()->json([
            'message' => 'Purchase recorded.',
            'purchase' => $purchase,
        ], 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return response()->json([
            'purchase' => $purchase->load('user:id,name,email,phone,tier,redeemable_points'),
        ]);
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $data = $this->validated($request, updating: true);

        $purchase = DB::transaction(function () use ($data, $purchase) {
            PointsEngine::reversePurchaseLedger($purchase);

            $oldCustomer = User::lockForUpdate()->findOrFail($purchase->user_id);
            $oldCustomer->total_spent = max(0, $oldCustomer->total_spent - $purchase->net_amount);
            $oldCustomer->save();
            PointsEngine::refreshUserBalances($oldCustomer, touchActivity: false);

            $customer = User::where('role', 'customer')->lockForUpdate()->findOrFail($data['user_id'] ?? $purchase->user_id);
            $amount = (int) ($data['amount'] ?? $purchase->amount);
            $productType = $data['product_type'] ?? $purchase->product_type;
            $redeemPoints = (int) ($data['points_to_redeem'] ?? 0);
            $redeem = PointsEngine::validateRedeemAmount($customer, $redeemPoints, $amount);
            $payable = $amount - $redeem['offset_mmk'];
            $earn = PointsEngine::computePurchaseEarn($customer, $payable, $productType);

            $purchase->update([
                'user_id' => $customer->id,
                'product_name' => $data['product_name'] ?? $purchase->product_name,
                'product_code' => $data['product_code'] ?? $purchase->product_code,
                'product_type' => $productType,
                'amount' => $amount,
                'discount_percent' => 0,
                'net_amount' => $payable,
                'points_earned' => $earn['points'],
                'points_redeemed' => $redeem['points'],
                'amount_offset_mmk' => $redeem['offset_mmk'],
                'payment_method' => $data['payment_method'] ?? $purchase->payment_method,
            ]);

            $customer->total_spent += $payable;
            $customer->save();

            PointsEngine::applyPurchasePoints(
                $customer,
                $purchase->fresh(),
                $earn['points'],
                $redeem['points'],
                [
                    'base_points' => $earn['base_points'],
                    'tier_multiplier' => $earn['tier_multiplier'],
                    'promo_multiplier' => $earn['promo_multiplier'],
                    'payable' => $payable,
                    'updated' => true,
                ],
            );

            MissionService::recordPurchase($customer->fresh(), $payable);

            return $purchase->fresh()->load('user:id,name,email,phone,tier,points,redeemable_points,tier_points_365d,total_spent');
        });

        return response()->json([
            'message' => 'Purchase updated.',
            'purchase' => $purchase,
        ]);
    }

    public function destroy(Purchase $purchase): JsonResponse
    {
        DB::transaction(function () use ($purchase) {
            PointsEngine::reversePurchaseLedger($purchase);

            $customer = User::find($purchase->user_id);
            if ($customer) {
                $customer->total_spent = max(0, $customer->total_spent - $purchase->net_amount);
                $customer->save();
                PointsEngine::refreshUserBalances($customer, touchActivity: false);
            }

            $purchase->delete();
        });

        return response()->json(['message' => 'Purchase deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        $required = $updating ? 'sometimes' : 'required';

        return $request->validate([
            'user_id' => [$required, 'integer', Rule::exists('users', 'id')->where('role', 'customer')],
            'product_name' => [$required, 'string', 'max:180'],
            'product_code' => [$required, 'string', 'max:80'],
            'product_type' => [$required, Rule::in(['Gold', 'Diamond', 'Jade', 'Ruby', 'Silver', 'Watch', 'Other'])],
            'amount' => [$required, 'integer', 'min:1000'],
            'points_to_redeem' => ['nullable', 'integer', 'min:0'],
            'payment_method' => [$required, Rule::in(['Cash', 'Bank', 'KPay', 'WavePay', 'Visa/Master'])],
        ]);
    }
}
