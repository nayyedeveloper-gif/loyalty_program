<?php

namespace App\Services;

use App\Models\Mission;
use App\Models\User;
use App\Models\UserMissionProgress;

class MissionService
{
    public static function recordPurchase(User $user, int $amountMmK): void
    {
        $missions = Mission::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->get();

        foreach ($missions as $mission) {
            $progress = UserMissionProgress::firstOrCreate(
                ['user_id' => $user->id, 'mission_id' => $mission->id],
                ['progress' => 0, 'completed' => false],
            );

            if ($progress->completed) {
                continue;
            }

            if ($mission->goal_type === 'purchase_count') {
                $progress->progress += 1;
            } elseif ($mission->goal_type === 'spend_amount') {
                $progress->progress += $amountMmK;
            } else {
                continue;
            }

            if ($progress->progress >= $mission->goal_target) {
                $progress->progress = $mission->goal_target;
                $progress->completed = true;
                $progress->completed_at = now();
                $progress->save();

                if ($mission->bonus_points > 0) {
                    PointsEngine::creditBonus(
                        $user,
                        (int) $mission->bonus_points,
                        'mission',
                        ['mission_id' => $mission->id, 'mission_code' => $mission->code],
                        tierEligible: true,
                    );
                }
                NotificationService::missionCompleted(
                    $user->fresh(),
                    (string) $mission->title,
                    (int) $mission->bonus_points,
                );
            } else {
                $progress->save();
            }
        }
    }

    public static function recordLogin(User $user): void
    {
        // Progress mirrors consecutive login_streak (one count per calendar day).
        // AuthController only calls this when a new day was counted.
        $streak = max(0, (int) $user->login_streak);

        $missions = Mission::query()
            ->where('is_active', true)
            ->where('goal_type', 'login_days')
            ->where(function ($q) {
                $q->whereNull('starts_at')->orWhere('starts_at', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('ends_at')->orWhere('ends_at', '>=', now());
            })
            ->get();

        foreach ($missions as $mission) {
            $progress = UserMissionProgress::firstOrCreate(
                ['user_id' => $user->id, 'mission_id' => $mission->id],
                ['progress' => 0, 'completed' => false],
            );
            if ($progress->completed) {
                continue;
            }

            $progress->progress = min($streak, (int) $mission->goal_target);

            if ($progress->progress >= $mission->goal_target) {
                $progress->completed = true;
                $progress->completed_at = now();
                $progress->progress = $mission->goal_target;
                $progress->save();
                if ($mission->bonus_points > 0) {
                    PointsEngine::creditBonus(
                        $user,
                        (int) $mission->bonus_points,
                        'mission',
                        ['mission_id' => $mission->id, 'mission_code' => $mission->code],
                    );
                }
                NotificationService::missionCompleted(
                    $user->fresh(),
                    (string) $mission->title,
                    (int) $mission->bonus_points,
                );
            } else {
                $progress->save();
            }
        }
    }
}
