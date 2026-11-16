<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RewardItem;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RewardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = RewardItem::query()->latest();

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', filter_var($request->input('active'), FILTER_VALIDATE_BOOLEAN));
        }

        $rewards = $query->paginate((int) $request->integer('per_page', 20));

        return response()->json(['rewards' => $rewards]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        if (empty($data['fulfillment'])) {
            $data['fulfillment'] = (($data['category'] ?? '') === 'partner') ? 'instant' : 'pickup';
        }
        $reward = RewardItem::create($data);

        AuditService::log(
            $request->user(),
            'reward_created',
            "Reward created: {$reward->name}",
            $reward,
            ['points_cost' => $reward->points_cost],
            $request,
        );

        return response()->json([
            'message' => 'Reward created.',
            'reward' => $reward,
        ], 201);
    }

    public function update(Request $request, RewardItem $reward): JsonResponse
    {
        $data = $this->validated($request, updating: true);
        $reward->update($data);

        AuditService::log(
            $request->user(),
            'reward_updated',
            "Reward updated: {$reward->name}",
            $reward,
            [],
            $request,
        );

        return response()->json([
            'message' => 'Reward updated.',
            'reward' => $reward->fresh(),
        ]);
    }

    public function updateImage(Request $request, RewardItem $reward): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $reward->deleteStoredImage();

        $path = $data['image']->store('rewards', 'public');
        $reward->update(['image' => $path]);

        AuditService::log(
            $request->user(),
            'reward_image_updated',
            "Reward photo updated: {$reward->name}",
            $reward,
            [],
            $request,
        );

        return response()->json([
            'message' => 'Reward photo updated.',
            'reward' => $reward->fresh(),
        ]);
    }

    public function removeImage(Request $request, RewardItem $reward): JsonResponse
    {
        $reward->deleteStoredImage();
        $reward->update(['image' => null]);

        AuditService::log(
            $request->user(),
            'reward_image_removed',
            "Reward photo removed: {$reward->name}",
            $reward,
            [],
            $request,
        );

        return response()->json([
            'message' => 'Reward photo removed.',
            'reward' => $reward->fresh(),
        ]);
    }

    public function destroy(Request $request, RewardItem $reward): JsonResponse
    {
        $name = $reward->name;
        $reward->deleteStoredImage();
        $reward->delete();

        AuditService::log(
            $request->user(),
            'reward_deleted',
            "Reward deleted: {$name}",
            null,
            ['name' => $name],
            $request,
        );

        return response()->json(['message' => 'Reward deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'name' => [$updating ? 'sometimes' : 'required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'points_cost' => [$updating ? 'sometimes' : 'required', 'integer', 'min:1'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'category' => ['nullable', 'string', 'max:60'],
            'fulfillment' => ['nullable', 'string', 'in:pickup,instant'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
