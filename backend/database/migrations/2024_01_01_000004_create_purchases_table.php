<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('product_name');
            $table->string('product_code');
            $table->enum('product_type', [
                'Gold',
                'Diamond',
                'Jade',
                'Ruby',
                'Silver',
                'Watch',
                'Other',
            ]);
            $table->unsignedBigInteger('amount');
            $table->unsignedTinyInteger('discount_percent')->default(0);
            $table->unsignedBigInteger('net_amount');
            $table->unsignedInteger('points_earned')->default(0);
            $table->enum('payment_method', [
                'Cash',
                'Bank',
                'KPay',
                'WavePay',
                'Visa/Master',
            ]);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
