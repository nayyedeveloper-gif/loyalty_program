<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Services\TierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user()->fresh();

        return response()->json([
            'membership' => [
                'customer_code' => $user->customer_code,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'tier' => $user->tier,
                'discount_percent' => $user->discount_percent,
                'points' => $user->points,
                'total_spent' => $user->total_spent,
                'next_tier' => $user->next_tier,
                'tiers' => TierService::TIERS,
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
}
