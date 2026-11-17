<?php

use App\Models\ChatConversation;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.user.{userId}', function (User $user, int $userId) {
    return (int) $user->id === (int) $userId;
});

Broadcast::channel('chat.staff', function (User $user) {
    return $user->isPortalUser();
});

Broadcast::channel('chat.conversation.{conversationId}', function (User $user, int $conversationId) {
    if ($user->isPortalUser()) {
        return true;
    }

    return ChatConversation::query()
        ->where('id', $conversationId)
        ->where('customer_id', $user->id)
        ->exists();
});
