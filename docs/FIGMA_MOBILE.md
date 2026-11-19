# Figma — Loyalty mobile UI (member + admin)

Design file for native apps sharing the **same Laravel / Sanctum backend** as the website.

| | |
|---|---|
| **Figma** | [29 Loyalty — Member Mobile App](https://www.figma.com/design/8GA955uoO0puvX1mCtdJ51) |
| **Page 01** | Member App (customer) |
| **Page 02** | Admin App (admin / staff) |
| **Code** | Member → `mobile/` Flutter · Admin → design target for a future staff app (APIs already exist on web) |

---

## Page 01 — Member App

Bottom nav: **Home · Spin · History · Rewards · More** (matches `mobile/lib/router/app_router.dart`).

| Frame | Purpose | API |
|-------|---------|-----|
| 00 — Member cover | Scope overview | — |
| 01 — Sign in | Auth + EN/Myanmar | `POST /auth/login` |
| 02 — Membership | Greeting, VIP card, QR, next tier, quick actions | `GET /customer/membership` |
| 03 — Spin wheel | Wheel, confirm spin, prize to collect | `GET /spinwheel/state`, `POST /spinwheel/spin` |
| 04 — Rewards | Balance + redeem rows | `GET /customer/rewards`, `POST …/redeem` |
| 05 — History | Purchase list with earn | `GET /customer/purchases` |
| 06 — More | Profile + secondary routes | — |
| 07 — Missions | Progress bars + bonuses | `GET /customer/missions` |
| 08 — Support chat | Thread + composer | `/chat/*` |

Visual system: primary `#3B82F6`, soft blue background `#F3F7FF`, rounded 28px phone frames, gradient membership card, tab bar with active state.

---

## Page 02 — Admin App

Bottom nav: **Home · Sales · Members · Inbox · More**  
(staff day-ops first; admin-only tools under More).

| Frame | Purpose | API |
|-------|---------|-----|
| 00 — Admin cover | Portal scope | — |
| A01 — Dashboard | KPIs, pending alert, quick actions | `GET /admin/dashboard` |
| A02 — Customers | Search, tiers, points, add | `GET/POST /admin/customers` |
| A03 — New purchase | Amount, product type, redeem points, grant spins, earn preview | `POST /admin/purchases` |
| A04 — Redemptions | Pending filters, mark collected / cancel | `GET/PUT /admin/redemptions` |
| A05 — Support inbox | Conversation list + unread | `/chat/*` |
| A06 — Spin ops | Credits, claim by SPIN ref, config links | `/spinwheel/admin/*` |
| A07 — Admin more | Catalog, promos, missions, referrals, win-back, staff, logs, settings | `/admin/*` |

Staff vs admin: same mobile shell; hide Manage → Staff / Settings / Spin config / Win-back for staff role (same as web RBAC).

---

## Implementation notes

1. **Member Flutter** already exists under `mobile/` — use these frames to polish UI parity.
2. **Admin mobile** is design-only for now; wire to existing `/api/admin` + Sanctum staff/admin tokens.
3. Prefer real QR / brand logo assets next; replace placeholder blocks when assets are uploaded to the file.
