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
| Customer | customer@29gold.com | password123 |

OTP emails are written to `backend/storage/logs/laravel.log` in local mode. The forgot-password UI also shows `debug_otp` when `APP_ENV=local`.

## Tiers (MMK)
| Tier | Min spend | Discount |
|------|-----------|----------|
| Silver | 0 | 0% |
| Gold | 1,000,000 | 2% |
| Platinum | 5,000,000 | 5% |
| Diamond | 15,000,000 | 8% |

Points: **1 point / 1,000 MMK** net purchase.

## Spinwheel module

Integrated as a separate module sharing Sanctum users + the same DB (see `docs/INTEGRATION_AI_BRIEF.md`).

| Surface | URL |
|---------|-----|
| Customer wheel | `/app/spinwheel` |
| Admin spin tools | `/admin/spinwheel` |
| Guest one-spin link | `/guest/:token` (public) |

Backend API prefix: `/api/spinwheel`. Set `FRONTEND_URL` in `backend/.env` to the SPA origin (default `http://127.0.0.1:5173`) so guest links are correct. Run `php artisan storage:link` for prize/logo images.

Spin credits are granted via admin **Spin credits**, optional purchase `grant_spins`, and spinwheel settings (registration / login promo). Loyalty `PointsEngine` is unchanged.
