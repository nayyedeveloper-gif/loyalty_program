<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(FaqSeeder::class);
        $this->call(MissionSeeder::class);

        User::create([
            'name' => '29 Admin',
            'email' => 'admin@29gold.com',
            'phone' => '09111111111',
            'address' => 'Yangon Showroom',
            'role' => 'admin',
            'tier' => 'CIP',
            'password' => 'password123',
        ]);

        User::create([
            'name' => '29 Staff',
            'email' => 'staff@29gold.com',
            'phone' => '09222222222',
            'address' => 'Yangon Showroom',
            'role' => 'staff',
            'tier' => 'Care',
            'password' => 'password123',
        ]);

        // Customer names + purchase history come from Sales Entry:
        // php artisan loyalty:sync-salesentry --fresh
    }
}
