<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Mission extends Model
{
    protected $fillable = [
        'code',
        'title',
        'description',
        'goal_type',
        'goal_target',
        'bonus_points',
        'starts_at',
        'ends_at',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'goal_target' => 'integer',
            'bonus_points' => 'integer',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function progressRows(): HasMany
    {
        return $this->hasMany(UserMissionProgress::class);
    }
}
