# 29 Gold & Jewellery — Membership Program

**Brand:** 29 Gold & Jewellery  
**Backend:** PHP, Laravel + Sanctum  
**Frontend:** React, Tailwind CSS (single app, role-based routes, PWA)  
**Languages:** English + Burmese (မြန်မာ) with in-app switcher  
**Database:** MySQL (local fallback: SQLite)

## Auth (modern, minimal forms)
- Sign in — email + password (Enter submits)
- Sign up — name, email, phone, password, confirm password
- Forgot password — email OTP → reset password
- Passwords stored with Laravel hashed (bcrypt) + prepared statements via Eloquent

## Roles (RBAC)
- **Admin Portal** (`/admin`) — full CRUD
- **Customer App** (`/app`) — read-only membership & history (no customer/purchase CRUD)

## Tier (auto-upgrade by cumulative net spend, MMK)
| Tier | Min spend (MMK) | Discount |
|------|-----------------|----------|
| Silver | 0 | 0% |
| Gold | 1,000,000 | 2% |
| Platinum | 5,000,000 | 5% |
| Diamond | 15,000,000 | 8% |

Points: 1 point / 1,000 MMK net purchase

## Admin Panel
- Dashboard — members, purchases, revenue, tier distribution
- Customers CRUD — Customer ID (unique, e.g. C000001) | Name | Phone | Email | Address | Total Spent | Points | Tier
- Purchases CRUD — Product Name | Code | Type (Gold / Diamond / Jade / Ruby / Silver / Watch / Other) | Amount | Discount | Payment (Cash, Bank, KPay, WavePay, Visa/Master)
- Recording a purchase updates points + may upgrade tier
- Settings — profile photo, profile details, app branding (name/tagline), appearance, language, notifications, change password

## Customer App
- Membership status & progress to next tier
- Points balance
- Purchase history (read-only)
- Settings — profile photo, profile details, appearance, language, notifications, change password

## Marketing / Landing
- Brand logo: လူတွေချစ်တာ ၂၉ ရတနာ
- How it works (join → shop → earn points → unlock tiers)
- Tier & points description (1 pt / 1,000 MMK; Silver→Diamond)
