<?php

namespace Database\Seeders;

use App\Models\SpinwheelSetting;
use App\Models\User;
use App\Models\Wheel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SpinWheelSeeder extends Seeder
{
    public function run(): void
    {
        User::firstOrCreate(
            ['email' => config('spinwheel.guest_pool_email')],
            [
                'name' => 'Guest Spin Pool',
                'phone' => '09000000000',
                'password' => Hash::make(Str::random(32)),
                'role' => 'customer',
                'tier' => 'Bronze',
            ]
        );

        $wheel = Wheel::updateOrCreate(
            ['name' => 'Launch Rewards Wheel'],
            [
                'page_title' => 'Spin & Win',
                'brand_title' => '29 Jewellery',
                'description' => 'Loyalty program spin wheel',
                'help_text' => "1) Confirm your spin.\n2) The wheel stops on the prize selected by the server.\n3) Show your reward reference to staff for collection.",
                'status' => 'published',
                'version' => 1,
                'theme' => ['primary' => '#8b0000', 'accent' => '#d4af37'],
            ]
        );

        if ($wheel->segments()->count() === 0) {
            $segments = [
                [
                    'name' => 'Small',
                    'prize_label' => '5% Off',
                    'display_label' => '5% OFF',
                    'description' => 'Five percent off your next purchase.',
                    'weight' => 50,
                    'color' => '#8b0000',
                    'tier' => 'minor',
                    'requires_claim' => true,
                    'claim_days' => 7,
                    'winning_message' => 'Congratulations! You won [Prize].',
                    'instructions' => 'Show this screen to staff within 7 days.',
                ],
                [
                    'name' => 'Medium',
                    'prize_label' => 'Free Cleaning',
                    'display_label' => 'FREE CLEAN',
                    'description' => 'Complimentary jewellery cleaning.',
                    'weight' => 30,
                    'color' => '#c9a227',
                    'tier' => 'minor',
                    'requires_claim' => true,
                    'claim_days' => 3,
                    'winning_message' => 'Great luck! Your reward is ready to claim: [Prize].',
                    'instructions' => 'Redeem with staff.',
                ],
                [
                    'name' => 'Large',
                    'prize_label' => '15% Off',
                    'display_label' => '15% OFF',
                    'description' => 'Fifteen percent off a qualifying purchase.',
                    'weight' => 15,
                    'color' => '#5c0a0a',
                    'tier' => 'major',
                    'requires_claim' => true,
                    'claim_days' => 14,
                    'winning_message' => "You've won a special reward: [Prize]. Please show this screen to our staff.",
                    'instructions' => 'Staff confirmation required.',
                ],
                [
                    'name' => 'Special',
                    'prize_label' => 'Mystery Gift',
                    'display_label' => 'MYSTERY',
                    'description' => 'A surprise gift selected by our team.',
                    'weight' => 5,
                    'color' => '#f0d77a',
                    'tier' => 'major',
                    'requires_claim' => true,
                    'claim_days' => 30,
                    'winning_message' => 'Amazing! You won [Prize]!',
                    'instructions' => 'Collect from the counter.',
                ],
            ];

            foreach ($segments as $i => $segment) {
                $wheel->segments()->create([
                    ...$segment,
                    'sort_order' => $i,
                    'is_active' => true,
                ]);
            }
        }

        SpinwheelSetting::setValue('grant_on_registration', 0);
        SpinwheelSetting::setValue('grant_on_login_promo', 0);
        SpinwheelSetting::setValue('login_promo_active', false);
        SpinwheelSetting::setValue('default_valid_hours', 168);
    }
}
