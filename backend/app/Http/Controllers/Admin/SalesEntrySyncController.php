<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditService;
use App\Services\SalesEntry\SalesEntrySyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesEntrySyncController extends Controller
{
    public function sync(Request $request, SalesEntrySyncService $sync): JsonResponse
    {
        $data = $request->validate([
            'fresh' => ['sometimes', 'boolean'],
            'award_points' => ['sometimes', 'boolean'],
            'sales_only' => ['sometimes', 'boolean'],
            'max_pages' => ['sometimes', 'integer', 'min:0', 'max:50'],
        ]);

        if (! config('salesentry.api_key')) {
            return response()->json([
                'message' => 'Sales Entry API key is not configured.',
            ], 422);
        }

        $wiped = null;
        if (! empty($data['fresh'])) {
            $wiped = $sync->wipeLocalCustomerData();
        }

        // UI sync stays bounded so the request does not time out; use artisan for full history.
        $stats = $sync->sync(
            salesOnly: array_key_exists('sales_only', $data) ? (bool) $data['sales_only'] : true,
            awardPoints: array_key_exists('award_points', $data) ? (bool) $data['award_points'] : true,
            maxPages: (int) ($data['max_pages'] ?? 5),
        );

        AuditService::log(
            $request->user(),
            'salesentry_sync',
            'Synced purchases/customers from Sales Entry',
            null,
            ['stats' => $stats, 'wiped' => $wiped],
            $request,
        );

        return response()->json([
            'message' => 'Sales Entry sync finished.',
            'wiped' => $wiped,
            'stats' => $stats,
        ]);
    }
}
