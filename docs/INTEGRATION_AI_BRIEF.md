# AI Integration Brief — Port Spinwheel Into Another App

**Purpose of this document:** Give an AI coding agent (or engineer) a complete, non-lossy checklist to integrate the **29 Jewellery Spinwheel Management System** into another application correctly.  
**Source repo:** this monorepo (`backend/` Laravel API + `frontend/` React SPA).  
**Companion docs:** `docs/SYSTEM_ANALYSIS_REPORT.md`, `UPDATE.md`, `docs/DEPLOYMENT.md`, root `README.md`.

---

## Host implementation notes (loyalty_program — Mode C)

This loyalty app integrated Spinwheel as a **Mode C deep merge**:

| Item | Host decision |
|------|----------------|
| Auth | Laravel Sanctum (existing). **No** `access_sessions`, demo `/enter/{role}`, or username identify. |
| Users | Existing loyalty `users` + admin customer CRUD. **No** spinwheel `AdminUsers` module. |
| Dual browser sessions | **Waived** — one Sanctum token per login; admin/customer use separate accounts. |
| API prefix | `/api/spinwheel/...` |
| SPA routes | `/app/spinwheel`, `/admin/spinwheel/*`, public `/guest/:token` |
| Module folders | `backend/app/Http/Controllers/Spinwheel`, `frontend/src/modules/spinwheel` |
| Grant spins | `SpinGrantService` + admin grant UI; thin hooks: registration, login promo settings, purchase `grant_spins` |
| Guest links | Kept fully; independent of loyalty points |
| PointsEngine | Untouched |

Domain rules from Sections 1.2 / 5 (weighted pick, idempotency, FIFO usages, claims, guest lifecycle, live sync, branding, audit, media) are required and implemented.

---

## 0. Instructions to the integrating AI (read first)

You are integrating an existing, working Spinwheel product into a **host application**. Your job is to **carry over all features and business rules**, not to redesign the product.

### Mandatory rules

1. **Do not drop features.** If something exists in the source (guest links, live wheel sync, dual-role sessions, staff claim, branding, idempotent spin, weighted pick), it must work in the host after integration.
2. **Preserve business logic.** Weighted randomness, server-authoritative outcomes, claim deadlines, guest reservation lifecycle, and role isolation must remain identical unless the human explicitly changes requirements.
3. **Prefer porting over rewriting.** Copy/adapt modules, migrations, routes, and UI flows. Only rewrite when the host stack forces it (e.g. host is not Laravel/React).
4. **Ask only when blocked** by host constraints (auth system, routing base path, DB vendor). Do not invent a new auth protocol or spin algorithm “for cleanliness.”
5. **Verify with a checklist** at the end (Section 10). Do not mark done until every checkbox passes or is explicitly waived by the human.
6. **Read the source before coding:** `backend/routes/api.php`, `SpinEngine.php`, models, controllers, `frontend/src/app/App.tsx`, `frontend/src/lib/api.ts`, `useLiveWheelSync.ts`, admin/customer/guest pages.

### Integration modes (choose based on host)

| Mode | When to use | Approach |
|------|-------------|----------|
| **A. Mount as module** | Host is Laravel + React/Vite (or similar SPA) | Port API module + SPA routes under a prefix (e.g. `/spinwheel`, `/api/spinwheel`) |
| **B. Sidecar service** | Host is different stack | Keep Spinwheel API as service; embed SPA or iframe; share SSO later |
| **C. Deep merge** | Host already has users/auth/ERP nav | Map host users → spin roles; replace demo admin/customer entry with host auth; keep spin domain intact |

Default recommendation: **Mode A or C**. Mode B only if the host cannot run Laravel PHP.

---

## 1. Product features that MUST be carried over

### 1.1 Personas

| Persona | Capabilities |
|---------|----------------|
| **Admin / staff** | Dashboard, wheel & prize CRUD + branding (title/logo), user management, grant/adjust spins, guest link generate/list/revoke, reward search + staff claim |
| **Customer** | Identify/login, view wheel, spin with granted credits, view rewards & collection codes, help text, live wheel updates |
| **Guest** | Open one-spin link, activate/reserve, spin once, see result/reference, handle used/expired/revoked/in-use states |

### 1.2 Domain features (non-negotiable)

- [ ] Weighted prize selection (server-side)
- [ ] Idempotent spin (client key → same result on retry)
- [ ] Spin usage credits with expiry + FIFO consume
- [ ] Reward codes (`RW-…`) and guest references (`GS-…`)
- [ ] Claim deadlines + staff-only claim (customer never self-claims)
- [ ] Guest entitlement lifecycle: `available → reserved → used` (+ `expired` / `revoked`)
- [ ] Many concurrent guest links (no global single-active limit)
- [ ] Published wheel + active segments only for public spin
- [ ] Wheel branding: `brand_title`, `page_title`, `logo`, `help_text`
- [ ] Content revision bump on prize create/update/delete/reorder
- [ ] Live wheel sync for customer/guest (poll revision; pause while spinning)
- [ ] Dual-role browser sessions (admin + customer tokens do not overwrite each other)
- [ ] Admin audit logging for sensitive mutations
- [ ] Media uploads for logo + prize images (public disk + URL resolution)
- [ ] Guest link URLs built from **frontend** base URL, not API URL

### 1.3 UX surfaces to preserve

- Login / entry screen (customer + admin entry; optional continue-as)
- Customer wheel + rewards tabs
- Guest status cards (loading, reserved, used, expired, revoked, already in use)
- Admin ERP-style shell: sidebar, modules, tables, wheel editor, guest link manager, reward verification
- Animated wheel that lands on **server-provided** segment index

---

## 2. Source inventory (what to copy)

### 2.1 Backend (Laravel)

```
backend/app/Services/SpinEngine.php          # CORE — port intact
backend/app/Http/Middleware/EnsureRoleSession.php
backend/app/Http/Controllers/Api/
  AuthController.php
  CustomerAccessController.php
  GuestSpinController.php
  SpinController.php
  WheelController.php
  UserController.php
backend/app/Models/
  AccessSession.php
  AdminAuditLog.php
  GuestSpinEntitlement.php
  SpinResult.php
  SpinUsage.php
  User.php                    # merge carefully with host User
  Wheel.php
  WheelSegment.php
backend/config/spinwheel.php
backend/routes/api.php        # merge under prefix if needed
backend/database/migrations/  # all spin-related migrations
backend/database/seeders/SpinWheelSeeder.php
backend/tests/Feature/        # GuestSpinTest, WheelLiveSyncTest, CustomerAccessTest, etc.
```

### 2.2 Frontend (React)

```
frontend/src/app/App.tsx
frontend/src/lib/api.ts
frontend/src/lib/useLiveWheelSync.ts
frontend/src/types/models.ts
frontend/src/types/admin.ts
frontend/src/components/SpinWheel.tsx
frontend/src/components/BrandMark.tsx
frontend/src/components/Title.tsx
frontend/src/components/ui.tsx
frontend/src/pages/auth/LoginPage.tsx
frontend/src/pages/customer/CustomerPage.tsx
frontend/src/pages/guest/GuestPage.tsx
frontend/src/pages/admin/*    # Layout + all module pages
frontend/src/styles/app.css   # or extract spin/admin tokens into host design system
frontend/src/styles/fonts.css
frontend/public/brand-29.png  # or replace with host brand asset
```

### 2.3 Config / env keys to carry

```
DB_*                          # host DB
FRONTEND_URL                  # public SPA origin for guest links
VITE_API_BASE_URL             # SPA → API
SPIN_CUSTOMER_SESSION_HOURS
SPIN_ADMIN_SESSION_HOURS
SPIN_GUEST_LINK_HOURS
SPIN_GUEST_RESERVATION_MINUTES
SPIN_ALLOW_DEMO_ADMIN_ENTRY   # false when using host auth
DB_CONNECT_TIMEOUT            # optional fail-fast
FILESYSTEM / public disk + php artisan storage:link
```

---

## 3. Data model requirements

Ensure these tables (or equivalents) exist with the same semantics:

| Table | Purpose |
|-------|---------|
| `users` | `role` in `admin\|customer\|guest`, optional `username` |
| `access_sessions` | hashed Bearer tokens per role |
| `wheels` | campaign wheel + branding + `version` + status |
| `wheel_segments` | prizes, weights, claim rules, images |
| `spin_usages` | consumable credits |
| `spin_results` | outcomes, reward codes, claim state, guest flags |
| `guest_spin_entitlements` | one-spin links |
| `admin_audit_logs` | staff action trail |
| `cache` / `sessions` / `jobs` | if host uses DB drivers like source |

**Guest pool user:** system must be able to create/use a synthetic guest user (source uses email like `guest-pool@spinwheel.local`) for guest spin ownership. Reporting must use `is_guest` / `guest_reference`, not that user’s identity.

**Migrations:** Port all spin migrations from `backend/database/migrations/` that create/alter the tables above. Resolve conflicts with host `users` carefully (add columns; do not wipe host users).

---

## 4. API contract (must remain callable)

Keep these endpoints (prefix OK, e.g. `/api/spinwheel/...`, but behavior identical).

### Public / lightly throttled

| Method | Path | Notes |
|--------|------|-------|
| POST | `/customer/identify` | username → customer session |
| GET | `/enter/{role}` | demo admin only; disable in production host |
| POST | `/guest/{token}/activate` | reserve/restore guest session |
| GET | `/guest/session` | guest state |
| POST | `/guest/spin` | one spin with session + idempotency key |
| GET | `/wheel/published` | full published wheel + active segments |
| GET | `/wheel/published/revision` | live-sync signature |

### Customer (`role.session:customer`)

| Method | Path |
|--------|------|
| GET | `/customer/me` |
| POST | `/customer/logout` |
| GET | `/customers/{user}/state` |
| POST | `/customers/{user}/spin` |
| GET | `/customers/{user}/spins/by-key/{key}` |
| GET | `/customers/{user}/rewards` |
| GET | `/customers/{user}/rewards/{result}` |

### Admin (`role.session:admin`)

| Method | Path |
|--------|------|
| Users CRUD | `/admin/users…` |
| Wheels / segments | `/wheels…`, `/segments…` |
| Usages | `/usages`, `/usages/grant`, `/usages/{usage}` |
| Rewards | `/admin/rewards…`, `…/claim` |
| Guest spins | `/admin/guest-spins…`, `…/revoke` |
| Logout | `/admin/logout` |

**Auth header:** `Authorization: Bearer <plain_token>` (or `X-Access-Token`).

---

## 5. Business rules you must not break

Copy these into the host; treat as acceptance criteria.

1. **Server picks the prize.** UI animates to `segment_index` from API. Never pick the prize only on the client.
2. **Weights:** `random_int(1, sum(active weights))`; reject spin if total weight ≤ 0.
3. **Idempotency:** same `idempotency_key` returns the same `SpinResult` (`recovered: true`).
4. **Usage FIFO:** consume earliest-expiring `available` usage inside a DB transaction with row lock.
5. **Used usages immutable.**
6. **Claims:** only staff claim endpoints mark collected; optional override for expired.
7. **Guest activate:**
   - `available` → reserve + mint `guest_session_token`
   - same session → restore
   - other session while reserved → **409** “already in use”
   - used/expired/revoked → clear status payloads (no silent reuse)
8. **Guest links:** many can be reserved at once; each link is independent.
9. **Frontend guest activate:** dedupe in-flight activate (Strict Mode double-mount) + reclaim if sibling reserved first — or equivalent race-safe pattern.
10. **Live sync:** prize mutations call `bumpContentRevision()`; clients poll revision and refresh wheel; **do not** refresh mid-spin animation.
11. **Dual sessions:** never store one shared token for admin and customer in the same browser origin.
12. **Guest URLs:** `{FRONTEND_URL}/guest/{token}` — never API host `:8000`.
13. **Last admin:** cannot demote/delete the sole admin user.
14. **Published wheel:** public spin uses latest published (or preferred published id when set on usage/entitlement).

---

## 6. Host auth integration (Mode C)

If the host already has login:

1. **Disable** `SPIN_ALLOW_DEMO_ADMIN_ENTRY` / remove `/enter/admin` from public use.
2. Map host staff → spin `admin` AccessSession (or replace AccessSession with host tokens **but keep role checks** on every admin route).
3. Map host customers → spin `customer` (by username/id). Prefer issuing spin AccessSessions from host login callback so existing middleware keeps working.
4. Do **not** remove guest capability URLs unless product owner drops offline promotions.
5. Keep customer `{user}` route ownership checks (no IDOR).

If you replace `EnsureRoleSession`, re-implement equivalent guarantees before deleting it.

---

## 7. Frontend integration steps

1. Mount routes:
   - `/spinwheel` or `/` entry
   - `/spinwheel/customer`
   - `/spinwheel/guest/:token`
   - `/spinwheel/admin/*`
2. Port `api.ts` dual-role storage keys (or namespace them, e.g. `host_spin_access_token_admin`).
3. Port `SpinWheel`, customer/guest/admin pages, and `useLiveWheelSync`.
4. Wire media URLs to host API/storage base.
5. Align chrome with host design system **without removing modules**. Visual restyle is OK; feature removal is not.
6. Ensure guest route is publicly reachable (no host auth wall).
7. Keep confirm-spin, pending idempotency keys in `localStorage`, and by-key recovery.

---

## 8. Backend integration steps

1. Add `config/spinwheel.php` and env keys.
2. Register middleware alias `role.session`.
3. Merge routes (prefer prefix `/api/spinwheel` if host already uses `/api`).
4. Port `SpinEngine` unchanged first; optimize later only with tests green.
5. Port models/controllers; merge `User` carefully.
6. Run migrations; `storage:link`; seed optional demo data only in non-prod.
7. CORS: allow host SPA origin; set `FRONTEND_URL` to the public SPA URL that serves `/guest/:token`.
8. Ensure `CACHE_STORE` / `SESSION_DRIVER` work with host DB (or switch to file/redis intentionally).

---

## 9. Common failure modes (fix these)

| Symptom | Likely cause |
|---------|----------------|
| Admin dies when customer opens another tab | Shared token storage — use per-role keys |
| Guest link “already in use” on first open | Double activate race — dedupe/reclaim |
| Guest link opens API `:8000` | `FRONTEND_URL` wrong |
| Images 404 | Missing `storage:link` or media base URL |
| Customer wheel stale after admin edit | Missing revision endpoint / bump / live sync hook |
| Spin feels random on client | Client ignoring server `segment_index` |
| Duplicate prizes on retry | Missing idempotency |
| “Session expired or invalid” | Wrong role token on route, or middleware role mismatch |
| Slow/hanging API | DB down + DB cache/session — ensure DB up / fail-fast timeout |
| Guest rewards attributed to wrong person | Ignoring `is_guest` / using pool user as identity |

---

## 10. Acceptance checklist (must pass)

### Auth & sessions
- [ ] Admin can use admin APIs only with admin session
- [ ] Customer cannot access another customer’s state/spin/rewards
- [ ] Admin + customer work in two tabs simultaneously
- [ ] Demo admin entry disabled **or** explicitly approved for this host environment

### Wheel & admin
- [ ] Create/edit/delete/reorder prizes
- [ ] Upload logo + prize images; URLs resolve in SPA
- [ ] Brand title/page title/help text show on customer + guest + login
- [ ] Publish/pause behavior respected

### Customer
- [ ] Identify, load state, spin, see result
- [ ] Idempotent retry recovers same reward
- [ ] Rewards list + detail + collection code
- [ ] Wheel updates live after admin prize delete (no full page refresh; not mid-spin)

### Guest
- [ ] Generate link from admin; URL uses frontend origin
- [ ] First activate works without false conflict
- [ ] Second browser gets “already in use” while reserved
- [ ] One successful spin; second spin rejected
- [ ] Revoke / expiry / used states render correctly
- [ ] Many links can be active/reserved at once

### Claims
- [ ] Staff can search and claim by reward code / guest reference
- [ ] Customer cannot mark claimed themselves
- [ ] Expired claim behavior + optional staff override if present in source

### Quality
- [ ] Port or re-run backend feature tests (`GuestSpinTest`, `WheelLiveSyncTest`, customer access, spin claim)
- [ ] No secrets committed (`.env`)
- [ ] Document host-specific base paths and env in host README

---

## 11. Suggested implementation order

1. Schema/migrations + models + `SpinEngine`
2. Auth middleware + identify/enter + dual-session client storage
3. Wheel admin CRUD + media
4. Grant spins + customer state/spin/rewards UI
5. Guest entitlements + guest page + link URL config
6. Staff claim / reward verification
7. Live wheel sync
8. Branding/shell polish inside host nav
9. Full acceptance checklist + tests

---

## 12. Definition of done

Integration is **done** only when:

1. All Section 1 features work in the host app,  
2. Section 10 checklist is complete (or waived in writing),  
3. Guest + customer + admin paths are documented for the host’s real URLs,  
4. Production-unsafe demo admin entry is disabled if the host is customer-facing.

If tradeoffs are required, list them explicitly (feature → reason → owner approval) before shipping.

---

## 13. Quick reference — source of truth files

| Topic | Read this first |
|-------|-----------------|
| Full system analysis | `docs/SYSTEM_ANALYSIS_REPORT.md` |
| Recent fixes | `UPDATE.md` |
| Routes | `backend/routes/api.php` |
| Spin rules | `backend/app/Services/SpinEngine.php` |
| Guest lifecycle | `backend/app/Http/Controllers/Api/GuestSpinController.php` |
| Live sync | `WheelController::publishedRevision`, `frontend/src/lib/useLiveWheelSync.ts` |
| Dual sessions | `frontend/src/lib/api.ts`, `frontend/src/app/App.tsx` |
| Deploy pitfalls | `docs/DEPLOYMENT.md` |

---

*End of integration brief. Prefer fidelity to this Spinwheel product over speculative redesign.*
