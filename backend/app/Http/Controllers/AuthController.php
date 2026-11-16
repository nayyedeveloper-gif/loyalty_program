<?php

namespace App\Http\Controllers;

use App\Mail\OtpMail;
use App\Models\LoyaltySetting;
use App\Models\PasswordOtp;
use App\Models\User;
use App\Services\MissionService;
use App\Services\PointsEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'referral_code' => ['nullable', 'string', 'max:32'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $referrer = null;
            if (! empty($data['referral_code'])) {
                $referrer = User::where('role', 'customer')
                    ->where('referral_code', strtoupper(trim($data['referral_code'])))
                    ->first();
            }

            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'password' => $data['password'],
                'role' => 'customer',
                'tier' => 'Bronze',
                'referred_by' => $referrer?->id,
                'last_activity_at' => now(),
            ]);

            PointsEngine::ensureReferralCode($user);

            $signupBonus = LoyaltySetting::getInt('signup_bonus_points', 100);
            if ($signupBonus > 0) {
                PointsEngine::creditBonus($user, $signupBonus, 'signup', [
                    'reason' => 'membership_join',
                ]);
            }

            if ($referrer) {
                $referralBonus = LoyaltySetting::getInt('referral_bonus_points', 100);
                if ($referralBonus > 0) {
                    PointsEngine::creditBonus($referrer, $referralBonus, 'referral', [
                        'referred_user_id' => $user->id,
                    ]);
                }
            }

            return $user->fresh();
        });

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'message' => 'Account created successfully.',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid email or password.'],
            ]);
        }

        if ($user->isCustomer()) {
            $today = now()->toDateString();
            $yesterday = now()->subDay()->toDateString();
            $last = optional($user->last_login_streak_date)?->toDateString();

            if ($last === $today) {
                // already counted today
            } elseif ($last === $yesterday) {
                $user->login_streak = ((int) $user->login_streak) + 1;
                $user->last_login_streak_date = $today;
            } else {
                $user->login_streak = 1;
                $user->last_login_streak_date = $today;
            }
            $user->save();

            MissionService::recordLogin($user);
        }

        $token = $user->createToken('auth')->plainTextToken;

        return response()->json([
            'message' => 'Signed in successfully.',
            'user' => $user->fresh(),
            'token' => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Signed out successfully.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => $data['password'],
        ]);

        return response()->json([
            'message' => 'Password updated successfully.',
            'user' => $user->fresh(),
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user) {
            return response()->json([
                'message' => 'If that email exists, an OTP has been sent.',
            ]);
        }

        $otp = (string) random_int(100000, 999999);

        PasswordOtp::where('email', $data['email'])->delete();

        PasswordOtp::create([
            'email' => $data['email'],
            'otp' => Hash::make($otp),
            'expires_at' => now()->addMinutes(10),
            'verified' => false,
        ]);

        Mail::to($data['email'])->send(new OtpMail($otp));

        $payload = ['message' => 'If that email exists, an OTP has been sent.'];

        if (app()->environment('local')) {
            $payload['debug_otp'] = $otp;
        }

        return response()->json($payload);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
        ]);

        $record = PasswordOtp::where('email', $data['email'])
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $record || ! Hash::check($data['otp'], $record->otp)) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid or expired OTP.'],
            ]);
        }

        $record->update(['verified' => true]);

        return response()->json(['message' => 'OTP verified. You may reset your password.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'otp' => ['required', 'string', 'size:6'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $record = PasswordOtp::where('email', $data['email'])
            ->where('verified', true)
            ->where('expires_at', '>', now())
            ->latest()
            ->first();

        if (! $record || ! Hash::check($data['otp'], $record->otp)) {
            throw ValidationException::withMessages([
                'otp' => ['OTP verification required or expired.'],
            ]);
        }

        $user = User::where('email', $data['email'])->firstOrFail();
        $user->password = $data['password'];
        $user->save();

        PasswordOtp::where('email', $data['email'])->delete();
        $user->tokens()->delete();

        return response()->json(['message' => 'Password reset successfully. Please sign in.']);
    }
}
