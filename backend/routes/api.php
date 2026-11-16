<?php

use App\Http\Controllers\Admin\ActivityLogController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\ExportController;
use App\Http\Controllers\Admin\ReferralController;
use App\Http\Controllers\Admin\WinbackController;
use App\Http\Controllers\Admin\FaqController as AdminFaqController;
use App\Http\Controllers\Admin\FeedbackController as AdminFeedbackController;
use App\Http\Controllers\Admin\LedgerController;
use App\Http\Controllers\Admin\MissionController;
use App\Http\Controllers\Admin\PromotionController;
use App\Http\Controllers\Admin\PurchaseController;
use App\Http\Controllers\Admin\RedemptionController;
use App\Http\Controllers\Admin\RewardController;
use App\Http\Controllers\Admin\StaffController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\Customer\FeedbackController as CustomerFeedbackController;
use App\Http\Controllers\Customer\MembershipController;
use App\Http\Controllers\FaqController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SettingsController;
use Illuminate\Support\Facades\Route;

Route::get('/settings/app', [SettingsController::class, 'appSettings']);
Route::get('/faqs', [FaqController::class, 'index']);

Route::prefix('auth')->middleware('throttle:auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

Route::prefix('auth')->middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::put('/settings/profile', [SettingsController::class, 'updateProfile']);
    Route::post('/settings/avatar', [SettingsController::class, 'updateAvatar']);
    Route::delete('/settings/avatar', [SettingsController::class, 'removeAvatar']);
    Route::delete('/settings/account', [SettingsController::class, 'deleteAccount']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
});

// Shop portal: admin + staff
Route::middleware(['auth:sanctum', 'staff'])->prefix('admin')->group(function () {
    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/{customer}', [CustomerController::class, 'show']);
    Route::put('/customers/{customer}', [CustomerController::class, 'update']);

    Route::get('/purchases', [PurchaseController::class, 'index']);
    Route::post('/purchases', [PurchaseController::class, 'store']);
    Route::get('/purchases/{purchase}', [PurchaseController::class, 'show']);
    Route::put('/purchases/{purchase}', [PurchaseController::class, 'update']);
    Route::post('/purchases/{purchase}/cancel', [PurchaseController::class, 'cancel']);

    Route::get('/redemptions', [RedemptionController::class, 'index']);
    Route::put('/redemptions/{redemption}', [RedemptionController::class, 'update']);

    Route::get('/ledger', [LedgerController::class, 'index']);
});

// Admin-only management
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::delete('/customers/{customer}', [CustomerController::class, 'destroy']);
    Route::delete('/purchases/{purchase}', [PurchaseController::class, 'destroy']);

    Route::apiResource('rewards', RewardController::class)->except(['show']);
    Route::post('/rewards/{reward}/image', [RewardController::class, 'updateImage']);
    Route::delete('/rewards/{reward}/image', [RewardController::class, 'removeImage']);
    Route::apiResource('promotions', PromotionController::class)->except(['show']);
    Route::apiResource('missions', MissionController::class)->except(['show']);
    Route::apiResource('faqs', AdminFaqController::class)->except(['show']);
    Route::apiResource('staff', StaffController::class)->except(['show']);

    Route::post('/ledger/adjust', [LedgerController::class, 'adjust']);
    Route::get('/feedback', [AdminFeedbackController::class, 'index']);
    Route::put('/feedback/{feedback}', [AdminFeedbackController::class, 'update']);
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);

    Route::get('/export/customers', [ExportController::class, 'customers']);
    Route::get('/export/purchases', [ExportController::class, 'purchases']);
    Route::get('/export/ledger', [ExportController::class, 'ledger']);

    Route::get('/referrals', [ReferralController::class, 'index']);
    Route::get('/winback', [WinbackController::class, 'index']);
    Route::post('/winback/grant', [WinbackController::class, 'grant']);

    Route::put('/settings/app', [SettingsController::class, 'updateAppSettings']);
    Route::post('/settings/logo', [SettingsController::class, 'updateAppLogo']);
    Route::delete('/settings/logo', [SettingsController::class, 'removeAppLogo']);
});

Route::middleware(['auth:sanctum', 'customer'])->prefix('customer')->group(function () {
    Route::get('/membership', [MembershipController::class, 'status']);
    Route::get('/purchases', [MembershipController::class, 'purchases']);
    Route::get('/purchases/{purchase}', [MembershipController::class, 'showPurchase']);
    Route::get('/ledger', [MembershipController::class, 'ledger']);
    Route::get('/rewards', [MembershipController::class, 'rewards']);
    Route::post('/rewards/redeem', [MembershipController::class, 'redeemReward']);
    Route::post('/redemptions/{redemption}/cancel', [MembershipController::class, 'cancelRedemption']);
    Route::get('/redemptions', [MembershipController::class, 'redemptions']);
    Route::get('/missions', [MembershipController::class, 'missions']);
    Route::get('/reviews', [MembershipController::class, 'reviews']);
    Route::post('/reviews', [MembershipController::class, 'storeReview']);
    Route::post('/feedback', [CustomerFeedbackController::class, 'store']);
    Route::put('/profile', [MembershipController::class, 'profile']);
});
