<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Faq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaqController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Faq::query()->orderBy('sort_order')->orderBy('id');

        if ($request->filled('search')) {
            $search = trim((string) $request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('question_en', 'like', "%{$search}%")
                    ->orWhere('question_my', 'like', "%{$search}%")
                    ->orWhere('answer_en', 'like', "%{$search}%")
                    ->orWhere('answer_my', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where('is_active', filter_var($request->input('active'), FILTER_VALIDATE_BOOLEAN));
        }

        $faqs = $query->paginate($this->perPage($request, 50, 200));

        return response()->json(['faqs' => $faqs]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        if (! array_key_exists('sort_order', $data) || $data['sort_order'] === null) {
            $data['sort_order'] = (int) Faq::query()->max('sort_order') + 1;
        }

        $faq = Faq::create($data);

        return response()->json([
            'message' => 'FAQ created.',
            'faq' => $faq,
        ], 201);
    }

    public function update(Request $request, Faq $faq): JsonResponse
    {
        $data = $this->validated($request, updating: true);
        $faq->update($data);

        return response()->json([
            'message' => 'FAQ updated.',
            'faq' => $faq->fresh(),
        ]);
    }

    public function destroy(Faq $faq): JsonResponse
    {
        $faq->delete();

        return response()->json(['message' => 'FAQ deleted.']);
    }

    private function validated(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'question_en' => [$updating ? 'sometimes' : 'required', 'string', 'max:255'],
            'question_my' => ['nullable', 'string', 'max:255'],
            'answer_en' => [$updating ? 'sometimes' : 'required', 'string', 'max:5000'],
            'answer_my' => ['nullable', 'string', 'max:5000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }
}
