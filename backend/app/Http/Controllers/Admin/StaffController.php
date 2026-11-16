<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class StaffController extends Controller
{
    private const PORTAL_ROLES = ['admin', 'staff'];

    public function index(Request $request): JsonResponse
    {
        $query = User::query()
            ->whereIn('role', self::PORTAL_ROLES)
            ->orderByRaw("CASE role WHEN 'admin' THEN 0 ELSE 1 END")
            ->orderBy('name');

        if ($role = trim((string) $request->string('role'))) {
            if (in_array($role, self::PORTAL_ROLES, true)) {
                $query->where('role', $role);
            }
        }

        if ($search = $request->string('search')->trim()->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        return response()->json([
            'staff' => $query->paginate((int) $request->integer('per_page', 20)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30', 'unique:users,phone'],
            'password' => ['required', Password::min(8)],
            'role' => ['required', Rule::in(self::PORTAL_ROLES)],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'password' => $data['password'],
            'role' => $data['role'],
            'tier' => 'Bronze',
        ]);

        AuditService::log(
            $request->user(),
            'portal_user_created',
            "Portal account created: {$user->name} ({$user->role})",
            $user,
            ['email' => $user->email, 'role' => $user->role],
            $request,
        );

        return response()->json([
            'message' => 'Portal account created.',
            'staff' => $user,
        ], 201);
    }

    public function update(Request $request, User $staff): JsonResponse
    {
        $this->assertPortalUser($staff);

        $data = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'email' => ['sometimes', 'required', 'email', Rule::unique('users', 'email')->ignore($staff->id)],
            'phone' => ['sometimes', 'required', 'string', 'max:30', Rule::unique('users', 'phone')->ignore($staff->id)],
            'password' => ['nullable', Password::min(8)],
            'role' => ['sometimes', 'required', Rule::in(self::PORTAL_ROLES)],
        ]);

        if (empty($data['password'])) {
            unset($data['password']);
        }

        if (array_key_exists('role', $data) && $data['role'] !== $staff->role) {
            if ((int) $request->user()->id === (int) $staff->id) {
                throw ValidationException::withMessages([
                    'role' => ['You cannot change your own role.'],
                ]);
            }

            if ($staff->role === 'admin' && $data['role'] !== 'admin') {
                $this->assertNotLastAdmin($staff);
            }
        }

        $staff->update($data);

        AuditService::log(
            $request->user(),
            'portal_user_updated',
            "Portal account updated: {$staff->name} ({$staff->role})",
            $staff,
            ['role' => $staff->role],
            $request,
        );

        return response()->json([
            'message' => 'Portal account updated.',
            'staff' => $staff->fresh(),
        ]);
    }

    public function destroy(Request $request, User $staff): JsonResponse
    {
        $this->assertPortalUser($staff);

        if ((int) $request->user()->id === (int) $staff->id) {
            throw ValidationException::withMessages([
                'staff' => ['You cannot delete your own account here.'],
            ]);
        }

        if ($staff->role === 'admin') {
            $this->assertNotLastAdmin($staff);
        }

        $name = $staff->name;
        $role = $staff->role;
        $staff->tokens()->delete();
        $staff->delete();

        AuditService::log(
            $request->user(),
            'portal_user_deleted',
            "Portal account deleted: {$name} ({$role})",
            null,
            ['name' => $name, 'role' => $role],
            $request,
        );

        return response()->json(['message' => 'Portal account deleted.']);
    }

    private function assertPortalUser(User $user): void
    {
        if (! in_array($user->role, self::PORTAL_ROLES, true)) {
            abort(404);
        }
    }

    private function assertNotLastAdmin(User $user): void
    {
        $adminCount = User::query()->where('role', 'admin')->count();
        if ($adminCount <= 1) {
            throw ValidationException::withMessages([
                'role' => ['The last admin account cannot be removed or demoted.'],
            ]);
        }
    }
}
