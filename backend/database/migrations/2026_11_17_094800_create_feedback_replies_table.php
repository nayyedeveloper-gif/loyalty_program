<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_message_id')->constrained('feedback_messages')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->boolean('from_staff')->default(false);
            $table->timestamps();

            $table->index(['feedback_message_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_replies');
    }
};
