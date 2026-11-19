<?php

namespace App\Providers;

use App\Models\User;
use Dedoc\Scramble\Scramble;
use Dedoc\Scramble\Support\Generator\OpenApi;
use Dedoc\Scramble\Support\Generator\SecurityScheme;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(8)->by($request->ip());
        });

        Broadcast::routes(['middleware' => ['auth:sanctum'], 'prefix' => 'api']);

        Route::bind('staff', function (string $value) {
            return User::whereIn('role', ['admin', 'staff'])->findOrFail($value);
        });

        Scramble::configure()
            ->withDocumentTransformers(function (OpenApi $openApi) {
                $openApi->info->title = '29 Gold & Jewellery — Loyalty API';
                $openApi->info->description = 'Auto-generated OpenAPI from Laravel routes (Sanctum bearer).';
                $openApi->secure(SecurityScheme::http('bearer', 'Sanctum'));
            });
    }
}
