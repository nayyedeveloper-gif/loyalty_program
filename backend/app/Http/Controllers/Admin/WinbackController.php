<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LoyaltySetting;
use App\Models\PointLedger;
use App\Models\User;
use App\Services\AuditService;
use App\Services\NotificationService;
use App\Services\PointsEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WinbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $inactiveDays = max(30, (int) $request->integer('inactive_days', LoyaltySetting::getInt('winback_inactive_days', 180)));
        $cutoff = now()->subDays($inactiveDays);

        $query = User::query()
            ->where('role', 'customer')
            ->where(function ($q) use ($cutoff) {
                $q->whereNull('last_activity_at')
                    ->orWhere('last_activity_at', '<=', $cutoff);
            })
            ->orderBy('last_activity_at');

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        $customers = $query->paginate((int) $request->integer('per_page', 20));

        $customers->getCollection()->transform(function (User $user) {
            $recentWinback = PointLedger::query()
                ->where('user_id', $user->id)
                ->where('source', 'winback')
                ->where('type', 'bonus')
                ->where('created_at', '>=', now()->subDays(90))
                ->exists();

            $user->setAttribute('recent_winback', $recentWinback);
            $user->setAttribute(
                'inactive_days',
                $user->last_activity_at
                    ? $user->last_activity_at->diffInDays(now())
                    : null,
            );

            return $user;
        });

        return response()->json([
            'inactive_days' => $inactiveDays,
            'default_bonus' => LoyaltySetting::getInt('winback_bonus_points', 50),
            'customers' => $customers,
        ]);
    }

    public function grant(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'points' => ['required', 'integer', 'min:1', 'max:5000'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $customer = User::where('role', 'customer')->findOrFail($data['user_id']);

        $recent = PointLedger::query()
            ->where('user_id', $customer->id)
            ->where('source', 'winback')
            ->where('type', 'bonus')
            ->where('created_at', '>=', now()->subDays(90))
            ->exists();

        if ($recent) {
            throw ValidationException::withMessages([
                'user_id' => ['This member already received a win-back bonus in the last 90 days.'],
            ]);
        }

        $entry = PointsEngine::creditBonus(
            $customer,
            (int) $data['points'],
            'winback',
            [
                'note' => $data['note'] ?? 'Win-back campaign',
                'admin_id' => $request->user()->id,
            ],
            tierEligible: false,
        );

        NotificationService::pointsEarned(
            $customer->fresh(),
            (int) $data['points'],
            'winback',
        );

        AuditService::log(
            $request->user(),
            'winback_granted',
            "Win-back bonus {$data['points']} pts to {$customer->name}",
            $customer,
            ['points' => $data['points'], 'ledger_id' => $entry->id],
            $request,
        );

        return response()->json([
            'message' => 'Win-back bonus granted.',
            'customer' => $customer->fresh(),
            'ledger' => $entry,
        ]);
    }
}
