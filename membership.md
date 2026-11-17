# 29 Gold & Jewellery — Membership Program

**Brand:** 29 Gold & Jewellery  
**Backend:** PHP, Laravel + Sanctum  
**Frontend:** React, Tailwind CSS (single app, role-based routes, PWA)  
**Languages:** English + Burmese (မြန်မာ) with in-app switcher  
**Database:** MySQL (local fallback: SQLite)

## Auth
- Sign in — email + password
- Sign up — name, email, phone, password, optional referral code (signup + referrer bonuses)
- Forgot password — email OTP → reset password

## Roles (RBAC)
- **Admin Portal** (`/admin`) — full CRUD
- **Customer App** (`/app`) — membership, history, points ledger, rewards, missions, reviews

## Dual-ledger loyalty
- **Redeemable points (wallet):** spendable balance; `1 point = 1 MMK`, redeem in increments of 100 at checkout or via rewards catalog
- **Tier status:** based on **lifetime purchase spend** (lakh MMK); redemptions do not change tier
- **Activity expiry:** wallet does not expire if the member purchases or redeems within 12 months (`loyalty:expire-inactive`)
- **Base earn:** 1 point / 10,000 MMK, then × tier multiplier (and active promotions)

## Tiers (lifetime spend)
| Tier | Spend range | Multiplier |
|------|-------------|------------|
| Care | Below 300 lakh | 1.0x |
| VIP | 300 – 500 lakh | 1.2x |
| VVIP | 500 – 1,000 lakh | 1.5x |
| CIP | Above 1,000 lakh | 2.0x |

No automatic % bill discount. Value comes from redeeming points and tier multipliers/perks.

## Admin Panel
- Dashboard — members, purchases, revenue, points issued, tier distribution (Care→CIP)
- Customers — Customer ID, wallet points, total spend, tier
- Purchases — record amount + optional points redemption; updates ledger, wallet, and tier
- Settings — branding, theme, language, profile

## Customer App
- Membership status (wallet + lifetime spend tier + multiplier)
- Points activity ledger
- Rewards catalog redemptions
- Missions & login streaks
- Product reviews (bonus points)
- Purchase history
- Settings

## Marketing / Landing
- Brand logo + how it works + Care→CIP multipliers
