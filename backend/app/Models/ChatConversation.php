<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ChatConversation extends Model
{
    protected $fillable = [
        'customer_id',
        'assigned_staff_id',
        'status',
        'last_message_at',
        'customer_last_read_at',
        'staff_last_read_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'customer_last_read_at' => 'datetime',
            'staff_last_read_at' => 'datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(ChatMessage::class, 'conversation_id')->latestOfMany();
    }

    public function unreadFor(User $user): int
    {
        if ($user->isCustomer()) {
            $since = $this->customer_last_read_at;

            return $this->messages()
                ->where('sender_id', '!=', $user->id)
                ->when($since, fn ($q) => $q->where('created_at', '>', $since))
                ->count();
        }

        $since = $this->staff_last_read_at;

        return $this->messages()
            ->where('sender_id', $this->customer_id)
            ->when($since, fn ($q) => $q->where('created_at', '>', $since))
            ->count();
    }
}
