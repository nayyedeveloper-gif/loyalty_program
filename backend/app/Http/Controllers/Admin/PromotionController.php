<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PromotionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Promotion::query()->latest();

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', filter_var($request->input('active'), FILTER_VALIDATE_BOOLEAN));
        }

        return response()->json([
            'promotions' => $query->paginate($this->perPage($request, 20, 200)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['name']);

        $promo = Promotion::create($data);

        AuditService::log(
            $request->user(),
            'promotion_created',
            "Promotion created: {$promo->name}",
            $promo,
            ['multiplier' => $promo->multiplier],
            $request,
        );

        return response()->json([
            'message' => 'Promotion created.',
            'promotion' => $promo,
        ], 201);
    }

    public function update(Request $request, Promotion $promotion): JsonResponse
    {
        $data = $this->validated($request, updating: true);
        if (isset($data['name']) && $data['name'] !== $promotion->name) {
            $data['slug'] = $this->uniqueSlug($data['name'], $promotion->id);
        }
        $promotion->update($data);

        AuditService::log(
            $request->user(),
            'promotion_updated',
            "Promotion updated: {$promotion->name}",
            $promotion,
            [],
            $request,
        );

        return response()->json([
            'message' => 'Promotion updated.',
            'promotion' => $promotion->fresh(),
        ]);
    }

    public function destroy(Request $request, Promotion $promotion): JsonResponse
    {
        $name = $promotion->name;
        $promotion->delete();

        AuditService::log(
            $request->user(),
            'promotion_deleted',
            "Promotion deleted: {$name}",
            null,
            ['name' => $name],
            $request,
        );

        return response()->json(['message' => 'Promotion deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        $data = $request->validate([
            'name' => [$updating ? 'sometimes' : 'required', 'string', 'max:120'],
            'multiplier' => [$updating ? 'sometimes' : 'required', 'numeric', 'min:1', 'max:10'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'product_types' => ['nullable', 'array'],
            'product_types.*' => ['string', 'in:Gold,Diamond,Jade,Ruby,Silver,Watch,Other'],
            'weekends_only' => ['sometimes', 'boolean'],
            'birthdays_only' => ['sometimes', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('product_types', $data) && is_array($data['product_types']) && count($data['product_types']) === 0) {
            $data['product_types'] = null;
        }

        // Birthday promos should not also be weekend-only; birthday day wins.
        if (! empty($data['birthdays_only'])) {
            $data['weekends_only'] = false;
        }

        return $data;
    }

    private function uniqueSlug(string $name, ?int $ignoreId = null): string
    {
        $base = Str::slug($name) ?: 'promo';
        $slug = $base;
        $i = 2;
        while (
            Promotion::query()
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }
}
