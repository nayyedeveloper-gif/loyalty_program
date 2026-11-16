<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FeedbackMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FeedbackMessage::query()
            ->with('user:id,customer_code,name,email,phone')
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', (string) $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%")
                            ->orWhere('customer_code', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        $feedback = $query->paginate((int) $request->integer('per_page', 20));

        return response()->json(['feedback' => $feedback]);
    }

    public function update(Request $request, FeedbackMessage $feedback): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:new,read,resolved'],
        ]);

        $feedback->status = $data['status'];
        if ($data['status'] !== 'new' && ! $feedback->read_at) {
            $feedback->read_at = now();
        }
        if ($data['status'] === 'new') {
            $feedback->read_at = null;
        }
        $feedback->save();

        return response()->json([
            'message' => 'Feedback updated.',
            'feedback' => $feedback->fresh()->load('user:id,customer_code,name,email,phone'),
        ]);
    }
}
