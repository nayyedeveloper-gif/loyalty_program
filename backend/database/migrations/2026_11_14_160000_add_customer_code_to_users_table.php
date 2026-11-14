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
            $table->string('customer_code', 32)->nullable()->unique()->after('id');
        });

        $customers = DB::table('users')
            ->where('role', 'customer')
            ->orderBy('id')
            ->get(['id']);

        $n = 1;
        foreach ($customers as $customer) {
            DB::table('users')
                ->where('id', $customer->id)
                ->update([
                    'customer_code' => 'C'.str_pad((string) $n, 6, '0', STR_PAD_LEFT),
                ]);
            $n++;
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['customer_code']);
            $table->dropColumn('customer_code');
        });
    }
};
