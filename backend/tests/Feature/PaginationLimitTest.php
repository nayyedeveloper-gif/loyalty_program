<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaginationLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_ledger_per_page_is_capped(): void
    {
        $customer = User::factory()->create(['role' => 'customer']);
        Sanctum::actingAs($customer);

        $response = $this->getJson('/api/customer/ledger?per_page=99999');

        $response->assertOk();
        $this->assertSame(100, $response->json('ledger.per_page'));
    }
}