<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loyalty_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('loyalty_tiers', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('min_tier_points')->default(0);
            $table->decimal('earn_multiplier', 4, 2)->default(1);
            $table->json('perks')->nullable();
            $table->timestamps();
        });

        Schema::create('point_ledger', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 32); // earn, redeem, adjust, expire, bonus, reverse
            $table->string('source', 64); // purchase, promo, referral, mission, signup, review, streak, catalog, system
            $table->integer('points'); // signed: +earn, -redeem/-expire
            $table->boolean('tier_eligible')->default(false);
            $table->foreignId('purchase_id')->nullable()->constrained('purchases')->nullOnDelete();
            $table->foreignId('related_ledger_id')->nullable()->constrained('point_ledger')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'tier_eligible', 'created_at']);
            $table->index(['purchase_id', 'type']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('redeemable_points')->default(0)->after('points');
            $table->unsignedInteger('tier_points_365d')->default(0)->after('redeemable_points');
            $table->timestamp('last_activity_at')->nullable()->after('tier_points_365d');
            $table->string('referral_code', 32)->nullable()->unique()->after('customer_code');
            $table->foreignId('referred_by')->nullable()->after('referral_code')->constrained('users')->nullOnDelete();
            $table->unsignedInteger('login_streak')->default(0)->after('last_activity_at');
            $table->date('last_login_streak_date')->nullable()->after('login_streak');
        });

        // Expand tier column beyond old Silver-start enum (SQLite-safe string).
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            // SQLite ignores enum; column is already flexible enough after recreate in some setups.
        } else {
            DB::statement("ALTER TABLE users MODIFY tier VARCHAR(32) NOT NULL DEFAULT 'Bronze'");
        }

        Schema::table('purchases', function (Blueprint $table) {
            $table->unsignedInteger('points_redeemed')->default(0)->after('points_earned');
            $table->unsignedBigInteger('amount_offset_mmk')->default(0)->after('points_redeemed');
        });

        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('multiplier', 4, 2)->default(2);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->json('product_types')->nullable(); // null = all
            $table->boolean('weekends_only')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reward_items', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('points_cost');
            $table->unsignedInteger('stock')->nullable();
            $table->string('category')->default('voucher'); // voucher, merchandise, partner
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('reward_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reward_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ledger_id')->nullable()->constrained('point_ledger')->nullOnDelete();
            $table->unsignedInteger('points_spent');
            $table->string('status')->default('fulfilled');
            $table->timestamps();
        });

        Schema::create('missions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('goal_type'); // purchase_count, spend_amount, login_days
            $table->unsignedInteger('goal_target');
            $table->unsignedInteger('bonus_points')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_mission_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('mission_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('progress')->default(0);
            $table->boolean('completed')->default(false);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'mission_id']);
        });

        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('product_code');
            $table->string('product_name')->nullable();
            $table->unsignedTinyInteger('rating');
            $table->text('body')->nullable();
            $table->boolean('points_awarded')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'product_code']);
        });

        $now = now();

        DB::table('loyalty_settings')->insert([
            ['key' => 'base_earn_divisor', 'value' => '10000', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'redemption_rate', 'value' => '1', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'redeem_increment', 'value' => '100', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'inactivity_days', 'value' => '365', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'signup_bonus_points', 'value' => '100', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'referral_bonus_points', 'value' => '100', 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'review_bonus_points', 'value' => '20', 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('loyalty_tiers')->insert([
            [
                'name' => 'Bronze',
                'sort_order' => 1,
                'min_tier_points' => 0,
                'earn_multiplier' => 1.00,
                'perks' => json_encode(['Base earning rate', 'Member offers']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Silver',
                'sort_order' => 2,
                'min_tier_points' => 500,
                'earn_multiplier' => 1.20,
                'perks' => json_encode(['1.2x points', 'Birthday surprise']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Gold',
                'sort_order' => 3,
                'min_tier_points' => 2000,
                'earn_multiplier' => 1.50,
                'perks' => json_encode(['1.5x points', 'Early access sales', 'Birthday gift']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Platinum',
                'sort_order' => 4,
                'min_tier_points' => 6000,
                'earn_multiplier' => 2.00,
                'perks' => json_encode(['2x points', 'VIP support', 'Event invitations']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Diamond',
                'sort_order' => 5,
                'min_tier_points' => 15000,
                'earn_multiplier' => 2.50,
                'perks' => json_encode(['2.5x points', 'Complimentary services', 'Private events']),
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        // Remap existing Silver-start customers after column exists.
        DB::table('users')->where('role', 'customer')->where('tier', 'Silver')->update(['tier' => 'Bronze']);

        // Backfill ledger from historical purchases.
        $purchases = DB::table('purchases')->orderBy('id')->get();
        foreach ($purchases as $purchase) {
            $points = (int) $purchase->points_earned;
            if ($points <= 0) {
                continue;
            }
            DB::table('point_ledger')->insert([
                'user_id' => $purchase->user_id,
                'type' => 'earn',
                'source' => 'purchase',
                'points' => $points,
                'tier_eligible' => true,
                'purchase_id' => $purchase->id,
                'meta' => json_encode(['migrated' => true, 'legacy_points' => $points]),
                'created_at' => $purchase->created_at ?? $now,
                'updated_at' => $purchase->updated_at ?? $now,
            ]);
        }

        $customers = DB::table('users')->where('role', 'customer')->get();
        foreach ($customers as $customer) {
            $wallet = (int) DB::table('point_ledger')->where('user_id', $customer->id)->sum('points');
            $windowStart = now()->subDays(365);
            $tierPoints = (int) DB::table('point_ledger')
                ->where('user_id', $customer->id)
                ->where('tier_eligible', true)
                ->where('points', '>', 0)
                ->where('created_at', '>=', $windowStart)
                ->sum('points');

            $code = 'R'.strtoupper(substr(md5((string) $customer->id.$customer->email), 0, 8));

            DB::table('users')->where('id', $customer->id)->update([
                'redeemable_points' => max(0, $wallet),
                'points' => max(0, $wallet),
                'tier_points_365d' => max(0, $tierPoints),
                'last_activity_at' => $customer->updated_at ?? $now,
                'referral_code' => $customer->referral_code ?: $code,
            ]);
        }

        // Seed starter catalog / missions / promo for later phases.
        DB::table('promotions')->insert([
            'name' => 'Weekend Double Points',
            'slug' => 'weekend-double',
            'multiplier' => 2,
            'starts_at' => null,
            'ends_at' => null,
            'product_types' => null,
            'weekends_only' => true,
            'is_active' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::table('reward_items')->insert([
            [
                'name' => '10,000 MMK Store Voucher',
                'description' => 'Redeem for 10,000 MMK off your next purchase.',
                'points_cost' => 10000,
                'stock' => 100,
                'category' => 'voucher',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Jewellery Care Kit',
                'description' => 'Soft cloth and cleaning solution set.',
                'points_cost' => 2500,
                'stock' => 50,
                'category' => 'merchandise',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Mobile Data 1GB Partner Pack',
                'description' => 'Convert points into partner mobile data.',
                'points_cost' => 1500,
                'stock' => null,
                'category' => 'partner',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        DB::table('missions')->insert([
            [
                'code' => 'five_purchases_month',
                'title' => 'Make 5 purchases this month',
                'description' => 'Complete five purchases within the mission window.',
                'goal_type' => 'purchase_count',
                'goal_target' => 5,
                'bonus_points' => 200,
                'starts_at' => $now->copy()->startOfMonth(),
                'ends_at' => $now->copy()->endOfMonth(),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'code' => 'spend_1m',
                'title' => 'Spend 1,000,000 MMK',
                'description' => 'Reach 1,000,000 MMK in purchases during the mission.',
                'goal_type' => 'spend_amount',
                'goal_target' => 1_000_000,
                'bonus_points' => 300,
                'starts_at' => $now->copy()->startOfMonth(),
                'ends_at' => $now->copy()->endOfMonth(),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
        Schema::dropIfExists('user_mission_progress');
        Schema::dropIfExists('missions');
        Schema::dropIfExists('reward_redemptions');
        Schema::dropIfExists('reward_items');
        Schema::dropIfExists('promotions');

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropColumn(['points_redeemed', 'amount_offset_mmk']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('referred_by');
            $table->dropColumn([
                'redeemable_points',
                'tier_points_365d',
                'last_activity_at',
                'referral_code',
                'login_streak',
                'last_login_streak_date',
            ]);
        });

        Schema::dropIfExists('point_ledger');
        Schema::dropIfExists('loyalty_tiers');
        Schema::dropIfExists('loyalty_settings');
    }
};
