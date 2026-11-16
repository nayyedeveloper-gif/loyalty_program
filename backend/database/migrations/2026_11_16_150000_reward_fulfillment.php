<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reward_items', function (Blueprint $table) {
            $table->string('fulfillment', 20)->default('pickup')->after('category');
        });

        // Digital/partner packs are fulfilled immediately — no in-store pickup.
        DB::table('reward_items')
            ->where('category', 'partner')
            ->update(['fulfillment' => 'instant']);

        // Any existing pending partner redemptions should already be treated as delivered.
        $partnerIds = DB::table('reward_items')->where('fulfillment', 'instant')->pluck('id');
        if ($partnerIds->isNotEmpty()) {
            DB::table('reward_redemptions')
                ->whereIn('reward_item_id', $partnerIds)
                ->where('status', 'pending')
                ->update([
                    'status' => 'collected',
                    'collected_at' => now(),
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('reward_items', function (Blueprint $table) {
            $table->dropColumn('fulfillment');
        });
    }
};
