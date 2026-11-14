<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class AppSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        return Cache::rememberForever("app_setting_{$key}", function () use ($key, $default) {
            return static::query()->where('key', $key)->value('value') ?? $default;
        });
    }

    public static function setValue(string $key, ?string $value): void
    {
        static::query()->updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );

        Cache::forget("app_setting_{$key}");
    }

    public static function allMapped(): array
    {
        $logo = static::getValue('app_logo');

        return [
            'app_name' => static::getValue('app_name', '29 Jewellery'),
            'app_tagline' => static::getValue('app_tagline', 'GEMS & JEWELLERY'),
            'app_logo' => $logo,
            'app_logo_url' => $logo ? '/storage/'.$logo : null,
        ];
    }
}
