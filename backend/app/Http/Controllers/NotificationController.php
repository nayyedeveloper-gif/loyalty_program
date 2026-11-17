<?php

namespace App\Http\Controllers;

use App\Models\AppNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate((int) $request->integer('per_page', 20));

        $unread = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unread,
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $unread = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json(['unread_count' => $unread]);
    }

    public function markRead(Request $request, int $notification): JsonResponse
    {
        $row = AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->where('id', $notification)
            ->firstOrFail();

        if (! $row->read_at) {
            $row->read_at = now();
            $row->save();
        }

        return response()->json(['notification' => $row]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AppNotification::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
