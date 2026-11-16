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
- **Tier points (status):** sum of eligible earns in a **rolling 365-day window**; redemptions do not reduce tier points
- **Activity expiry:** wallet does not expire if the member purchases or redeems within 12 months (`loyalty:expire-inactive`)
- **Base earn:** 1 point / 10,000 MMK, then × tier multiplier (and active promotions)

## Tiers (rolling tier points)
| Tier | Min tier points (365d) | Multiplier |
|------|------------------------|------------|
| Bronze | 0 | 1.0x |
| Silver | 500 | 1.2x |
| Gold | 2,000 | 1.5x |
| Platinum | 6,000 | 2.0x |
| Diamond | 15,000 | 2.5x |

No automatic % bill discount. Value comes from redeeming points and tier multipliers/perks.

## Admin Panel
- Dashboard — members, purchases, revenue, points issued, tier distribution (Bronze→Diamond)
- Customers — Customer ID, wallet points, tier points, tier
- Purchases — record amount + optional points redemption; updates ledger, wallet, and tier
- Settings — branding, theme, language, profile

## Customer App
- Membership status (wallet + 12-month tier points + multiplier)
- Points activity ledger
- Rewards catalog redemptions
- Missions & login streaks
- Product reviews (bonus points)
- Purchase history
- Settings

## Marketing / Landing
- Brand logo + how it works + Bronze→Diamond multipliers
