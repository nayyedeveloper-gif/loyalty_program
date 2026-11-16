<?php

namespace Database\Seeders;

use App\Models\Purchase;
use App\Models\User;
use App\Services\PointsEngine;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => '29 Admin',
            'email' => 'admin@29gold.com',
            'phone' => '09111111111',
            'address' => 'Yangon Showroom',
            'role' => 'admin',
            'tier' => 'Diamond',
            'password' => 'password123',
        ]);

        $firstNames = [
            'Aye', 'Aung', 'Chan', 'Ei', 'Hlaing', 'Hnin', 'Htet', 'Khin', 'Ko', 'Kyaw',
            'Lin', 'May', 'Min', 'Moe', 'Myat', 'Nandar', 'Nay', 'Nilar', 'Nu', 'Phyo',
            'Pyae', 'Sandar', 'Soe', 'Su', 'Thant', 'Thet', 'Thida', 'Thura', 'Tin', 'Win',
            'Wai', 'Ye', 'Zaw', 'Zin', 'Cherry', 'Daisy', 'Grace', 'Helen', 'June', 'Rose',
        ];

        $lastNames = [
            'Aung', 'Hla', 'Htwe', 'Kyaw', 'Lin', 'Maung', 'Moe', 'Myint', 'Oo', 'Phyo',
            'San', 'Soe', 'Than', 'Thant', 'Tun', 'Win', 'Zaw', 'Zin', 'Htet', 'Naing',
        ];

        $townships = [
            'Bahan', 'Mayangone', 'Kamayut', 'Sanchaung', 'Thingangyun', 'Tamwe',
            'Yankin', 'Hlaing', 'Insein', 'Mingaladon', 'Mandalay Palace', 'Chanayethazan',
            'Mahaaungmye', 'Amarapura', 'Pyin Oo Lwin', 'Naypyidaw', 'Taunggyi', 'Mawlamyine',
            'Pathein', 'Bago', 'Monywa', 'Meiktila', 'Magway', 'Pyay',
        ];

        $products = [
            ['24K Gold Necklace', 'GJ-GOLD-001', 'Gold'],
            ['22K Gold Bangle', 'GJ-GOLD-014', 'Gold'],
            ['Gold Ear Studs', 'GJ-GOLD-028', 'Gold'],
            ['Jade Bracelet', 'GJ-JADE-014', 'Jade'],
            ['Imperial Jade Ring', 'GJ-JADE-021', 'Jade'],
            ['Jade Pendant', 'GJ-JADE-033', 'Jade'],
            ['Diamond Ring', 'GJ-DIA-008', 'Diamond'],
            ['Diamond Earrings', 'GJ-DIA-019', 'Diamond'],
            ['Diamond Solitaire', 'GJ-DIA-027', 'Diamond'],
            ['Ruby Pendant', 'GJ-RUBY-003', 'Ruby'],
            ['Ruby Ring', 'GJ-RUBY-011', 'Ruby'],
            ['Silver Anklet', 'GJ-SIL-006', 'Silver'],
            ['Silver Necklace', 'GJ-SIL-018', 'Silver'],
            ['Gold Watch', 'GJ-WATCH-004', 'Watch'],
            ['Classic Watch', 'GJ-WATCH-012', 'Watch'],
            ['Custom Jewellery Set', 'GJ-OTH-002', 'Other'],
        ];

        $payments = ['Cash', 'Bank', 'KPay', 'WavePay', 'Visa/Master'];
        $amountPool = [350_000, 480_000, 650_000, 800_000, 1_000_000, 1_250_000, 1_800_000, 2_400_000, 3_200_000, 4_500_000];

        $this->seedCustomerPurchases(
            User::create([
                'name' => 'Demo Customer',
                'email' => 'customer@29gold.com',
                'phone' => '09555555555',
                'address' => 'Bahan Township',
                'role' => 'customer',
                'password' => 'password123',
                'total_spent' => 0,
                'points' => 0,
                'redeemable_points' => 0,
                'tier' => 'Bronze',
                'last_activity_at' => now(),
            ]),
            16_000_000,
            $products,
            $payments,
            $amountPool,
        );

        for ($i = 1; $i <= 100; $i++) {
            $first = $firstNames[($i - 1) % count($firstNames)];
            $last = $lastNames[$i % count($lastNames)];
            $name = trim($first.' '.$last);
            if ($i % 7 === 0) {
                $name = $first.' '.$firstNames[($i + 3) % count($firstNames)].' '.$last;
            }

            $phone = sprintf('09%09d', 200000000 + $i);
            $email = sprintf('member%03d@29gold.test', $i);
            $address = $townships[$i % count($townships)].', Myanmar';

            // Spend targets still shape purchase volume; tier now comes from points window.
            $spentTarget = match (true) {
                $i <= 45 => random_int(80_000, 950_000),
                $i <= 75 => random_int(1_050_000, 4_800_000),
                $i <= 92 => random_int(5_100_000, 14_500_000),
                default => random_int(15_200_000, 28_000_000),
            };

            $customer = User::create([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'address' => $address,
                'role' => 'customer',
                'password' => 'password123',
                'total_spent' => 0,
                'points' => 0,
                'redeemable_points' => 0,
                'tier' => 'Bronze',
                'created_at' => Carbon::now()->subDays(random_int(1, 240)),
                'updated_at' => Carbon::now()->subDays(random_int(0, 30)),
                'last_activity_at' => Carbon::now()->subDays(random_int(0, 30)),
            ]);

            $this->seedCustomerPurchases(
                $customer,
                $spentTarget,
                $products,
                $payments,
                $amountPool,
            );
        }
    }

    private function seedCustomerPurchases(
        User $user,
        int $targetSpend,
        array $products,
        array $payments,
        array $amountPool,
    ): void {
        PointsEngine::ensureReferralCode($user);

        $remaining = $targetSpend;
        $i = 0;

        while ($remaining > 0) {
            $amount = min($remaining, $amountPool[($i + $user->id) % count($amountPool)]);
            if ($amount < 80_000) {
                $amount = $remaining;
            }

            $product = $products[($i + $user->id) % count($products)];
            $payment = $payments[($i + $user->id) % count($payments)];
            $user->refresh();
            $earn = PointsEngine::computePurchaseEarn($user, $amount, $product[2]);

            $createdAt = Carbon::now()
                ->subDays(random_int(0, 200))
                ->subHours(random_int(0, 20))
                ->subMinutes(random_int(0, 59));

            $purchase = Purchase::create([
                'user_id' => $user->id,
                'product_name' => $product[0],
                'product_code' => $product[1].'-'.str_pad((string) (($user->id * 10) + $i), 4, '0', STR_PAD_LEFT),
                'product_type' => $product[2],
                'amount' => $amount,
                'discount_percent' => 0,
                'net_amount' => $amount,
                'points_earned' => $earn['points'],
                'points_redeemed' => 0,
                'amount_offset_mmk' => 0,
                'payment_method' => $payment,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            $user->total_spent += $amount;
            $user->save();

            PointsEngine::writeLedger(
                user: $user,
                type: 'earn',
                source: 'purchase',
                points: $earn['points'],
                tierEligible: true,
                purchaseId: $purchase->id,
                meta: [
                    'base_points' => $earn['base_points'],
                    'tier_multiplier' => $earn['tier_multiplier'],
                    'promo_multiplier' => $earn['promo_multiplier'],
                    'seeded' => true,
                ],
                createdAt: $createdAt,
            );
            PointsEngine::refreshUserBalances($user->fresh(), touchActivity: false);
            $user->last_activity_at = $createdAt;
            $user->save();

            $remaining -= $amount;
            $i++;

            if ($i > 40) {
                break;
            }
        }

        PointsEngine::refreshUserBalances($user->fresh(), touchActivity: false);
    }
}
