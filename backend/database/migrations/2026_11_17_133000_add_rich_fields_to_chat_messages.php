<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->string('type', 24)->default('text')->after('sender_id');
            $table->string('attachment_path', 255)->nullable()->after('body');
            $table->string('attachment_name', 180)->nullable()->after('attachment_path');
            $table->string('attachment_mime', 120)->nullable()->after('attachment_name');
            $table->unsignedInteger('attachment_size')->nullable()->after('attachment_mime');
            $table->unsignedInteger('duration_ms')->nullable()->after('attachment_size');
            $table->json('meta')->nullable()->after('duration_ms');
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropIndex(['type']);
            $table->dropColumn([
                'type',
                'attachment_path',
                'attachment_name',
                'attachment_mime',
                'attachment_size',
                'duration_ms',
                'meta',
            ]);
        });
    }
};
