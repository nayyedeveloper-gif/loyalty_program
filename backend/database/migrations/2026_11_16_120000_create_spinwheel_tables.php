<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wheels', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('page_title')->nullable();
            $table->string('brand_title')->nullable();
            $table->string('logo_path')->nullable();
            $table->text('description')->nullable();
            $table->text('help_text')->nullable();
            $table->string('status')->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->json('theme')->nullable();
            $table->timestamps();
        });

        Schema::create('wheel_segments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wheel_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('prize_label');
            $table->string('display_label');
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->unsignedInteger('weight')->default(1);
            $table->string('winning_message');
            $table->text('instructions')->nullable();
            $table->boolean('requires_claim')->default(true);
            $table->unsignedInteger('claim_days')->nullable();
            $table->string('tier')->default('minor');
            $table->string('color')->default('#c9a227');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('spin_usages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('wheel_id')->constrained()->cascadeOnDelete();
            $table->string('source')->default('manual');
            $table->timestamp('granted_at');
            $table->timestamp('expires_at');
            $table->string('status')->default('available');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status', 'expires_at']);
        });

        Schema::create('spin_results', function (Blueprint $table) {
            $table->id();
            $table->string('reward_code', 32)->unique();
            $table->foreignId('spin_usage_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->boolean('is_guest')->default(false);
            $table->string('guest_reference', 32)->nullable();
            $table->unsignedBigInteger('guest_spin_entitlement_id')->nullable();
            $table->string('idempotency_key', 64)->nullable();
            $table->foreignId('wheel_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('wheel_version');
            $table->foreignId('segment_id')->constrained('wheel_segments')->cascadeOnDelete();
            $table->string('prize_label');
            $table->string('display_label')->nullable();
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->string('winning_message');
            $table->text('instructions')->nullable();
            $table->boolean('requires_claim')->default(true);
            $table->timestamp('claim_deadline_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->foreignId('claimed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tier')->default('minor');
            $table->string('claim_status')->default('available');
            $table->timestamps();
            $table->index(['user_id', 'idempotency_key']);
            $table->index(['is_guest', 'claim_status']);
        });

        Schema::create('guest_spin_entitlements', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 32)->unique();
            $table->string('token_hash', 64)->unique();
            $table->string('status', 32)->default('available');
            $table->foreignId('wheel_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamp('reserved_at')->nullable();
            $table->timestamp('reserved_until')->nullable();
            $table->string('guest_session_token_hash', 64)->nullable();
            $table->timestamp('used_at')->nullable();
            $table->unsignedBigInteger('spin_usage_id')->nullable();
            $table->unsignedBigInteger('spin_result_id')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['status', 'expires_at']);
            $table->index(['guest_session_token_hash', 'status']);
        });

        Schema::table('spin_results', function (Blueprint $table) {
            $table->foreign('guest_spin_entitlement_id')
                ->references('id')
                ->on('guest_spin_entitlements')
                ->nullOnDelete();
        });

        Schema::table('guest_spin_entitlements', function (Blueprint $table) {
            $table->foreign('spin_usage_id')->references('id')->on('spin_usages')->nullOnDelete();
            $table->foreign('spin_result_id')->references('id')->on('spin_results')->nullOnDelete();
        });

        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('spinwheel_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('spinwheel_settings');
        Schema::dropIfExists('admin_audit_logs');

        Schema::table('guest_spin_entitlements', function (Blueprint $table) {
            $table->dropForeign(['spin_usage_id']);
            $table->dropForeign(['spin_result_id']);
        });

        Schema::table('spin_results', function (Blueprint $table) {
            $table->dropForeign(['guest_spin_entitlement_id']);
        });

        Schema::dropIfExists('guest_spin_entitlements');
        Schema::dropIfExists('spin_results');
        Schema::dropIfExists('spin_usages');
        Schema::dropIfExists('wheel_segments');
        Schema::dropIfExists('wheels');
    }
};
