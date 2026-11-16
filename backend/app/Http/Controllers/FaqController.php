<?php

namespace App\Http\Controllers;

use App\Models\Faq;
use Illuminate\Http\JsonResponse;

class FaqController extends Controller
{
    public function index(): JsonResponse
    {
        $faqs = Faq::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id',
                'question_en',
                'question_my',
                'answer_en',
                'answer_my',
                'sort_order',
            ]);

        return response()->json(['faqs' => $faqs]);
    }
}
