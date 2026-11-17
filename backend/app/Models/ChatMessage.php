<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'reply_to_message_id',
        'type',
        'body',
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'duration_ms',
        'meta',
        'read_at',
        'delivered_at',
        'edited_at',
    ];

    protected $appends = [
        'attachment_url',
    ];

    protected function casts(): array
    {
        return [
            'attachment_size' => 'integer',
            'duration_ms' => 'integer',
            'meta' => 'array',
            'read_at' => 'datetime',
            'delivered_at' => 'datetime',
            'edited_at' => 'datetime',
        ];
    }

    public function deliveryStatus(): string
    {
        if ($this->read_at) {
            return 'seen';
        }
        if ($this->delivered_at) {
            return 'delivered';
        }

        return 'sent';
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reply_to_message_id');
    }

    public function getAttachmentUrlAttribute(): ?string
    {
        if (! $this->attachment_path) {
            return null;
        }

        // Relative /storage path so Vite/app proxies resolve correctly
        // (Storage::url() would bake APP_URL=http://localhost without :8000).
        return '/storage/'.ltrim((string) $this->attachment_path, '/');
    }

    public function previewText(): string
    {
        return match ($this->type) {
            'image' => '📷 Photo',
            'gif' => 'GIF',
            'voice' => '🎤 Voice message',
            'file' => '📎 '.($this->attachment_name ?: 'File'),
            'sticker' => $this->body ?: 'Sticker',
            default => mb_strimwidth((string) $this->body, 0, 120, '…'),
        };
    }
}
