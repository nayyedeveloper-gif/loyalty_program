<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackReply extends Model
{
    protected $fillable = [
        'feedback_message_id',
        'user_id',
        'body',
        'from_staff',
    ];

    protected function casts(): array
    {
        return [
            'from_staff' => 'boolean',
        ];
    }

    public function feedback(): BelongsTo
    {
        return $this->belongsTo(FeedbackMessage::class, 'feedback_message_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
