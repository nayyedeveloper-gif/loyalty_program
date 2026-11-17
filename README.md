# 29 Gold & Jewellery — Membership Program

Modern loyalty / membership app for a Myanmar jewellery shop.

- **Backend:** Laravel 12 + Sanctum (API tokens, bcrypt passwords)
- **Frontend:** React + Vite + Tailwind CSS
- **Auth:** Sign in, Sign up, Forgot password (email OTP)
- **RBAC:** Admin portal (`/admin`) · Customer app (`/app`)

## Quick start

### Backend
```bash
cd backend
php artisan serve
```

### Frontend
```bash
cd frontend
npm run dev
```

Open http://localhost:5173

## Demo accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@29gold.com | password123 |
| Staff | staff@29gold.com | password123 |
| Customer | customer@29gold.com | password123 |

OTP emails are written to `backend/storage/logs/laravel.log` in local mode. The forgot-password UI also shows `debug_otp` when `APP_ENV=local`.

## Tiers (lifetime spend, 1 lakh = 100,000 MMK)
| Tier | Spend range | Multiplier |
|------|-------------|------------|
| Care | Below 300 lakh | 1.0x |
| VIP | 300 – 500 lakh | 1.2x |
| VVIP | 500 – 1,000 lakh | 1.5x |
| CIP | Above 1,000 lakh | 2.0x |

Points: **1 point / 10,000 MMK** net purchase, then × tier multiplier.

## Spinwheel module

Integrated as a separate module sharing Sanctum users + the same DB (see `docs/INTEGRATION_AI_BRIEF.md`).

| Surface | URL |
|---------|-----|
| Customer wheel | `/app/spinwheel` |
| Admin spin tools | `/admin/spinwheel` |
| Guest one-spin link | `/guest/:token` (public) |

Backend API prefix: `/api/spinwheel`. Set `FRONTEND_URL` in `backend/.env` to the SPA origin (default `http://127.0.0.1:5173`) so guest links are correct. Run `php artisan storage:link` for prize/logo images.

Spin credits are granted via admin **Spin credits**, optional purchase `grant_spins`, and spinwheel settings (registration / login promo). Loyalty `PointsEngine` is unchanged.
