<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Models\FeedbackMessage;
use App\Models\FeedbackReply;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $feedback = FeedbackMessage::query()
            ->where('user_id', $request->user()->id)
            ->with(['replies.user:id,name,role'])
            ->withCount('replies')
            ->latest()
            ->paginate($this->perPage($request, 20, 100));

        return response()->json(['feedback' => $feedback]);
    }

    public function show(Request $request, FeedbackMessage $feedback): JsonResponse
    {
        abort_unless((int) $feedback->user_id === (int) $request->user()->id, 404);

        return response()->json([
            'feedback' => $feedback->load(['replies.user:id,name,role']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:160'],
            'message' => ['required', 'string', 'max:5000'],
        ]);

        $feedback = FeedbackMessage::create([
            'user_id' => $request->user()->id,
            'subject' => $data['subject'],
            'message' => $data['message'],
            'status' => 'new',
        ]);

        return response()->json([
            'message' => 'Feedback submitted.',
            'feedback' => $feedback->load(['replies.user:id,name,role']),
        ], 201);
    }

    public function reply(Request $request, FeedbackMessage $feedback): JsonResponse
    {
        abort_unless((int) $feedback->user_id === (int) $request->user()->id, 404);

        $data = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $reply = FeedbackReply::create([
            'feedback_message_id' => $feedback->id,
            'user_id' => $request->user()->id,
            'body' => $data['body'],
            'from_staff' => false,
        ]);

        if ($feedback->status === 'resolved') {
            $feedback->status = 'in_progress';
            $feedback->save();
        }

        return response()->json([
            'message' => 'Reply sent.',
            'reply' => $reply->load('user:id,name,role'),
            'feedback' => $feedback->fresh()->load(['replies.user:id,name,role']),
        ], 201);
    }
}
