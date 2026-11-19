# 29 Gold & Jewellery — Membership Program

Product features, member journeys, and shop operations. This describes **what the program does**, not how it is hosted or built.

---

## Roles

| Role | Who | Access |
|------|-----|--------|
| **Customer (member)** | Shoppers with a membership account | Member app (`/app`) |
| **Staff** | Shop counter / sales team | Shop portal — customers, sales, redemptions, points, support inbox |
| **Admin** | Program owners | Full shop portal plus catalog, campaigns, spin wheel, staff accounts, and reports |

---

## Core loyalty model

### Membership tiers

Tiers are based on **lifetime spend** (total purchase value in MMK), not on points balance.

| Tier | Typical spend band (lakh MMK) | Earn multiplier |
|------|------------------------------|-----------------|
| Care | Below 300 | 1.0× |
| VIP | 300 – 500 | 1.2× |
| VVIP | 500 – 1,000 | 1.5× |
| CIP | Above 1,000 | 2.0× |

- Each tier can have **perks** (shown on the member dashboard).
- When lifetime spend crosses the next threshold, the member is **upgraded** and notified.
- The dashboard shows **progress toward the next tier** (remaining spend).

### Earning points on purchases

1. Staff (or synced sales data) records a **purchase** linked to the member.
2. **Base points** = net purchase amount ÷ earn divisor (default: **1 point per 10,000 MMK**).
3. Final earn = base × **tier multiplier** × **best matching promotion multiplier** (if any).
4. Points are added to the member’s **wallet** and logged in the points history.
5. Member is notified when points are earned.

**At checkout (in the portal):** staff can optionally apply **points as payment**: points reduce the bill by a configured rate, in fixed increments, up to the purchase total and the member’s available balance.

**Optional:** a purchase can **grant spin wheel credits** (configurable count per sale).

### Cancelling a purchase

- Staff or admin can **cancel** a sale.
- Related point earn, redeem, and bonus entries for that sale are **reversed**.
- Member spend totals and tier are recalculated; member is notified.

### Points wallet and expiry

- Members see **redeemable points**, upcoming **expiry** (driven by inactivity rules), and full **ledger** (earn, redeem, bonuses, adjustments, expiry, reversals).
- Long **inactivity** can clear points; members receive **reminders** before expiry and notice when points expire.
- Activity from shopping or redeeming helps keep the wallet active.

### Promotions (earn multipliers)

Admins define **time-bound promotions** that boost earning, for example:

- Date range (start / end)
- **Weekends only**
- **Birthdays only** (member’s date of birth)
- Specific **product types**
- Multiple promos can be active; the **highest** matching multiplier applies to a given purchase.

---

## Rewards catalog (points redemption)

### Catalog

- Admins maintain **rewards** (title, description, image, points cost, category, active/inactive).
- Fulfillment is either **pickup in store** (member gets a collection code) or **instant** (e.g. partner / digital-style benefits).

### Member flow

1. Browse catalog and redeem if balance is sufficient.
2. Points are deducted immediately.
3. **Pickup:** redemption is **pending** until staff marks **collected**; member shows **redemption code** in store.
4. **Instant:** redemption can be marked **collected** immediately.
5. Member may **cancel a pending** pickup redemption; points are **refunded** if still pending.

### Staff / admin flow

- List all redemptions; filter by status.
- Update status: **pending → collected** or **cancelled** (cancelled refunds points when appropriate).

---

## Missions (challenges)

Admins create **missions** with a goal and **bonus points** on completion.

| Goal type | What progress means |
|-----------|---------------------|
| Purchase count | Number of qualifying purchases |
| Spend amount | Total MMK spent on purchases |
| Login days | Consecutive daily login streak |

- Missions respect **start / end dates** and active flag.
- Progress updates automatically (purchases, logins).
- On completion, **bonus points** are granted (usually tier-eligible) and the member is notified.

---

## Referrals and community

- Each member has a **referral code** and optional **invite link** (signup with `?ref=`).
- **Community** page: share code via link, clipboard, WhatsApp, or device share sheet.
- On signup with a valid referral code:
  - New member is linked to the referrer.
  - Referrer receives a **referral bonus** (configurable points) and notification.
- Admins view a **referral dashboard**: who referred whom and referral-related bonus history.

---

## Product reviews

- Members can review **products they purchased** (one review per product code).
- Reviews include rating and text; optional product name/code.
- Submitting a review can earn **review bonus points** (configurable).
- Members can see their past reviews.

---

## Help, feedback, and FAQs

### Member help

- **Help / feedback:** submit a subject and message; track status (new, read, in progress, resolved).
- Threaded **replies** from shop staff on open tickets.
- **FAQs** in settings (and public FAQ list where enabled).

### Admin help desk

- Inbox of all customer feedback; update status and **reply**.
- Manage **FAQ** entries for the app.

---

## Notifications

Both members and shop users receive in-app **notifications**, for example:

- Points earned
- Tier upgrade
- Reward redeemed
- Mission completed
- Referral joined
- Birthday bonus
- Purchase cancelled
- Points expiry reminder / points expired

Unread counts; mark one or all as read.

---

## Support chat (inbox)

Available to **members** and **shop staff/admin**.

- **Conversations** between member and support (open, message, close).
- **Read / delivered** states and **typing** indicator.
- Rich messages (e.g. images, GIF picker).
- **Edit** and **delete** own messages (staff/admin can delete any message in a conversation).
- Floating **chat widget** on member routes; dedicated **inbox** for staff.

---

## Spin wheel

Separate campaign surface integrated with the same membership accounts.

### Member experience

- View **published wheel** and **available spins** (with expiry).
- **Confirm** before using a spin (spin credit is consumed).
- Outcome is chosen by **weighted segments** (prizes, “try again”, etc.).
- Prizes may require **in-store collection** by a deadline; member sees **collection reference** and instructions.
- **My spin rewards:** filter ready / collected / expired; prize details for staff verification.
- **Promo offers:** admin can push a promo (extra spins); member **claims** or **dismisses**.

### How spin credits are granted

- Admin **manual grant** or adjustment
- **Purchase** (`grant spins` on a sale)
- **Registration / login** promos (per spin wheel settings)
- **Marketing promos** (targeted spin packages)

Credits are **time-limited**; unused spins expire.

### Guest (one-time) spin links

- Admin creates a **guest link** (token URL).
- Visitor opens link **without an account**, activates session, gets **one spin**.
- Staff can list, inspect, and **revoke** guest links.

### Admin spin management

- **Wheel builder:** segments, labels, colors, weights, tiers (e.g. major / minor), stock limits, claim rules, winning messages.
- **Publish** one wheel for customers.
- **Stock alerts** when prize stock runs low.
- **Usage ledger:** who received spins, source, expiry, adjustments.
- **Prize fulfillment:** search spin wins; staff **marks prize claimed** in store.
- **Settings:** defaults such as spin validity hours, registration/login grants.

---

## Win-back campaigns

- Admin sees members **inactive** for a configured period (default mindset: ~180 days).
- Optionally **grant win-back bonus points** (not tier-eligible by default) to re-engage.
- System avoids duplicate win-back grants in a short window.

---

## Public website (non-logged-in)

- **Landing page:** program overview, tier table, how it works, sign in / join.
- **Sign up** (optional referral code), **sign in**, **forgot password** via **email OTP**, then reset password.
- Language (**English / Myanmar**) and **light/dark** theme.
- Installable **PWA** experience for members.

---

# Customer (member) features — summary

| Area | What members can do |
|------|---------------------|
| **Dashboard** | View tier, points, next tier, perks, customer code, **QR code** for identification at counter, login streak, points expiry |
| **Purchase history** | List and open purchase details |
| **Points activity** | Full points ledger |
| **Rewards** | Browse catalog, redeem, view/cancel redemptions |
| **Missions** | See active challenges and progress |
| **Spin wheel** | Spin, view prizes, claim promos |
| **Inbox** | Chat with support |
| **Community** | Share referral code / invite link |
| **Reviews** | Rate purchased products for bonus points |
| **Notifications** | Program messages |
| **Settings** | Profile, avatar, password, appearance, FAQs, about, delete account |
| **Help** | Submit and follow up on feedback tickets |

---

# Shop portal — staff features

Staff focus on **day-of operations**:

| Area | What staff can do |
|------|-------------------|
| **Customers** | Search, view profile, create/update member records |
| **Purchases** | Record sales, apply point redemption at sale, grant spin credits, view/cancel purchases |
| **Redemptions** | Fulfill catalog rewards (pending → collected / cancelled) |
| **Points ledger** | View all member point movements (read-only list) |
| **Support inbox** | Chat with members |
| **Notifications** | Shop notifications |
| **Settings** | Profile and general preferences (not full branding) |

Staff **cannot** delete customers/purchases, manage catalogs, spin configuration, staff accounts, or global app settings.

---

# Shop portal — admin features

Everything staff has, plus:

| Area | What admins can do |
|------|---------------------|
| **Dashboard** | High-level counts (customers, purchases, pending redemptions, etc.) |
| **Customers** | Delete member accounts |
| **Purchases** | Delete purchase records; full sales management |
| **Rewards catalog** | CRUD rewards, images, fulfillment type |
| **Promotions** | CRUD earn multiplier campaigns |
| **Missions** | CRUD challenges and bonuses |
| **Spin wheel** | Full wheel, prizes, usage, guest links, settings, staff claim |
| **Referrals** | Referral performance dashboard |
| **Win-back** | Inactive member list and bonus grants |
| **Feedback & FAQs** | Manage tickets and knowledge base |
| **Staff accounts** | Create/manage staff logins |
| **Points ledger** | **Manual adjustments** (credit/debit with reason) |
| **Sales entry sync** | Pull/sync customer and purchase data from external sales system (when configured) |
| **Exports** | Download customers, purchases, ledger |
| **Activity logs** | Audit trail of admin actions |
| **App settings** | Loyalty numbers (earn divisor, redeem rate, bonuses, inactivity, etc.), **branding/logo** |

---

## Typical end-to-end processes

### New member joins

1. Sign up on web (optionally with referral code).
2. Receive **signup bonus** points (if enabled).
3. May receive **registration spin promo** (if enabled).
4. Visit shop; staff identifies member via **code or QR**.
5. Purchases earn points; tier rises with lifetime spend.

### Sale at the counter

1. Staff finds member → **new purchase**.
2. Enter amount (and product type if promotions apply).
3. Optional: member redeems points toward this bill.
4. Optional: grant spin credits.
5. System calculates earn, updates tier/spend, runs missions, notifies member.

### Redeem catalog reward

1. Member redeems in app → unique **redemption code**, points deducted.
2. Member visits store with code.
3. Staff marks redemption **collected** (or member cancelled pending before pickup).

### Win a spin prize

1. Member spins → result and reference shown.
2. If prize requires claim, member collects in store before **claim-by date**.
3. Staff confirms via **spin rewards** screen.

### Re-engage lapsed member

1. Admin reviews **win-back** list.
2. Grants bonus points; member receives notification.
3. Member returns and shops; normal earn rules apply.

---

## Configurable program rules (defaults)

These are set in admin app settings and drive business logic:

| Setting | Purpose (typical default) |
|---------|-------------------------|
| Base earn divisor | MMK per 1 point (e.g. 10,000) |
| Redemption rate | MMK value per point at checkout |
| Redeem increment | Points must be redeemed in steps (e.g. 100) |
| Inactivity days | When idle wallets expire (e.g. 365) |
| Signup bonus | Points for new account (e.g. 100) |
| Referral bonus | Points to referrer (e.g. 100) |
| Review bonus | Points per product review (e.g. 20) |
| Win-back inactive days | Who appears on win-back list (e.g. 180) |
| Win-back bonus | Points per win-back grant (e.g. 50) |

Tier thresholds and perks are maintained in the **tier** configuration (aligned with the public tier table).

---

## Languages and accessibility

- **English** and **Myanmar** UI copy.
- Skip links, structured headings, and responsive layouts for phone and desktop use in store and at home.