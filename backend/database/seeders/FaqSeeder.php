<?php

namespace Database\Seeders;

use App\Models\Faq;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            [
                'question_en' => 'How do I earn points?',
                'question_my' => 'ပွိုင့် ဘယ်လို ရမလဲ?',
                'answer_en' => 'You earn points with every purchase. Tier multipliers increase your earn rate.',
                'answer_my' => 'ဝယ်ယူမှုတိုင်းတွင် ပွိုင့်ရရှိသည်။ အဆင့် မြှောက်ကိန်းက ရရှိနှုန်း တိုးစေသည်။',
                'sort_order' => 1,
            ],
            [
                'question_en' => 'What is the difference between redeemable and tier points?',
                'question_my' => 'ရွေးနှုတ်ပွိုင့်နှင့် အဆင့်ပွိုင့် ကွာခြားချက်?',
                'answer_en' => 'Redeemable points can be spent. Tier points from the last 12 months set your membership status.',
                'answer_my' => 'ရွေးနှုတ်ပွိုင့်ကို သုံးနိုင်သည်။ လွန်ခဲ့သော ၁၂ လ အဆင့်ပွိုင့်က အဖွဲ့ဝင်အဆင့် သတ်မှတ်သည်။',
                'sort_order' => 2,
            ],
            [
                'question_en' => 'How do I redeem rewards?',
                'question_my' => 'ဆုများကို ဘယ်လို ရွေးနှုတ်မလဲ?',
                'answer_en' => 'Open Rewards, choose an item you can afford, and redeem with your wallet balance.',
                'answer_my' => 'Rewards သို့သွား၍ လက်ကျန်နှင့် ကိုက်သော ဆုကို ရွေးနှုတ်ပါ။',
                'sort_order' => 3,
            ],
            [
                'question_en' => 'How do I change my password?',
                'question_my' => 'စကားဝှက် ဘယ်လို ပြောင်းမလဲ?',
                'answer_en' => 'Go to Settings → Account management → Change password, or use Forgot password if you are signed out.',
                'answer_my' => 'Settings → Account management → Change password သို့မဟုတ် Forgot password ကို သုံးပါ။',
                'sort_order' => 4,
            ],
        ];

        foreach ($items as $item) {
            Faq::query()->updateOrCreate(
                ['question_en' => $item['question_en']],
                array_merge($item, ['is_active' => true]),
            );
        }
    }
}
