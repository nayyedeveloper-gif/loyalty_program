<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('purchases', function (Blueprint $table) {
            $table->string('status', 24)->default('recorded')->after('payment_method');
            $table->string('cancel_reason', 255)->nullable()->after('status');
            $table->timestamp('cancelled_at')->nullable()->after('cancel_reason');
            $table->index('status');
        });

        Schema::table('reward_redemptions', function (Blueprint $table) {
            $table->string('redemption_code', 32)->nullable()->unique()->after('points_spent');
            $table->timestamp('collected_at')->nullable()->after('status');
        });

        // Existing fulfilled redemptions become collected with generated codes.
        $rows = DB::table('reward_redemptions')->orderBy('id')->get(['id', 'status']);
        foreach ($rows as $row) {
            $code = '29G-'.strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
            $status = $row->status === 'fulfilled' ? 'collected' : ($row->status ?: 'pending');
            DB::table('reward_redemptions')->where('id', $row->id)->update([
                'redemption_code' => $code,
                'status' => $status,
                'collected_at' => $status === 'collected' ? now() : null,
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('reward_redemptions', function (Blueprint $table) {
            $table->dropColumn(['redemption_code', 'collected_at']);
        });

        Schema::table('purchases', function (Blueprint $table) {
            $table->dropIndex(['status']);
            $table->dropColumn(['status', 'cancel_reason', 'cancelled_at']);
        });
    }
};
