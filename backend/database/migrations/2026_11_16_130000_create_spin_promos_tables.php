<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('spin_promos', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            $table->text('message');
            $table->unsignedTinyInteger('spin_count')->default(1);
            $table->unsignedInteger('valid_hours')->default(24);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('spin_promo_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('spin_promo_id')->constrained('spin_promos')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('action', 20); // claimed | dismissed
            $table->timestamps();

            $table->unique(['spin_promo_id', 'user_id']);
            $table->index(['user_id', 'action']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spin_promo_responses');
        Schema::dropIfExists('spin_promos');
    }
};
