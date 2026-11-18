<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'customer'");
        DB::statement("ALTER TABLE users MODIFY tier VARCHAR(32) NOT NULL DEFAULT 'Care'");

        if (Schema::hasTable('purchases')) {
            DB::statement('ALTER TABLE purchases MODIFY product_type VARCHAR(40) NOT NULL');
            DB::statement('ALTER TABLE purchases MODIFY payment_method VARCHAR(40) NOT NULL');
        }
    }

    public function down(): void
    {
        // Irreversible without knowing every legacy enum value already stored.
    }
};