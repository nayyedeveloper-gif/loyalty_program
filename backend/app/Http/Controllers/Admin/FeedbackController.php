<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FeedbackMessage;
use App\Models\FeedbackReply;
use App\Services\NotificationService;
use App\Support\DateRangeQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FeedbackMessage::query()
            ->with([
                'user:id,customer_code,name,email,phone',
                'replies.user:id,name,role',
            ])
            ->withCount('replies')
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

        DateRangeQuery::apply($query, $request);

        $feedback = $query->paginate($this->perPage($request, 20, 200));

        return response()->json(['feedback' => $feedback]);
    }

    public function show(FeedbackMessage $feedback): JsonResponse
    {
        return response()->json([
            'feedback' => $feedback->load([
                'user:id,customer_code,name,email,phone',
                'replies.user:id,name,role',
            ]),
        ]);
    }

    public function update(Request $request, FeedbackMessage $feedback): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:new,read,in_progress,resolved'],
        ]);

        $previous = $feedback->status;
        $feedback->status = $data['status'];
        if ($data['status'] !== 'new' && ! $feedback->read_at) {
            $feedback->read_at = now();
        }
        if ($data['status'] === 'new') {
            $feedback->read_at = null;
        }
        $feedback->save();

        if ($previous !== $feedback->status && in_array($feedback->status, ['in_progress', 'resolved'], true)) {
            $customer = $feedback->user;
            if ($customer) {
                NotificationService::feedbackStatusChanged(
                    $customer,
                    (int) $feedback->id,
                    (string) $feedback->subject,
                    (string) $feedback->status,
                );
            }
        }

        return response()->json([
            'message' => 'Feedback updated.',
            'feedback' => $feedback->fresh()->load([
                'user:id,customer_code,name,email,phone',
                'replies.user:id,name,role',
            ]),
        ]);
    }

    public function reply(Request $request, FeedbackMessage $feedback): JsonResponse
    {
        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'status' => ['nullable', 'in:read,in_progress,resolved'],
        ]);

        $reply = FeedbackReply::create([
            'feedback_message_id' => $feedback->id,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
            'from_staff' => true,
        ]);

        $nextStatus = $data['status']
            ?? ($feedback->status === 'resolved' ? 'resolved' : 'in_progress');

        $feedback->status = $nextStatus;
        if (! $feedback->read_at) {
            $feedback->read_at = now();
        }
        $feedback->save();

        $customer = $feedback->user;
        if ($customer) {
            $preview = mb_strimwidth(preg_replace('/\s+/', ' ', $data['body']) ?? $data['body'], 0, 120, '…');
            NotificationService::feedbackReplied(
                $customer,
                (int) $feedback->id,
                (string) $feedback->subject,
                $preview,
            );
        }

        return response()->json([
            'message' => 'Reply sent.',
            'reply' => $reply->load('user:id,name,role'),
            'feedback' => $feedback->fresh()->load([
                'user:id,customer_code,name,email,phone',
                'replies.user:id,name,role',
            ]),
        ], 201);
    }
}
