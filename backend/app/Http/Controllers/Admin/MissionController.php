<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Mission;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class MissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Mission::query()->latest();

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', filter_var($request->input('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json([
            'missions' => $query->paginate($this->perPage($request, 20, 200)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        if (empty($data['code'])) {
            $data['code'] = $this->uniqueCode($data['title']);
        }

        $mission = Mission::create($data);

        AuditService::log(
            $request->user(),
            'mission_created',
            "Mission created: {$mission->title}",
            $mission,
            ['code' => $mission->code],
            $request,
        );

        return response()->json([
            'message' => 'Mission created.',
            'mission' => $mission,
        ], 201);
    }

    public function update(Request $request, Mission $mission): JsonResponse
    {
        $data = $this->validated($request, updating: true, missionId: $mission->id);
        $mission->update($data);

        AuditService::log(
            $request->user(),
            'mission_updated',
            "Mission updated: {$mission->title}",
            $mission,
            [],
            $request,
        );

        return response()->json([
            'message' => 'Mission updated.',
            'mission' => $mission->fresh(),
        ]);
    }

    public function destroy(Request $request, Mission $mission): JsonResponse
    {
        $title = $mission->title;
        $mission->delete();

        AuditService::log(
            $request->user(),
            'mission_deleted',
            "Mission deleted: {$title}",
            null,
            ['title' => $title],
            $request,
        );

        return response()->json(['message' => 'Mission deleted.']);
    }

    private function validated(Request $request, bool $updating = false, ?int $missionId = null): array
    {
        return $request->validate([
            'code' => [
                $updating ? 'sometimes' : 'nullable',
                'string',
                'max:80',
                Rule::unique('missions', 'code')->ignore($missionId),
            ],
            'title' => [$updating ? 'sometimes' : 'required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
            'goal_type' => [
                $updating ? 'sometimes' : 'required',
                Rule::in(['purchase_count', 'spend_amount', 'login_days']),
            ],
            'goal_target' => [$updating ? 'sometimes' : 'required', 'integer', 'min:1'],
            'bonus_points' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function uniqueCode(string $title): string
    {
        $base = Str::slug($title) ?: 'mission';
        $code = $base;
        $i = 2;
        while (Mission::where('code', $code)->exists()) {
            $code = $base.'-'.$i;
            $i++;
        }

        return $code;
    }
}
