<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Customer\MembershipController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\Spinwheel\GuestSpinController;
use App\Http\Controllers\Spinwheel\SpinController;
use App\Http\Controllers\Spinwheel\SpinPromoController;
use App\Http\Controllers\Spinwheel\WheelController;
use Illuminate\Support\Facades\Route;

Route::get('/settings/app', [SettingsController::class, 'appSettings']);

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
    });
});

Route::middleware('auth:sanctum')->group(function () {
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::post('/settings/avatar', [SettingsController::class, 'updateAvatar']);
    Route::delete('/settings/avatar', [SettingsController::class, 'removeAvatar']);
});

Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('purchases', PurchaseController::class);
    Route::put('/settings/app', [SettingsController::class, 'updateAppSettings']);
    Route::post('/settings/logo', [SettingsController::class, 'updateAppLogo']);
    Route::delete('/settings/logo', [SettingsController::class, 'removeAppLogo']);
});

Route::middleware(['auth:sanctum', 'customer'])->prefix('customer')->group(function () {
    Route::get('/membership', [MembershipController::class, 'status']);
    Route::get('/purchases', [MembershipController::class, 'purchases']);
    Route::get('/ledger', [MembershipController::class, 'ledger']);
    Route::get('/rewards', [MembershipController::class, 'rewards']);
    Route::post('/rewards/redeem', [MembershipController::class, 'redeemReward']);
    Route::get('/missions', [MembershipController::class, 'missions']);
    Route::get('/reviews', [MembershipController::class, 'reviews']);
    Route::post('/reviews', [MembershipController::class, 'storeReview']);
    Route::put('/profile', [MembershipController::class, 'profile']);
});

/*
|--------------------------------------------------------------------------
| Spinwheel module (separate domain; shares Sanctum users)
|--------------------------------------------------------------------------
*/
Route::prefix('spinwheel')->group(function () {
    Route::get('/wheel/published', [WheelController::class, 'published']);
    Route::get('/wheel/published/revision', [WheelController::class, 'publishedRevision'])
        ->middleware('throttle:120,1');

    Route::post('/guest/{token}/activate', [GuestSpinController::class, 'activate'])
        ->middleware('throttle:30,1')
        ->where('token', '[A-Za-z0-9]+');
    Route::get('/guest/session', [GuestSpinController::class, 'state'])
        ->middleware('throttle:60,1');
    Route::post('/guest/spin', [GuestSpinController::class, 'spin'])
        ->middleware('throttle:20,1');

    Route::middleware(['auth:sanctum', 'customer'])->group(function () {
        Route::get('/state', [SpinController::class, 'customerState']);
        Route::post('/spin', [SpinController::class, 'spin'])->middleware('throttle:30,1');
        Route::get('/spins/by-key/{key}', [SpinController::class, 'spinByKey']);
        Route::get('/rewards', [SpinController::class, 'rewards']);
        Route::get('/rewards/{result}', [SpinController::class, 'showReward']);
        Route::get('/promos/pending', [SpinPromoController::class, 'pending']);
        Route::post('/promos/{promo}/claim', [SpinPromoController::class, 'claim'])->middleware('throttle:30,1');
        Route::post('/promos/{promo}/dismiss', [SpinPromoController::class, 'dismiss'])->middleware('throttle:30,1');
    });

    Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
        Route::get('/settings', [SpinController::class, 'settings']);
        Route::put('/settings', [SpinController::class, 'updateSettings']);

        Route::get('/wheels', [WheelController::class, 'index']);
        Route::post('/wheels', [WheelController::class, 'store']);
        Route::get('/wheels/{wheel}', [WheelController::class, 'show']);
        Route::put('/wheels/{wheel}', [WheelController::class, 'update']);
        Route::post('/wheels/{wheel}', [WheelController::class, 'update']);
        Route::post('/wheels/{wheel}/segments', [WheelController::class, 'storeSegment']);
        Route::post('/wheels/{wheel}/reorder', [WheelController::class, 'reorderSegments']);

        Route::get('/segments/{segment}', [WheelController::class, 'showSegment']);
        Route::put('/segments/{segment}', [WheelController::class, 'updateSegment']);
        Route::post('/segments/{segment}', [WheelController::class, 'updateSegment']);
        Route::delete('/segments/{segment}', [WheelController::class, 'destroySegment']);
        Route::get('/stock-alerts', [WheelController::class, 'stockAlerts']);

        Route::get('/usages', [SpinController::class, 'usageIndex']);
        Route::post('/usages/grant', [SpinController::class, 'grant']);
        Route::put('/usages/{usage}', [SpinController::class, 'adjust']);

        Route::get('/promos', [SpinPromoController::class, 'index']);
        Route::post('/promos', [SpinPromoController::class, 'store']);
        Route::put('/promos/{promo}', [SpinPromoController::class, 'update']);
        Route::post('/promos/{promo}', [SpinPromoController::class, 'update']);
        Route::delete('/promos/{promo}', [SpinPromoController::class, 'destroy']);

        Route::get('/rewards', [SpinController::class, 'searchRewards']);
        Route::get('/rewards/{result}', [SpinController::class, 'showAdminReward']);
        Route::post('/rewards/{result}/claim', [SpinController::class, 'staffClaim']);

        Route::get('/guest-spins', [GuestSpinController::class, 'index']);
        Route::post('/guest-spins', [GuestSpinController::class, 'store']);
        Route::get('/guest-spins/{guest}', [GuestSpinController::class, 'show']);
        Route::post('/guest-spins/{guest}/revoke', [GuestSpinController::class, 'revoke']);
    });
});
