<?php

use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Customer\MembershipController;
use App\Http\Controllers\SettingsController;
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
