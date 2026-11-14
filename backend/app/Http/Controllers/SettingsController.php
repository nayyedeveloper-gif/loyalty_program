<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class SettingsController extends Controller
{
    public function appSettings(): JsonResponse
    {
        return response()->json([
            'settings' => AppSetting::allMapped(),
        ]);
    }

    public function updateAppSettings(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $data = $request->validate([
            'app_name' => ['required', 'string', 'max:80'],
            'app_tagline' => ['nullable', 'string', 'max:120'],
        ]);

        AppSetting::setValue('app_name', $data['app_name']);
        AppSetting::setValue('app_tagline', $data['app_tagline'] ?? '');

        return response()->json([
            'message' => 'App settings updated.',
            'settings' => AppSetting::allMapped(),
        ]);
    }

    public function updateAppLogo(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $data = $request->validate([
            'logo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $current = AppSetting::getValue('app_logo');
        if ($current && Storage::disk('public')->exists($current)) {
            Storage::disk('public')->delete($current);
        }

        $path = $data['logo']->store('branding', 'public');
        AppSetting::setValue('app_logo', $path);

        return response()->json([
            'message' => 'App logo updated.',
            'settings' => AppSetting::allMapped(),
        ]);
    }

    public function removeAppLogo(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        $current = AppSetting::getValue('app_logo');
        if ($current && Storage::disk('public')->exists($current)) {
            Storage::disk('public')->delete($current);
        }

        AppSetting::setValue('app_logo', null);

        return response()->json([
            'message' => 'App logo restored to default.',
            'settings' => AppSetting::allMapped(),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => [
                'nullable',
                'string',
                'max:30',
                Rule::unique('users', 'phone')->ignore($user->id),
            ],
            'address' => ['nullable', 'string', 'max:255'],
            'preferences' => ['nullable', 'array'],
            'preferences.email_notifications' => ['sometimes', 'boolean'],
            'preferences.purchase_alerts' => ['sometimes', 'boolean'],
        ]);

        $preferences = array_merge(
            is_array($user->preferences) ? $user->preferences : [],
            $data['preferences'] ?? []
        );

        $user->update([
            'name' => $data['name'],
            'phone' => $data['phone'] ?? $user->phone,
            'address' => $data['address'] ?? $user->address,
            'preferences' => $preferences,
        ]);

        return response()->json([
            'message' => 'Profile settings updated.',
            'user' => $user->fresh(),
        ]);
    }

    public function updateAvatar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $user = $request->user();

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $path = $data['avatar']->store('avatars', 'public');
        $user->update(['avatar' => $path]);

        return response()->json([
            'message' => 'Profile photo updated.',
            'user' => $user->fresh(),
        ]);
    }

    public function removeAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar && Storage::disk('public')->exists($user->avatar)) {
            Storage::disk('public')->delete($user->avatar);
        }

        $user->update(['avatar' => null]);

        return response()->json([
            'message' => 'Profile photo removed.',
            'user' => $user->fresh(),
        ]);
    }
}
