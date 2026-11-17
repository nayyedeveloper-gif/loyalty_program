<?php

namespace App\Events;

use App\Models\ChatConversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ChatCallSignal implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $conversationId,
        public int $fromUserId,
        public string $fromName,
        public string $action,
        public string $callType,
        public string $callId,
        public ?array $payload = null,
        public ?int $customerId = null,
    ) {
    }

    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('chat.conversation.'.$this->conversationId),
            new PrivateChannel('chat.staff'),
        ];

        $customerId = (int) ($this->customerId ?: ChatConversation::query()
            ->whereKey($this->conversationId)
            ->value('customer_id'));

        if ($customerId > 0) {
            // Required for staff → customer ringing (customer listens on chat.user.*).
            $channels[] = new PrivateChannel('chat.user.'.$customerId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'chat.call';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'from_user_id' => $this->fromUserId,
            'from_name' => $this->fromName,
            'action' => $this->action,
            'call_type' => $this->callType,
            'call_id' => $this->callId,
            'payload' => $this->payload,
        ];
    }
}
