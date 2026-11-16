<?php

namespace App\Services;

use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class AuditService
{
    public static function log(
        ?User $actor,
        string $action,
        string $description,
        ?Model $subject = null,
        array $meta = [],
        ?Request $request = null,
    ): AdminActivityLog {
        return AdminActivityLog::create([
            'actor_id' => $actor?->id,
            'action' => $action,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'meta' => $meta ?: null,
            'ip_address' => $request?->ip(),
        ]);
    }
}
