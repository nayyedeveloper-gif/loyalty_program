<?php

namespace App\Http\Controllers\Spinwheel;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use App\Models\Wheel;
use App\Models\WheelSegment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class WheelController extends Controller
{
    public function published()
    {
        $wheel = Wheel::with(['segments' => fn ($q) => $q->where('is_active', true)->orderBy('sort_order')])
            ->where('status', 'published')
            ->latest('id')
            ->first();

        if (! $wheel) {
            return response()->json(['message' => 'No published wheel'], 404);
        }

        return $wheel;
    }

    public function publishedRevision()
    {
        $wheel = Wheel::query()
            ->where('status', 'published')
            ->latest('id')
            ->first();

        if (! $wheel) {
            return response()->json(['message' => 'No published wheel'], 404);
        }

        $segments = $wheel->segments()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get(['id', 'prize_label', 'display_label', 'weight', 'color', 'image_path', 'updated_at']);

        $signature = hash('sha256', json_encode([
            'id' => $wheel->id,
            'version' => $wheel->version,
            'updated_at' => optional($wheel->updated_at)?->toJSON(),
            'page_title' => $wheel->page_title,
            'brand_title' => $wheel->brand_title,
            'logo_path' => $wheel->logo_path,
            'help_text' => $wheel->help_text,
            'segments' => $segments,
        ]));

        return [
            'id' => $wheel->id,
            'version' => $wheel->version,
            'updated_at' => $wheel->updated_at,
            'signature' => $signature,
        ];
    }

    public function index()
    {
        return Wheel::with(['segments' => fn ($q) => $q->orderBy('sort_order')])->orderByDesc('id')->get();
    }

    public function show(Wheel $wheel)
    {
        return $wheel->load(['segments' => fn ($q) => $q->orderBy('sort_order')]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'page_title' => 'nullable|string|max:160',
            'brand_title' => 'nullable|string|max:120',
            'description' => 'nullable|string',
            'help_text' => 'nullable|string|max:2000',
            'status' => 'in:draft,published,paused,archived',
            'theme' => 'nullable|array',
            'logo' => 'nullable|image|mimes:jpg,jpeg,png,gif,webp,svg|max:4096',
        ]);

        if (empty($data['page_title'])) {
            $data['page_title'] = $data['name'];
        }
        if (empty($data['brand_title'])) {
            $data['brand_title'] = $data['page_title'] ?: $data['name'];
        }

        if ($request->hasFile('logo')) {
            $data['logo_path'] = $request->file('logo')->store('spinwheel/branding', 'public');
        }
        unset($data['logo']);

        $wheel = Wheel::create($data);

        return response()->json($wheel->load('segments'), 201);
    }

    public function update(Request $request, Wheel $wheel)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:120',
            'page_title' => 'nullable|string|max:160',
            'brand_title' => 'nullable|string|max:120',
            'description' => 'nullable|string',
            'help_text' => 'nullable|string|max:2000',
            'status' => 'in:draft,published,paused,archived',
            'theme' => 'nullable|array',
            'logo' => 'nullable|image|mimes:jpg,jpeg,png,gif,webp,svg|max:4096',
            'remove_logo' => 'sometimes',
        ]);

        unset($data['logo'], $data['remove_logo']);

        $shouldRemoveLogo = $request->boolean('remove_logo')
            || $request->input('remove_logo') === '1'
            || $request->input('remove_logo') === 'true';

        if ($shouldRemoveLogo && ! $request->hasFile('logo')) {
            if ($wheel->logo_path) {
                Storage::disk('public')->delete($wheel->logo_path);
            }
            $data['logo_path'] = null;
        }

        if ($request->hasFile('logo')) {
            if ($wheel->logo_path) {
                Storage::disk('public')->delete($wheel->logo_path);
            }
            $data['logo_path'] = $request->file('logo')->store('spinwheel/branding', 'public');
        }

        if (isset($data['status']) && $data['status'] === 'published' && $wheel->status !== 'published') {
            $wheel->version = $wheel->version + 1;
        }

        $beforeStatus = $wheel->status;
        $wheel->fill($data)->save();

        AdminAuditLog::record(
            $request->user()?->id,
            'wheel.updated',
            'wheel',
            $wheel->id,
            ['status' => $wheel->status, 'from_status' => $beforeStatus]
        );

        return $wheel->load(['segments' => fn ($q) => $q->orderBy('sort_order')]);
    }

    public function showSegment(WheelSegment $segment)
    {
        return $segment->load('wheel');
    }

    public function stockAlerts()
    {
        $items = WheelSegment::query()
            ->with('wheel:id,name,status')
            ->whereNotNull('stock')
            ->where('stock', '<=', 0)
            ->orderByDesc('stock_depleted_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (WheelSegment $s) => [
                'id' => $s->id,
                'prize_label' => $s->prize_label,
                'display_label' => $s->display_label,
                'wheel_id' => $s->wheel_id,
                'wheel_name' => $s->wheel?->name,
                'is_active' => $s->is_active,
                'stock' => $s->stock,
                'stock_depleted_at' => $s->stock_depleted_at,
            ])
            ->values();

        return [
            'count' => $items->count(),
            'has_alerts' => $items->isNotEmpty(),
            'items' => $items,
        ];
    }

    public function storeSegment(Request $request, Wheel $wheel)
    {
        $data = $this->segmentPayload($request, true);
        $data['sort_order'] = ($wheel->segments()->max('sort_order') ?? -1) + 1;
        $data['color'] = $data['color'] ?? '#c9a227';
        $data['tier'] = $data['tier'] ?? 'minor';
        $data['requires_claim'] = array_key_exists('requires_claim', $data)
            ? filter_var($data['requires_claim'], FILTER_VALIDATE_BOOLEAN)
            : true;

        if (array_key_exists('stock', $data)) {
            if ($data['stock'] === '' || $data['stock'] === null) {
                $data['stock'] = null;
            } else {
                $data['stock'] = (int) $data['stock'];
                if ($data['stock'] <= 0) {
                    $data['stock'] = 0;
                    $data['is_active'] = false;
                    $data['stock_depleted_at'] = now();
                }
            }
        }

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('spinwheel/prizes', 'public');
        }

        $segment = $wheel->segments()->create($data);
        $wheel->bumpContentRevision();

        AdminAuditLog::record(
            $request->user()?->id,
            'prize.created',
            'wheel_segment',
            $segment->id,
            ['wheel_id' => $wheel->id, 'prize_label' => $segment->prize_label]
        );

        return response()->json($segment->fresh(), 201);
    }

    public function updateSegment(Request $request, WheelSegment $segment)
    {
        $data = $this->segmentPayload($request, false);

        $shouldRemoveImage = $request->boolean('remove_image')
            || $request->input('remove_image') === '1'
            || $request->input('remove_image') === 'true';

        if ($shouldRemoveImage && ! $request->hasFile('image')) {
            if ($segment->image_path) {
                Storage::disk('public')->delete($segment->image_path);
            }
            $data['image_path'] = null;
        }

        if ($request->hasFile('image')) {
            if ($segment->image_path) {
                Storage::disk('public')->delete($segment->image_path);
            }
            $data['image_path'] = $request->file('image')->store('spinwheel/prizes', 'public');
        }

        if (array_key_exists('requires_claim', $data)) {
            $data['requires_claim'] = filter_var($data['requires_claim'], FILTER_VALIDATE_BOOLEAN);
        }

        if (array_key_exists('is_active', $data)) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        if (array_key_exists('claim_days', $data) && ($data['claim_days'] === '' || $data['claim_days'] === null)) {
            $data['claim_days'] = null;
        }

        if (array_key_exists('stock', $data)) {
            if ($data['stock'] === '' || $data['stock'] === null) {
                $data['stock'] = null;
                $data['stock_depleted_at'] = null;
            } else {
                $data['stock'] = (int) $data['stock'];
                if ($data['stock'] > 0) {
                    $data['stock_depleted_at'] = null;
                    // Restocking an empty prize re-activates it unless admin explicitly keeps it off
                    if (! array_key_exists('is_active', $data) && $segment->is_out_of_stock) {
                        $data['is_active'] = true;
                    }
                } elseif ($data['stock'] === 0) {
                    $data['is_active'] = false;
                    $data['stock_depleted_at'] = $segment->stock_depleted_at ?: now();
                }
            }
        }

        $segment->fill($data)->save();
        $segment->wheel?->bumpContentRevision();

        AdminAuditLog::record(
            $request->user()?->id,
            'prize.updated',
            'wheel_segment',
            $segment->id,
            ['fields' => array_keys($data)]
        );

        return $segment->fresh();
    }

    public function destroySegment(Request $request, WheelSegment $segment)
    {
        $id = $segment->id;
        $wheel = $segment->wheel;
        if ($segment->image_path) {
            Storage::disk('public')->delete($segment->image_path);
        }
        $segment->delete();
        $wheel?->bumpContentRevision();

        AdminAuditLog::record(
            $request->user()?->id,
            'prize.deleted',
            'wheel_segment',
            $id
        );

        return response()->json(['ok' => true]);
    }

    public function reorderSegments(Request $request, Wheel $wheel)
    {
        $data = $request->validate([
            'order' => 'required|array',
            'order.*' => 'integer',
        ]);

        foreach ($data['order'] as $index => $id) {
            WheelSegment::where('wheel_id', $wheel->id)->where('id', $id)->update(['sort_order' => $index]);
        }

        $wheel->bumpContentRevision();

        return $wheel->load(['segments' => fn ($q) => $q->orderBy('sort_order')]);
    }

    private function segmentPayload(Request $request, bool $creating): array
    {
        if ($request->has('claim_days') && $request->input('claim_days') === '') {
            $request->merge(['claim_days' => null]);
        }

        if ($request->has('stock') && $request->input('stock') === '') {
            $request->merge(['stock' => null]);
        }

        $rules = [
            'name' => ($creating ? 'required' : 'sometimes').'|string|max:120',
            'prize_label' => ($creating ? 'required' : 'sometimes').'|string|max:120',
            'display_label' => ($creating ? 'required' : 'sometimes').'|string|max:120',
            'description' => 'nullable|string',
            'weight' => ($creating ? 'required' : 'sometimes').'|integer|min:1',
            'winning_message' => ($creating ? 'required' : 'sometimes').'|string|max:500',
            'instructions' => 'nullable|string',
            'color' => 'nullable|string|max:20',
            'is_active' => 'sometimes',
            'requires_claim' => 'sometimes',
            'claim_days' => 'nullable|integer|min:1|max:3650',
            'tier' => 'sometimes|in:minor,major',
            'stock' => 'nullable|integer|min:0|max:100000',
            'image' => 'nullable|image|mimes:jpg,jpeg,png,gif,webp,bmp,svg|max:4096',
            'remove_image' => 'sometimes',
            'sort_order' => 'sometimes|integer|min:0',
        ];

        $data = $request->validate($rules);
        unset($data['image'], $data['remove_image']);

        return $data;
    }
}
