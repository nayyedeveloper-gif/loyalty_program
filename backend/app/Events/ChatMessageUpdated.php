<?php

namespace App\Events;

use App\Models\ChatMessage;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public ChatMessage $message)
    {
        $this->message->loadMissing([
            'conversation:id,customer_id',
            'sender:id,name,role,avatar',
            'replyTo.sender:id,name,role,avatar',
        ]);
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('chat.conversation.'.$this->message->conversation_id),
            new PrivateChannel('chat.staff'),
        ];

        $customerId = (int) ($this->message->conversation?->customer_id
            ?? $this->message->conversation()->value('customer_id'));

        if ($customerId > 0) {
            $channels[] = new PrivateChannel('chat.user.'.$customerId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'chat.message.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'conversation_id' => $this->message->conversation_id,
                'sender_id' => $this->message->sender_id,
                'type' => $this->message->type ?: 'text',
                'body' => $this->message->body,
                'attachment_url' => $this->message->attachment_url,
                'attachment_name' => $this->message->attachment_name,
                'attachment_mime' => $this->message->attachment_mime,
                'attachment_size' => $this->message->attachment_size,
                'duration_ms' => $this->message->duration_ms,
                'meta' => $this->message->meta,
                'reply_to_message_id' => $this->message->reply_to_message_id,
                'delivered_at' => optional($this->message->delivered_at)?->toIso8601String(),
                'read_at' => optional($this->message->read_at)?->toIso8601String(),
                'edited_at' => optional($this->message->edited_at)?->toIso8601String(),
                'delivery_status' => $this->message->deliveryStatus(),
                'created_at' => optional($this->message->created_at)?->toIso8601String(),
                'sender' => $this->message->sender ? [
                    'id' => $this->message->sender->id,
                    'name' => $this->message->sender->name,
                    'role' => $this->message->sender->role,
                    'avatar_url' => $this->message->sender->avatar_url,
                ] : null,
                'reply_to' => $this->serializeReply($this->message->replyTo),
            ],
        ];
    }

    private function serializeReply(?ChatMessage $reply): ?array
    {
        if (! $reply) {
            return null;
        }

        return [
            'id' => $reply->id,
            'sender_id' => $reply->sender_id,
            'type' => $reply->type ?: 'text',
            'body' => $reply->previewText(),
            'sender_name' => $reply->sender?->name,
        ];
    }
}
