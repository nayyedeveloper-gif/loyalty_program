<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Purchase;
use App\Models\User;
use App\Services\TierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Purchase::with('user:id,customer_code,name,email,phone,tier')->latest();

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
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $purchase = DB::transaction(function () use ($data) {
            $customer = User::where('role', 'customer')->findOrFail($data['user_id']);
            $discount = $data['discount_percent'] ?? TierService::discountForTier($customer->tier);
            $net = (int) round($data['amount'] * (100 - $discount) / 100);
            $points = TierService::pointsFromAmount($net);

            $purchase = Purchase::create([
                'user_id' => $customer->id,
                'product_name' => $data['product_name'],
                'product_code' => $data['product_code'],
                'product_type' => $data['product_type'],
                'amount' => $data['amount'],
                'discount_percent' => $discount,
                'net_amount' => $net,
                'points_earned' => $points,
                'payment_method' => $data['payment_method'],
            ]);

            $customer->total_spent += $net;
            $customer->points += $points;
            $customer->tier = TierService::tierForSpend((int) $customer->total_spent);
            $customer->save();

            return $purchase->load('user:id,name,email,phone,tier,points,total_spent');
        });

        return response()->json([
            'message' => 'Purchase recorded.',
            'purchase' => $purchase,
        ], 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return response()->json([
            'purchase' => $purchase->load('user:id,name,email,phone,tier'),
        ]);
    }

    public function update(Request $request, Purchase $purchase): JsonResponse
    {
        $data = $this->validated($request, updating: true);

        $purchase = DB::transaction(function () use ($data, $purchase) {
            $oldCustomer = User::findOrFail($purchase->user_id);
            $oldCustomer->total_spent = max(0, $oldCustomer->total_spent - $purchase->net_amount);
            $oldCustomer->points = max(0, $oldCustomer->points - $purchase->points_earned);
            $oldCustomer->tier = TierService::tierForSpend((int) $oldCustomer->total_spent);
            $oldCustomer->save();

            $customer = User::where('role', 'customer')->findOrFail($data['user_id'] ?? $purchase->user_id);
            $amount = $data['amount'] ?? $purchase->amount;
            $discount = $data['discount_percent'] ?? TierService::discountForTier($customer->tier);
            $net = (int) round($amount * (100 - $discount) / 100);
            $points = TierService::pointsFromAmount($net);

            $purchase->update([
                'user_id' => $customer->id,
                'product_name' => $data['product_name'] ?? $purchase->product_name,
                'product_code' => $data['product_code'] ?? $purchase->product_code,
                'product_type' => $data['product_type'] ?? $purchase->product_type,
                'amount' => $amount,
                'discount_percent' => $discount,
                'net_amount' => $net,
                'points_earned' => $points,
                'payment_method' => $data['payment_method'] ?? $purchase->payment_method,
            ]);

            $customer->total_spent += $net;
            $customer->points += $points;
            $customer->tier = TierService::tierForSpend((int) $customer->total_spent);
            $customer->save();

            return $purchase->fresh()->load('user:id,name,email,phone,tier,points,total_spent');
        });

        return response()->json([
            'message' => 'Purchase updated.',
            'purchase' => $purchase,
        ]);
    }

    public function destroy(Purchase $purchase): JsonResponse
    {
        DB::transaction(function () use ($purchase) {
            $customer = User::find($purchase->user_id);

            if ($customer) {
                $customer->total_spent = max(0, $customer->total_spent - $purchase->net_amount);
                $customer->points = max(0, $customer->points - $purchase->points_earned);
                $customer->tier = TierService::tierForSpend((int) $customer->total_spent);
                $customer->save();
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
            'discount_percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'payment_method' => [$required, Rule::in(['Cash', 'Bank', 'KPay', 'WavePay', 'Visa/Master'])],
        ]);
    }
}
