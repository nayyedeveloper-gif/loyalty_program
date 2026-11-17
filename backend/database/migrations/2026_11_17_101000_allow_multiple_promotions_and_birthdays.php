<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->boolean('birthdays_only')->default(false)->after('weekends_only');
        });

        $now = now();
        $exists = DB::table('promotions')->where('slug', 'birthday-special')->exists();
        if (! $exists) {
            DB::table('promotions')->insert([
                'name' => 'Birthday Special',
                'slug' => 'birthday-special',
                'multiplier' => 2,
                'starts_at' => null,
                'ends_at' => null,
                'product_types' => null,
                'weekends_only' => false,
                'birthdays_only' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        DB::table('promotions')->where('slug', 'birthday-special')->delete();

        Schema::table('promotions', function (Blueprint $table) {
            $table->dropColumn('birthdays_only');
        });
    }
};
