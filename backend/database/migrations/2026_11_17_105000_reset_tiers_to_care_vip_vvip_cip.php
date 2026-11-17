<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loyalty_tiers', function (Blueprint $table) {
            if (! Schema::hasColumn('loyalty_tiers', 'min_spend_mmk')) {
                $table->unsignedBigInteger('min_spend_mmk')->default(0)->after('min_tier_points');
            }
        });

        DB::table('loyalty_tiers')->delete();

        $now = now();
        // 1 lakh = 100,000 MMK
        DB::table('loyalty_tiers')->insert([
            [
                'name' => 'Care',
                'sort_order' => 1,
                'min_tier_points' => 0,
                'min_spend_mmk' => 0,
                'earn_multiplier' => 1.00,
                'perks' => json_encode(['Base earning rate', 'Member care support']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'VIP',
                'sort_order' => 2,
                'min_tier_points' => 0,
                'min_spend_mmk' => 30_000_000, // 300 lakh
                'earn_multiplier' => 1.20,
                'perks' => json_encode(['1.2x points', 'Priority assistance']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'VVIP',
                'sort_order' => 3,
                'min_tier_points' => 0,
                'min_spend_mmk' => 50_000_000, // 500 lakh
                'earn_multiplier' => 1.50,
                'perks' => json_encode(['1.5x points', 'Exclusive offers', 'Birthday recognition']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'CIP',
                'sort_order' => 4,
                'min_tier_points' => 0,
                'min_spend_mmk' => 100_000_000, // 1000 lakh+
                'earn_multiplier' => 2.00,
                'perks' => json_encode(['2.0x points', 'Concierge care', 'Private invitations']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // Replace birthday settings keyed by old metal tiers.
        DB::table('loyalty_settings')->whereIn('key', [
            'birthday_bonus_bronze',
            'birthday_bonus_silver',
            'birthday_bonus_gold',
            'birthday_bonus_platinum',
            'birthday_bonus_diamond',
        ])->delete();

        foreach ([
            'birthday_bonus_care' => '100',
            'birthday_bonus_vip' => '200',
            'birthday_bonus_vvip' => '350',
            'birthday_bonus_cip' => '500',
        ] as $key => $value) {
            DB::table('loyalty_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => $value, 'updated_at' => $now, 'created_at' => $now],
            );
        }

        // Remap everyone onto Care first, then spend-based assignment.
        DB::table('users')->whereNotNull('tier')->update(['tier' => 'Care']);

        $tiers = DB::table('loyalty_tiers')->orderBy('sort_order')->get();
        $customers = DB::table('users')->where('role', 'customer')->get(['id', 'total_spent']);
        foreach ($customers as $customer) {
            $spend = (int) $customer->total_spent;
            $name = 'Care';
            foreach ($tiers as $tier) {
                if ($spend >= (int) $tier->min_spend_mmk) {
                    $name = $tier->name;
                }
            }
            DB::table('users')->where('id', $customer->id)->update(['tier' => $name]);
        }

        Cache::forget('loyalty_tiers_ordered');
    }

    public function down(): void
    {
        // Irreversible content reset — keep column for safety.
    }
};
