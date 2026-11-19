<?php

namespace App\Http\Controllers;

use App\Events\ChatMessageDeleted;
use App\Events\ChatMessageReceipt;
use App\Events\ChatMessageSent;
use App\Events\ChatMessageUpdated;
use App\Events\ChatUserTyping;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\GifSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ChatController extends Controller
{
    public function gifs(Request $request, GifSearchService $gifs): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:8', 'max:48'],
        ]);

        $query = trim((string) ($data['q'] ?? ''));
        $limit = (int) ($data['limit'] ?? 24);
        $customerId = (string) $request->user()->id;
        $results = $gifs->search($query, $limit, $customerId);

        return response()->json([
            'provider' => $gifs->provider(),
            'configured' => $gifs->isConfigured(),
            'gifs' => $results,
            'message' => $results === [] && ! $gifs->isConfigured()
                ? 'GIF search is unavailable right now.'
                : null,
        ]);
    }

    public function gifCategories(Request $request, GifSearchService $gifs): JsonResponse
    {
        if (! $gifs->isConfigured()) {
            return response()->json([
                'provider' => 'none',
                'configured' => false,
                'categories' => [],
            ]);
        }

        return response()->json([
            'provider' => $gifs->provider(),
            'configured' => true,
            'categories' => $gifs->categories((string) $request->user()->id),
        ]);
    }

    public function stickers(Request $request, GifSearchService $gifs): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:8', 'max:48'],
        ]);

        $query = trim((string) ($data['q'] ?? ''));
        $limit = (int) ($data['limit'] ?? 24);
        $customerId = (string) $request->user()->id;
        $results = $gifs->searchStickers($query, $limit, $customerId);

        return response()->json([
            'provider' => $gifs->provider(),
            'configured' => $gifs->isConfigured(),
            'stickers' => $results,
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isCustomer()) {
            $conversation = ChatConversation::query()->where('customer_id', $user->id)->first();

            return response()->json([
                'unread_count' => $conversation ? $conversation->unreadFor($user) : 0,
            ]);
        }

        $count = 0;
        ChatConversation::query()
            ->select(['id', 'customer_id', 'staff_last_read_at'])
            ->where('status', 'open')
            ->orderBy('id')
            ->chunkById(200, function ($rows) use ($user, &$count) {
                foreach ($rows as $conversation) {
                    $count += $conversation->unreadFor($user);
                }
            });

        return response()->json(['unread_count' => (int) $count]);
    }

    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isCustomer()) {
            $conversation = $this->customerConversation($user, create: false);
            $items = $conversation ? [$this->serializeConversation($conversation, $user)] : [];

            return response()->json(['conversations' => $items]);
        }

        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
        ]);
        $search = trim((string) ($data['search'] ?? ''));

        $query = ChatConversation::query()
            ->with([
                'customer:id,name,email,phone,customer_code,avatar,role',
                'latestMessage.sender:id,name,role,avatar',
            ]);

        // Default inbox is open chats only. Searching also finds closed/archived DMs.
        if ($search === '') {
            $query->where('status', 'open');
        } else {
            $query->whereHas('customer', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        $rows = $query
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (ChatConversation $c) => $this->serializeConversation($c, $user))
            ->values();

        return response()->json(['conversations' => $rows]);
    }

    public function open(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isCustomer()) {
            throw ValidationException::withMessages(['conversation' => ['Only customers can open a support chat.']]);
        }

        $conversation = $this->customerConversation($user, create: true);

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->load(['latestMessage.sender:id,name,role,avatar', 'customer:id,name,email,phone,customer_code,avatar,role']),
                $user,
            ),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->isCustomer() || ! $user->isPortalUser()) {
            throw ValidationException::withMessages(['conversation' => ['Only staff can start a customer chat.']]);
        }

        $data = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $customer = User::query()->findOrFail((int) $data['customer_id']);
        if (! $customer->isCustomer()) {
            throw ValidationException::withMessages(['customer_id' => ['Select a customer account.']]);
        }

        $conversation = $this->customerConversation($customer, create: true);
        if (! $conversation->assigned_staff_id) {
            $conversation->update(['assigned_staff_id' => $user->id, 'status' => 'open']);
        } elseif ($conversation->status !== 'open') {
            $conversation->update(['status' => 'open']);
        }

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->fresh([
                    'latestMessage.sender:id,name,role,avatar',
                    'customer:id,name,email,phone,customer_code,avatar,role',
                ]),
                $user,
            ),
        ]);
    }

    public function close(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        if ($user->isCustomer() || ! $user->isPortalUser()) {
            throw ValidationException::withMessages(['conversation' => ['Only staff can close a customer chat.']]);
        }

        $this->authorizeConversation($user, $conversation);
        $conversation->update(['status' => 'closed']);

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->fresh([
                    'latestMessage.sender:id,name,role,avatar',
                    'customer:id,name,email,phone,customer_code,avatar,role',
                ]),
                $user,
            ),
        ]);
    }

    public function messages(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        $afterId = (int) $request->integer('after_id', 0);
        $query = $conversation->messages()
            ->with([
                'sender:id,name,role,avatar',
                'replyTo.sender:id,name,role,avatar',
            ])
            ->orderBy('id');

        if ($afterId > 0) {
            $query->where('id', '>', $afterId);
        } else {
            $query->limit(200);
        }

        $rows = $query->get();
        $deliveredIds = $this->markMessagesDelivered(
            $conversation,
            $user,
            $rows->pluck('id')->all(),
        );
        if ($deliveredIds !== []) {
            $deliveredLookup = array_fill_keys($deliveredIds, true);
            $now = now();
            $rows->each(function (ChatMessage $message) use ($deliveredLookup, $now) {
                if (isset($deliveredLookup[(int) $message->id]) && ! $message->delivered_at) {
                    $message->delivered_at = $now;
                }
            });
        }

        $messages = $rows
            ->map(fn (ChatMessage $m) => $this->serializeMessage($m))
            ->values();

        return response()->json(['messages' => $messages]);
    }

    public function send(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        $data = $request->validate([
            'type' => ['nullable', Rule::in(['text', 'image', 'file', 'voice', 'sticker', 'gif'])],
            'body' => ['nullable', 'string', 'max:4000'],
            'reply_to_message_id' => ['nullable', 'integer', 'exists:chat_messages,id'],
            'sticker_id' => ['nullable', 'string', 'max:120'],
            'sticker_url' => ['nullable', 'string', 'max:500'],
            'gif_url' => ['nullable', 'string', 'max:500'],
            'gif_id' => ['nullable', 'string', 'max:64'],
            'duration_ms' => ['nullable', 'integer', 'min:1', 'max:300000'],
            'attachment' => [
                'nullable',
                'file',
                'max:15360',
                'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,txt,zip,webm,ogg,mp3,mp4,m4a,wav',
            ],
        ]);

        $type = $data['type'] ?? 'text';
        $body = trim((string) ($data['body'] ?? ''));
        $attachment = $request->file('attachment');
        $gifUrl = trim((string) ($data['gif_url'] ?? ''));
        $stickerUrl = trim((string) ($data['sticker_url'] ?? ''));
        $replyToId = isset($data['reply_to_message_id']) ? (int) $data['reply_to_message_id'] : null;
        if ($replyToId) {
            $replyExists = ChatMessage::query()
                ->where('id', $replyToId)
                ->where('conversation_id', $conversation->id)
                ->exists();
            if (! $replyExists) {
                throw ValidationException::withMessages(['reply_to_message_id' => ['Invalid reply target.']]);
            }
        }

        if ($type === 'gif') {
            if ($gifUrl === '' || ! $this->isAllowedGifUrl($gifUrl)) {
                throw ValidationException::withMessages(['gif_url' => ['Choose a valid GIF.']]);
            }
            if ($body === '') {
                $body = 'GIF';
            }
        } elseif ($type === 'sticker') {
            if ($stickerUrl !== '') {
                if (! $this->isAllowedGifUrl($stickerUrl)) {
                    throw ValidationException::withMessages(['sticker_url' => ['Choose a valid sticker.']]);
                }
                if ($body === '') {
                    $body = 'Sticker';
                }
            } elseif ($body === '' && empty($data['sticker_id'])) {
                throw ValidationException::withMessages(['body' => ['Choose a sticker.']]);
            } elseif ($body === '') {
                $body = (string) $data['sticker_id'];
            }
        } elseif (in_array($type, ['image', 'file', 'voice'], true)) {
            if (! $attachment) {
                throw ValidationException::withMessages(['attachment' => ['Attachment is required.']]);
            }
        } elseif ($body === '') {
            throw ValidationException::withMessages(['body' => ['Message cannot be empty.']]);
        }

        if ($attachment) {
            $mime = (string) $attachment->getMimeType();
            if ($type === 'text') {
                $type = str_starts_with($mime, 'image/')
                    ? 'image'
                    : (str_starts_with($mime, 'audio/') || str_starts_with($mime, 'video/') ? 'voice' : 'file');
            }
            if ($type === 'image' && ! str_starts_with($mime, 'image/')) {
                throw ValidationException::withMessages(['attachment' => ['Please upload an image file.']]);
            }
            if ($type === 'voice' && ! (str_starts_with($mime, 'audio/') || str_starts_with($mime, 'video/'))) {
                throw ValidationException::withMessages(['attachment' => ['Please upload an audio recording.']]);
            }
        }

        $stored = null;
        if ($attachment) {
            $detectedMime = (string) $attachment->getMimeType();
            // Browsers often sniff audio webm as video/webm; force audio/* for voice notes.
            if ($type === 'voice' && (str_starts_with($detectedMime, 'video/') || $detectedMime === '' || $detectedMime === 'application/octet-stream')) {
                $detectedMime = 'audio/webm';
            }
            $stored = [
                'path' => $attachment->store('chat/'.date('Y/m'), 'public'),
                'name' => Str::limit($attachment->getClientOriginalName() ?: 'attachment', 180, ''),
                'mime' => $detectedMime,
                'size' => (int) $attachment->getSize(),
            ];
        }

        if ($body === '' && $stored) {
            $body = match ($type) {
                'image' => '📷 Photo',
                'voice' => '🎤 Voice message',
                default => '📎 '.$stored['name'],
            };
        }

        $meta = null;
        if ($type === 'gif') {
            $meta = array_filter([
                'gif_url' => $gifUrl,
                'gif_id' => $data['gif_id'] ?? null,
            ]);
        } elseif ($type === 'sticker') {
            $meta = array_filter([
                'sticker_url' => $stickerUrl !== '' ? $stickerUrl : null,
                'sticker_id' => $data['sticker_id'] ?? null,
            ]);
        }

        $message = DB::transaction(function () use ($conversation, $user, $body, $type, $stored, $data, $meta, $replyToId) {
            $message = ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $user->id,
                'reply_to_message_id' => $replyToId,
                'type' => $type,
                'body' => $body,
                'attachment_path' => $stored['path'] ?? null,
                'attachment_name' => $stored['name'] ?? null,
                'attachment_mime' => $stored['mime'] ?? null,
                'attachment_size' => $stored['size'] ?? null,
                'duration_ms' => isset($data['duration_ms']) ? (int) $data['duration_ms'] : null,
                'meta' => $meta,
            ]);

            $updates = [
                'last_message_at' => now(),
                'status' => 'open',
            ];

            if ($user->isCustomer()) {
                $updates['customer_last_read_at'] = now();
            } else {
                $updates['staff_last_read_at'] = now();
                if (! $conversation->assigned_staff_id) {
                    $updates['assigned_staff_id'] = $user->id;
                }
            }

            $conversation->update($updates);

            return $message->load([
                'sender:id,name,role,avatar',
                'conversation:id,customer_id',
                'replyTo.sender:id,name,role,avatar',
            ]);
        });

        broadcast(new ChatMessageSent($message));

        return response()->json([
            'message' => $this->serializeMessage($message),
        ], 201);
    }

    public function updateMessage(Request $request, ChatConversation $conversation, ChatMessage $message): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        if ((int) $message->conversation_id !== (int) $conversation->id) {
            abort(404);
        }
        if ((int) $message->sender_id !== (int) $user->id) {
            abort(403, 'You can only edit your own messages.');
        }

        $data = $request->validate([
            'body' => ['required', 'string', 'max:4000'],
        ]);

        $body = trim((string) $data['body']);
        if ($body === '') {
            throw ValidationException::withMessages(['body' => ['Message cannot be empty.']]);
        }

        $message->update([
            'body' => $body,
            'edited_at' => now(),
        ]);

        $message->load([
            'sender:id,name,role,avatar',
            'conversation:id,customer_id',
            'replyTo.sender:id,name,role,avatar',
        ]);

        broadcast(new ChatMessageUpdated($message));

        return response()->json([
            'message' => $this->serializeMessage($message),
        ]);
    }

    public function deleteMessage(Request $request, ChatConversation $conversation, ChatMessage $message): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        if ((int) $message->conversation_id !== (int) $conversation->id) {
            abort(404);
        }
        if ((int) $message->sender_id !== (int) $user->id && ! $user->isPortalUser()) {
            abort(403, 'You can only delete your own messages.');
        }

        $messageId = (int) $message->id;
        $message->delete();

        broadcast(ChatMessageDeleted::fromConversation($conversation, $messageId));

        return response()->json([
            'ok' => true,
            'message_id' => $messageId,
            'conversation_id' => (int) $conversation->id,
        ]);
    }

    public function markDelivered(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        $data = $request->validate([
            'message_ids' => ['nullable', 'array', 'max:200'],
            'message_ids.*' => ['integer'],
        ]);

        $ids = $this->markMessagesDelivered(
            $conversation,
            $user,
            array_map('intval', $data['message_ids'] ?? []),
        );

        return response()->json([
            'message_ids' => $ids,
            'status' => 'delivered',
        ]);
    }

    public function markRead(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        if ($user->isCustomer()) {
            $conversation->update(['customer_last_read_at' => now()]);
        } else {
            $conversation->update(['staff_last_read_at' => now()]);
        }

        $pending = ChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('read_at')
            ->pluck('id')
            ->all();

        if ($pending !== []) {
            $now = now();
            ChatMessage::query()
                ->whereIn('id', $pending)
                ->update([
                    'read_at' => $now,
                    'delivered_at' => DB::raw('COALESCE(delivered_at, NOW())'),
                ]);

            broadcast(ChatMessageReceipt::forConversation($conversation, $pending, 'seen'));
        }

        return response()->json([
            'conversation' => $this->serializeConversation($conversation->fresh([
                'customer:id,name,email,phone,customer_code,avatar,role',
                'latestMessage.sender:id,name,role,avatar',
            ]), $user),
        ]);
    }

    public function typing(Request $request, ChatConversation $conversation): JsonResponse
    {
        $user = $request->user();
        $this->authorizeConversation($user, $conversation);

        $data = $request->validate([
            'typing' => ['required', 'boolean'],
        ]);

        broadcast(new ChatUserTyping(
            conversationId: (int) $conversation->id,
            userId: (int) $user->id,
            name: (string) $user->name,
            typing: (bool) $data['typing'],
        ))->toOthers();

        return response()->json(['ok' => true]);
    }

    private function customerConversation(User $customer, bool $create): ?ChatConversation
    {
        $conversation = ChatConversation::query()->where('customer_id', $customer->id)->first();
        if ($conversation || ! $create) {
            return $conversation;
        }

        return ChatConversation::create([
            'customer_id' => $customer->id,
            'status' => 'open',
            'customer_last_read_at' => now(),
        ]);
    }

    private function authorizeConversation(User $user, ChatConversation $conversation): void
    {
        if ($user->isCustomer() && (int) $conversation->customer_id !== (int) $user->id) {
            abort(403, 'You cannot access this conversation.');
        }

        if (! $user->isCustomer() && ! $user->isPortalUser()) {
            abort(403, 'You cannot access this conversation.');
        }
    }

    private function serializeConversation(ChatConversation $conversation, User $viewer): array
    {
        $latest = $conversation->relationLoaded('latestMessage')
            ? $conversation->latestMessage
            : $conversation->latestMessage()->with('sender:id,name,role,avatar')->first();

        return [
            'id' => $conversation->id,
            'status' => $conversation->status,
            'customer_id' => $conversation->customer_id,
            'assigned_staff_id' => $conversation->assigned_staff_id,
            'last_message_at' => optional($conversation->last_message_at)?->toIso8601String(),
            'unread_count' => $conversation->unreadFor($viewer),
            'customer' => $conversation->customer ? [
                'id' => $conversation->customer->id,
                'name' => $conversation->customer->name,
                'email' => $conversation->customer->email,
                'phone' => $conversation->customer->phone,
                'customer_code' => $conversation->customer->customer_code,
                'avatar_url' => $conversation->customer->avatar_url,
            ] : null,
            'latest_message' => $latest ? $this->serializeMessage($latest) : null,
        ];
    }

    /**
     * @param  list<int>  $messageIds
     * @return list<int>
     */
    private function markMessagesDelivered(ChatConversation $conversation, User $user, array $messageIds = []): array
    {
        $query = ChatMessage::query()
            ->where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->whereNull('delivered_at');

        if ($messageIds !== []) {
            $query->whereIn('id', $messageIds);
        }

        $ids = $query->pluck('id')->all();
        if ($ids === []) {
            return [];
        }

        ChatMessage::query()
            ->whereIn('id', $ids)
            ->update(['delivered_at' => now()]);

        broadcast(ChatMessageReceipt::forConversation($conversation, $ids, 'delivered'));

        return array_map('intval', $ids);
    }

    private function serializeMessage(ChatMessage $message): array
    {
        $reply = $message->relationLoaded('replyTo')
            ? $message->replyTo
            : $message->replyTo()->with('sender:id,name,role,avatar')->first();

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'sender_id' => $message->sender_id,
            'reply_to_message_id' => $message->reply_to_message_id,
            'type' => $message->type ?: 'text',
            'body' => $message->body,
            'attachment_url' => $message->attachment_url,
            'attachment_name' => $message->attachment_name,
            'attachment_mime' => $message->attachment_mime,
            'attachment_size' => $message->attachment_size,
            'duration_ms' => $message->duration_ms,
            'meta' => $message->meta,
            'delivered_at' => optional($message->delivered_at)?->toIso8601String(),
            'read_at' => optional($message->read_at)?->toIso8601String(),
            'edited_at' => optional($message->edited_at)?->toIso8601String(),
            'delivery_status' => $message->deliveryStatus(),
            'created_at' => optional($message->created_at)?->toIso8601String(),
            'sender' => $message->sender ? [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
                'role' => $message->sender->role,
                'avatar_url' => $message->sender->avatar_url,
            ] : null,
            'reply_to' => $reply ? [
                'id' => $reply->id,
                'sender_id' => $reply->sender_id,
                'type' => $reply->type ?: 'text',
                'body' => $reply->previewText(),
                'sender_name' => $reply->sender?->name,
            ] : null,
        ];
    }

    private function isAllowedGifUrl(string $url): bool
    {
        if (! filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            return false;
        }

        $allowedRoots = [
            'giphy.com',
            'tenor.com',
            'tenor.co',
            'klipy.com',
            'gifsnap.com',
        ];

        foreach ($allowedRoots as $root) {
            if ($host === $root || str_ends_with($host, '.'.$root)) {
                return true;
            }
        }

        return false;
    }
}
