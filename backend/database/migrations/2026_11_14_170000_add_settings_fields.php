<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('avatar')->nullable()->after('address');
            $table->json('preferences')->nullable()->after('avatar');
        });

        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        $now = now();
        DB::table('app_settings')->insert([
            [
                'key' => 'app_name',
                'value' => '29 Jewellery',
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'app_tagline',
                'value' => 'GEMS & JEWELLERY',
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['avatar', 'preferences']);
        });
    }
};
