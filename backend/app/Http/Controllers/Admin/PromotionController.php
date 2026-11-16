<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Promotion;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

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
            'promotions' => $query->paginate((int) $request->integer('per_page', 20)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $data['slug'] = $this->uniqueSlug($data['name']);
        $this->assertNoUnexpectedStacking($data);

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
        $this->assertNoUnexpectedStacking(array_merge($promotion->toArray(), $data), $promotion->id);
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
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (array_key_exists('product_types', $data) && is_array($data['product_types']) && count($data['product_types']) === 0) {
            $data['product_types'] = null;
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

    /**
     * Warn admins when another active promo overlaps in date window.
     * Earn engine already uses max multiplier; we still block identical date overlaps when both active.
     */
    private function assertNoUnexpectedStacking(array $data, ?int $ignoreId = null): void
    {
        if (! ($data['is_active'] ?? true)) {
            return;
        }

        $starts = $data['starts_at'] ?? null;
        $ends = $data['ends_at'] ?? null;

        $query = Promotion::query()
            ->where('is_active', true)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId));

        if ($starts || $ends) {
            $query->where(function ($q) use ($starts, $ends) {
                if ($starts && $ends) {
                    $q->where(function ($inner) use ($ends) {
                        $inner->whereNull('starts_at')->orWhere('starts_at', '<=', $ends);
                    })->where(function ($inner) use ($starts) {
                        $inner->whereNull('ends_at')->orWhere('ends_at', '>=', $starts);
                    });
                } elseif ($starts) {
                    $q->where(function ($inner) use ($starts) {
                        $inner->whereNull('ends_at')->orWhere('ends_at', '>=', $starts);
                    });
                } else {
                    $q->where(function ($inner) use ($ends) {
                        $inner->whereNull('starts_at')->orWhere('starts_at', '<=', $ends);
                    });
                }
            });
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'starts_at' => ['Another active promotion overlaps this period. Earn uses the highest multiplier only — deactivate or adjust dates.'],
            ]);
        }
    }
}
