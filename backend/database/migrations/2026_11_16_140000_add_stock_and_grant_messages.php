<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wheel_segments', function (Blueprint $table) {
            $table->unsignedInteger('stock')->nullable()->after('is_active');
            $table->timestamp('stock_depleted_at')->nullable()->after('stock');
        });

        $exists = DB::table('spinwheel_settings')->where('key', 'registration_grant_message')->exists();
        if (! $exists) {
            DB::table('spinwheel_settings')->insert([
                'key' => 'registration_grant_message',
                'value' => 'Welcome! You received {count} free spin(s). Open Spinwheel to try your luck.',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Disable legacy login-promo automatic grants
        DB::table('spinwheel_settings')->updateOrInsert(
            ['key' => 'login_promo_active'],
            ['value' => '0', 'updated_at' => now(), 'created_at' => now()]
        );
        DB::table('spinwheel_settings')->updateOrInsert(
            ['key' => 'grant_on_login_promo'],
            ['value' => '0', 'updated_at' => now(), 'created_at' => now()]
        );
    }

    public function down(): void
    {
        Schema::table('wheel_segments', function (Blueprint $table) {
            $table->dropColumn(['stock', 'stock_depleted_at']);
        });

        DB::table('spinwheel_settings')->where('key', 'registration_grant_message')->delete();
    }
};
