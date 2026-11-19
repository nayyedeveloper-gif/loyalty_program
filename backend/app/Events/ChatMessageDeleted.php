<?php

namespace App\Events;

use App\Models\ChatConversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $conversationId,
        public int $messageId,
        public int $customerId = 0,
    ) {}

    public static function fromConversation(ChatConversation $conversation, int $messageId): self
    {
        return new self(
            conversationId: (int) $conversation->id,
            messageId: $messageId,
            customerId: (int) $conversation->customer_id,
        );
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('chat.conversation.'.$this->conversationId),
            new PrivateChannel('chat.staff'),
        ];

        if ($this->customerId > 0) {
            $channels[] = new PrivateChannel('chat.user.'.$this->customerId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'chat.message.deleted';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_id' => $this->messageId,
        ];
    }
}
