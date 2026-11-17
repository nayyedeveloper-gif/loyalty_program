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
            $table->date('date_of_birth')->nullable()->after('address');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 48);
            $table->string('title');
            $table->text('body')->nullable();
            $table->json('data')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at', 'created_at']);
            $table->index(['user_id', 'type']);
        });

        Schema::create('birthday_bonus_claims', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('points');
            $table->foreignId('ledger_id')->nullable()->constrained('point_ledger')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'year']);
        });

        $now = now();
        $settings = [
            'birthday_bonus_bronze' => '100',
            'birthday_bonus_silver' => '150',
            'birthday_bonus_gold' => '250',
            'birthday_bonus_platinum' => '400',
            'birthday_bonus_diamond' => '500',
        ];

        foreach ($settings as $key => $value) {
            DB::table('loyalty_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => $value, 'created_at' => $now, 'updated_at' => $now],
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('birthday_bonus_claims');
        Schema::dropIfExists('notifications');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('date_of_birth');
        });

        DB::table('loyalty_settings')->whereIn('key', [
            'birthday_bonus_bronze',
            'birthday_bonus_silver',
            'birthday_bonus_gold',
            'birthday_bonus_platinum',
            'birthday_bonus_diamond',
        ])->delete();
    }
};
