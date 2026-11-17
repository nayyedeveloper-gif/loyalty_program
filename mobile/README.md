# 29 Gold Membership — Flutter app

Native Android / iOS member app for the 29 Gold & Jewellery loyalty program. It covers the same customer surface as the website (`/app`), talking to the existing Laravel Sanctum API.

## Features

- Landing, sign in, sign up, forgot password (email OTP)
- Membership home with QR (`29G:{customer_code}`), tier, points, expiry
- Spin wheel (credits, promos, rewards) + guest spin deep link
- Purchase history & receipts
- Points activity (filters)
- Rewards catalog & redemptions
- Missions, community referrals, product reviews
- Notifications, settings (profile, avatar, password, theme, EN/MY)
- FAQ, about, help & feedback
- Guest spin: `/guest/:token`

Admin/staff portals stay on the web app.

## Prerequisites

- [Flutter](https://docs.flutter.dev/get-started/install) 3.50+ (Dart 3.14+)
- Running backend: `cd backend && php artisan serve` (port 8000)
- Android Studio emulator / device, or Xcode for iOS

## Configure API URL

Defaults (Android emulator → host machine):

| Flag | Default |
|------|---------|
| `API_BASE_URL` | `http://10.0.2.2:8000/api` |
| `API_ORIGIN` | `http://10.0.2.2:8000` |

Examples:

```bash
# Physical Android device on same Wi‑Fi (use your PC LAN IP)
flutter run --dart-define=API_BASE_URL=http://192.168.1.20:8000/api --dart-define=API_ORIGIN=http://192.168.1.20:8000

# iOS simulator (localhost is the Mac)
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:8000/api --dart-define=API_ORIGIN=http://127.0.0.1:8000
```

Ensure Laravel CORS / Sanctum accepts the mobile origin, and that `php artisan serve` is reachable from the device.

## Run

```bash
cd mobile
flutter pub get
flutter run
```

Demo customer: `customer@29gold.com` / `password123`

## Project layout

```
lib/
  main.dart / app.dart
  core/          # API, config, theme, storage
  models/
  providers/     # auth, language, theme, notifications
  l10n/
  router/
  screens/       # all member screens
  widgets/
```

## Build release

```bash
flutter build apk --release
flutter build ios --release
```
