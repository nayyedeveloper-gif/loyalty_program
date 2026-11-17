<?php

namespace App\Events;

use App\Models\ChatConversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatMessageReceipt implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  list<int>  $messageIds
     */
    public function __construct(
        public int $conversationId,
        public array $messageIds,
        public string $status,
        public string $at,
        public int $customerId,
    ) {
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
        return 'chat.receipt';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_ids' => array_values(array_map('intval', $this->messageIds)),
            'status' => $this->status,
            'at' => $this->at,
        ];
    }

    public static function forConversation(ChatConversation $conversation, array $messageIds, string $status): self
    {
        $at = now()->toIso8601String();

        return new self(
            conversationId: (int) $conversation->id,
            messageIds: $messageIds,
            status: $status,
            at: $at,
            customerId: (int) $conversation->customer_id,
        );
    }
}
