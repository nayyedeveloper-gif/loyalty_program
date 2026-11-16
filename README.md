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

## Tiers (MMK)
| Tier | Min spend | Discount |
|------|-----------|----------|
| Silver | 0 | 0% |
| Gold | 1,000,000 | 2% |
| Platinum | 5,000,000 | 5% |
| Diamond | 15,000,000 | 8% |

Points: **1 point / 1,000 MMK** net purchase.
