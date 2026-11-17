<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\User;

class NotificationService
{
    public static function notify(User $user, string $type, string $title, ?string $body = null, array $data = []): ?AppNotification
    {
        $prefs = is_array($user->preferences) ? $user->preferences : [];
        if (($prefs['in_app_notifications'] ?? true) === false) {
            return null;
        }

        return AppNotification::create([
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'data' => $data ?: null,
        ]);
    }

    public static function pointsEarned(User $user, int $points, string $context = 'purchase'): void
    {
        if ($points <= 0) {
            return;
        }

        self::notify(
            $user,
            'points_earned',
            'You earned points!',
            "You earned {$points} points from your {$context}.",
            ['points' => $points, 'context' => $context],
        );
    }

    public static function rewardRedeemed(User $user, string $rewardName, string $code): void
    {
        self::notify(
            $user,
            'reward_redeemed',
            'Reward redeemed',
            "{$rewardName} is ready to collect. Code: {$code}",
            ['reward_name' => $rewardName, 'redemption_code' => $code],
        );
    }

    public static function tierUpgraded(User $user, string $from, string $to): void
    {
        self::notify(
            $user,
            'tier_upgrade',
            'Tier upgraded!',
            "Congratulations — you reached {$to} (from {$from}).",
            ['from' => $from, 'to' => $to],
        );
    }

    public static function birthdayBonus(User $user, int $points): void
    {
        self::notify(
            $user,
            'birthday',
            'Happy birthday!',
            "Enjoy your birthday bonus of {$points} points.",
            ['points' => $points],
        );
    }

    public static function purchaseCancelled(User $user, int $purchaseId): void
    {
        self::notify(
            $user,
            'purchase_cancelled',
            'Purchase cancelled',
            "Purchase PUR-{$purchaseId} was cancelled and related points were reversed.",
            ['purchase_id' => $purchaseId],
        );
    }

    public static function referralJoined(User $referrer, string $friendName): void
    {
        self::notify(
            $referrer,
            'referral',
            'Referral bonus',
            "{$friendName} joined with your referral code. Bonus points were added.",
            ['friend_name' => $friendName],
        );
    }

    public static function expiryReminder(User $user, int $daysLeft, int $points): void
    {
        $type = $daysLeft <= 7 ? 'expiry_reminder_7' : 'expiry_reminder_30';
        self::notify(
            $user,
            $type,
            'Your points are expiring soon!',
            "You have {$points} points that may expire in about {$daysLeft} days due to inactivity. Shop or redeem to keep your wallet active.",
            ['days_left' => $daysLeft, 'points' => $points],
        );
    }

    public static function pointsExpired(User $user, int $points): void
    {
        self::notify(
            $user,
            'points_expired',
            'Points expired',
            "{$points} points were cleared after a long period of inactivity.",
            ['points' => $points],
        );
    }

    public static function missionCompleted(User $user, string $title, int $bonusPoints): void
    {
        self::notify(
            $user,
            'mission_completed',
            'Mission completed!',
            $bonusPoints > 0
                ? "You completed \"{$title}\" and earned {$bonusPoints} bonus points."
                : "You completed \"{$title}\".",
            ['mission_title' => $title, 'bonus_points' => $bonusPoints],
        );
    }

    public static function feedbackReplied(User $user, int $feedbackId, string $subject, string $preview): void
    {
        self::notify(
            $user,
            'feedback_reply',
            'Update on your feedback',
            "29 Gold replied to \"{$subject}\": {$preview}",
            ['feedback_id' => $feedbackId, 'subject' => $subject],
        );
    }

    public static function feedbackStatusChanged(User $user, int $feedbackId, string $subject, string $status): void
    {
        $label = match ($status) {
            'in_progress' => 'in progress',
            'resolved' => 'resolved',
            'read' => 'under review',
            default => $status,
        };

        self::notify(
            $user,
            'feedback_status',
            'Feedback status updated',
            "Your feedback \"{$subject}\" is now marked as {$label}.",
            ['feedback_id' => $feedbackId, 'subject' => $subject, 'status' => $status],
        );
    }

    public static function chatMessage(
        User $user,
        int $conversationId,
        string $fromName,
        string $preview,
        bool $fromCustomer = false,
    ): void {
        // Chat stays in the messenger unread badge — no bell notifications.
    }
}
