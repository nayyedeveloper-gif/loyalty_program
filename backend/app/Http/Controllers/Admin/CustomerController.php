<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\PointsEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'customer')->latest();

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        if ($tier = $request->string('tier')->toString()) {
            $query->where('tier', $tier);
        }

        $perPage = min(200, max(1, (int) $request->input('per_page', 20)));

        return response()->json([
            'customers' => $query->paginate($perPage),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'address' => ['nullable', 'string', 'max:255'],
            'password' => ['required', Password::min(8)],
        ]);

        $customer = User::create([
            ...$data,
            'role' => 'customer',
            'tier' => 'Bronze',
        ]);
        PointsEngine::ensureReferralCode($customer);

        return response()->json([
            'message' => 'Customer created.',
            'customer' => $customer->fresh(),
        ], 201);
    }

    public function show(User $customer): JsonResponse
    {
        abort_unless($customer->isCustomer(), 404);

        $customer->load(['purchases' => fn ($q) => $q->latest()]);

        return response()->json(['customer' => $customer]);
    }

    public function update(Request $request, User $customer): JsonResponse
    {
        abort_unless($customer->isCustomer(), 404);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($customer->id)],
            'phone' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('users', 'phone')->ignore($customer->id)],
            'address' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', Password::min(8)],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        $customer->update($data);
        PointsEngine::refreshUserBalances($customer->fresh(), touchActivity: false);

        return response()->json([
            'message' => 'Customer updated.',
            'customer' => $customer->fresh(),
        ]);
    }

    public function destroy(User $customer): JsonResponse
    {
        abort_unless($customer->isCustomer(), 404);

        $customer->tokens()->delete();
        $customer->delete();

        return response()->json(['message' => 'Customer deleted.']);
    }
}
