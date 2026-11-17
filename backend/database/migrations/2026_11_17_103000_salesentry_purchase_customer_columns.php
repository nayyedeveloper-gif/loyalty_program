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
            $table->string('nrc_number', 120)->nullable()->after('phone');
            $table->string('source', 40)->nullable()->after('role');
            $table->index('nrc_number');
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->unsignedBigInteger('external_id')->nullable()->after('id');
            $table->string('voucher_number', 80)->nullable()->after('product_code');
            $table->string('branch_name', 160)->nullable()->after('voucher_number');
            $table->unsignedInteger('branch_id')->nullable()->after('branch_name');
            $table->string('transaction_side', 20)->nullable()->after('branch_id'); // sale | buyback
            $table->timestamp('sold_at')->nullable()->after('payment_method');
            $table->unique('external_id');
            $table->index('voucher_number');
            $table->index('sold_at');
        });

        // Loosen legacy enums so Sales Entry categories/methods import cleanly.
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE purchases MODIFY product_type VARCHAR(40) NOT NULL");
            DB::statement("ALTER TABLE purchases MODIFY payment_method VARCHAR(40) NOT NULL");
        }
    }

    public function down(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->dropUnique(['external_id']);
            $table->dropIndex(['voucher_number']);
            $table->dropIndex(['sold_at']);
            $table->dropColumn([
                'external_id',
                'voucher_number',
                'branch_name',
                'branch_id',
                'transaction_side',
                'sold_at',
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['nrc_number']);
            $table->dropColumn(['nrc_number', 'source']);
        });
    }
};
