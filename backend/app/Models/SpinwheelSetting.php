<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SpinwheelSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
    ];

    public static function getValue(string $key, mixed $default = null): mixed
    {
        $cached = Cache::remember("spinwheel_setting:{$key}", 60, function () use ($key) {
            return static::query()->where('key', $key)->value('value');
        });

        if ($cached === null) {
            return $default;
        }

        return $cached;
    }

    public static function getInt(string $key, int $default = 0): int
    {
        return (int) static::getValue($key, $default);
    }

    public static function getBool(string $key, bool $default = false): bool
    {
        $value = static::getValue($key, $default ? '1' : '0');

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    public static function setValue(string $key, mixed $value): void
    {
        static::updateOrCreate(
            ['key' => $key],
            ['value' => is_bool($value) ? ($value ? '1' : '0') : (string) $value],
        );
        Cache::forget("spinwheel_setting:{$key}");
    }

    /**
     * @return array<string, mixed>
     */
    public static function allKeyed(): array
    {
        return [
            'grant_on_registration' => static::getInt('grant_on_registration', 0),
            'registration_grant_message' => (string) static::getValue(
                'registration_grant_message',
                'Welcome! You received {count} free spin(s). Open Spinwheel to try your luck.'
            ),
            'default_valid_hours' => static::getInt('default_valid_hours', (int) config('spinwheel.default_spin_valid_hours', 168)),
        ];
    }
}
