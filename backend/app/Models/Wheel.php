<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Wheel extends Model
{
    protected $fillable = [
        'name',
        'page_title',
        'brand_title',
        'logo_path',
        'description',
        'help_text',
        'status',
        'version',
        'theme',
    ];

    protected $appends = ['logo_url'];

    protected function casts(): array
    {
        return [
            'theme' => 'array',
            'version' => 'integer',
        ];
    }

    public function segments(): HasMany
    {
        return $this->hasMany(WheelSegment::class)->orderBy('sort_order');
    }

    public function activeSegments(): HasMany
    {
        return $this->segments()->where('is_active', true);
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (! $this->logo_path) {
            return null;
        }

        return '/storage/'.$this->logo_path;
    }

    public function bumpContentRevision(): void
    {
        $this->forceFill([
            'version' => ((int) $this->version) + 1,
        ])->save();
    }
}
