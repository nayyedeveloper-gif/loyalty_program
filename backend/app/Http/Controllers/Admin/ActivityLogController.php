<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Support\DateRangeQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AdminActivityLog::query()
            ->with('actor:id,name,email,role')
            ->latest();

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('action', 'like', "%{$search}%")
                    ->orWhereHas('actor', function ($actor) use ($search) {
                        $actor->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('action')) {
            $query->where('action', (string) $request->string('action'));
        }

        DateRangeQuery::apply($query, $request);

        return response()->json([
            'logs' => $query->paginate((int) $request->integer('per_page', 30)),
        ]);
    }
}
