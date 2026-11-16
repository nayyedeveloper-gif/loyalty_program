<?php

namespace Database\Seeders;

use App\Models\Mission;
use Illuminate\Database\Seeder;

class MissionSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'code' => 'first_purchase',
                'title' => 'Make your first purchase',
                'description' => 'Complete one purchase at 29 Gold & Jewellery.',
                'goal_type' => 'purchase_count',
                'goal_target' => 1,
                'bonus_points' => 100,
                'starts_at' => null,
                'ends_at' => null,
            ],
            [
                'code' => 'three_purchases',
                'title' => 'Purchase 3 times',
                'description' => 'Complete three purchases to earn a bonus.',
                'goal_type' => 'purchase_count',
                'goal_target' => 3,
                'bonus_points' => 150,
                'starts_at' => null,
                'ends_at' => null,
            ],
            [
                'code' => 'login_streak_3',
                'title' => 'Visit 3 days',
                'description' => 'Sign in on three consecutive days. Same-day sign-ins only count once.',
                'goal_type' => 'login_days',
                'goal_target' => 3,
                'bonus_points' => 50,
                'starts_at' => null,
                'ends_at' => null,
            ],
        ];

        foreach ($items as $item) {
            Mission::query()->updateOrCreate(
                ['code' => $item['code']],
                array_merge($item, ['is_active' => true]),
            );
        }
    }
}
