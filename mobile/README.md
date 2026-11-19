# 29 Gold Membership — Flutter app

Native Android / iOS member app for the 29 Gold & Jewellery loyalty program. Same customer surface as the website (`/app`), talking to the Laravel Sanctum API.

## Features

- Landing, sign in, sign up, forgot password (email OTP)
- Membership home (Figma-aligned): greeting, VIP gradient card, QR, next-tier progress, quick actions
- Spin wheel (credits, promos, rewards) + guest spin deep link
- Purchase history & receipts
- Points activity
- Rewards catalog & redemptions
- Missions, community referrals, product reviews
- **Support chat** (same `/api/chat/*` as web inbox)
- Notifications, settings (profile, avatar, password, theme, EN/MY)
- FAQ, about, help & feedback
- Guest spin: `/guest/:token`

Admin/staff portals stay on the web app.

## API (default = production)

By default the app uses the **deployed** membership API and database:

| | |
|---|---|
| Origin | `https://loyalty.29jewellery.com` |
| API | `https://loyalty.29jewellery.com/api` |

No local Laravel / MySQL required for day-to-day testing.

### Override to local backend (optional)

```bash
# Android emulator → host machine
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8000/api --dart-define=API_ORIGIN=http://10.0.2.2:8000

# Physical device on LAN
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000/api --dart-define=API_ORIGIN=http://192.168.1.20:8000
```

## Run

```bash
cd mobile
flutter pub get
flutter run
```

Use a real customer account from production, or a demo account if still seeded on the server.

## Project layout

```
lib/
  main.dart / app.dart
  core/          # API, config (prod default), theme, storage
  models/
  providers/     # auth, language, theme, notifications (+ chat unread)
  l10n/
  router/
  screens/       # member + chat screens
  widgets/
```

## Build release

```bash
flutter build apk --release
flutter build ios --release
```
