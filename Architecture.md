# Khabar Golpo — Architecture

> Version 1.0 | Stack: HTML + CSS + JS + Supabase (Postgres, Auth, Realtime, Storage) + Vercel | No custom server

## 1. Overview

Khabar Golpo is a complete restaurant website and management system:

- **Customer website** (`/`): story, menu (view-only), gallery, reservation, contact, feedback.
- **Order pages**: dine-in via QR (`/order?table=N`), pickup/delivery (`/order-online`), live tracking (`/track`).
- **Kitchen panel** (`/kitchen`): live order feed for chef.
- **Admin panel** (`/admin/*`): orders, receipts, delivery slips, menu, tables/QR, reservations, feedback, gallery, reports, settings.

There is **no custom backend server**. All pages are static files hosted on Vercel and talk to Supabase through a single **JS API layer** (`js/api/`). Business-critical logic (pricing, totals, receipt numbers, status transitions) runs in **Postgres database functions**, not in the browser.

Out of scope (v1): staff management, waiter alerts, staff performance, online payment, loyalty points, customer accounts, delivery-person panel.

## 2. Tech Stack

| Area | Choice |
|------|--------|
| Frontend | HTML, CSS, vanilla JavaScript |
| Animation / 3D (customer site only) | GSAP + ScrollTrigger, Lenis, Three.js, model-viewer, vanilla-tilt, Swiper, Lottie |
| Fonts / icons | Google Fonts (Cormorant Garamond, Jost), Lucide |
| Backend services | Supabase Free Tier: Postgres + Auth + Realtime + Storage |
| QR codes | QR code image API (link format `https://<site>/order?table=N`) |
| Hosting | Vercel (static) |
| Libraries | All free, CDN-based |

Supabase projects: **dev** (testing) and **production** (real data), same schema.

## 3. High-Level Architecture

```
  Diner phone ─────────► order.html ───────────┐
  Online customer ─────► order-online.html ────┤
  Anyone ──────────────► index.html, track.html┤
  Chef tablet ─────────► kitchen.html ─────────┼──► JS API layer ──► Supabase
  Admin computer ──────► admin/*.html ─────────┘                      ├─ Postgres (tables + RPC functions)
                                                                     ├─ Auth (admin + chef login)
         Static files on Vercel                                      ├─ Realtime (live kitchen / tracking)
                                                                     └─ Storage (menu + gallery images)
```

### 3.1 Layers

1. **Pages (`*.html` + `js/pages/`)** — rendering, form handling, animations. No direct Supabase calls.
2. **API layer (`js/api/*.js`)** — sole gateway to Supabase. Handles supabase-js calls / RPC, error normalization, mock-mode switch.
3. **Mock layer (`js/mock/`)** — fake data with identical return shape, so frontend (Farhana) can build before DB is ready. Toggled in `js/config.js`.
4. **Supabase** — source of truth:
   - Postgres tables + constraints + RLS + RPC functions (Sohana + Mushfique).
   - Auth with `profiles.role = admin | chef`.
   - Realtime on `orders` / `order_items` for kitchen + tracking.
   - Storage buckets for menu-item and gallery images.
5. **Utils (`js/utils/`)** — QR builder, receipt printing, formatting, auth page-guards, validators.

> Rule: pages never import `supabaseClient.js` directly. They call `api/*`.

### 3.2 Standard Response Shape

Every API function returns:

```js
// success
{ data: <payload>, error: null }
// failure
{ data: null, error: { code: "SOLD_OUT", message: "Fries is sold out." } }
```

See `Api Contract.md` for full code list.

## 4. Frontend Architecture

### 4.1 Sitemap

```
/                        Customer site (single scroll: #home #story #menu #gallery #reservation #contact #feedback)
│
/order?table=N           Dine-in (QR)
/order-online            Pickup / delivery
/track                   Tracking (link ?receipt=KG-1042 or receipt+phone form)

/kitchen                 Kitchen (chef login required)

/admin/login             Admin login
/admin/dashboard         Revenue + today overview
/admin/orders            All orders + delivery + payment actions
/admin/receipt           Receipt + combined table bill
/admin/delivery-slip     Printable agency slip
/admin/menu              Categories + items
/admin/tables            Tables + QR print
/admin/reservations      Bookings
/admin/feedback          Reviews / queries / suggestions
/admin/gallery           Photos
/admin/reports           Sales reports + CSV
/admin/settings          Restaurant info, tax, delivery, hours
```

### 4.2 Page Principles

| Page group | Motion / weight | Notes |
|------------|-----------------|-------|
| Customer website | Full effects (GSAP, Lenis, Three.js hero lazy-loaded, tilt, Swiper, Lottie) | Static image fallback, `<model-viewer>` for signature dishes, skeleton loaders, `prefers-reduced-motion` respected |
| Order + tracking | Light animations only, no 3D | Fast on mid-range phones, large tap targets, sticky cart bar, cart drawer |
| Kitchen + admin | Minimal, speed-first | Polling fallback if Realtime drops, pagination, print CSS for receipts/slips |

Design system: French white minimalist cozy — warm white/cream, soft beige, muted sage/dusty-gold accent, charcoal text, Cormorant Garamond headings + Jost body, thin lines, soft shadows, rounded cards.

### 4.3 Client State

- No framework store. Per-page JS state: menu cache, cart (`{ itemId, qty }`), filters, order-type choice.
- Cart totals on client are **display only**; server recalculates on submit.
- Cart persisted in memory (+ sessionStorage for retry after network failure) so errors keep the cart.
- Tracking page subscribes to Realtime for its order; kitchen subscribes to `orders` where `status NOT IN (completed, cancelled)` and payment filter.

## 5. Backend Architecture (Supabase)

- **Postgres**: 9 tables (see `Database.md`): `profiles, categories, menu_items, tables, orders, order_items, reservations, feedback, gallery_images, settings`.
- **RPC functions** (SECURITY DEFINER where needed): `place_dinein_order`, `place_online_order`, `update_order_status`, `mark_paid`, `mark_table_paid`, `table_bill`, `revenue_summary`, `sales_report`, `top_items`, `sales_by_type`.
- **Auth**: email/password, 1 admin + 1 chef created manually, no sign-up. `profiles.id = auth.users.id`.
- **Realtime**: publication on `orders`, `order_items`. Kitchen and `/track` subscribe with row filters.
- **Storage**: `menu-images`, `gallery-images` buckets, public-read, admin-write-only, image MIME + 2 MB limit enforced by policy + client check.

## 6. Key Data Flows

### 6.1 Dine-in order

```
Scan QR → order.html reads ?table=N → api.checkTable(N) → active?
Pick items → client total (display) → Place order (button disabled)
  → RPC place_dinein_order(table, lines[{id,qty}], note)
     checks: table active, items exist+available, qty 1–20, ≤30 lines, note ≤200 chars
     prices from DB, tax from settings, receipt KG-XXXX, insert orders+order_items
  → { receipt, total } → animated confirmation
  → Realtime INSERT → kitchen card + admin list refresh
```

### 6.2 Pickup / delivery order

```
order-online.html → cart → choose pickup|delivery (hidden if settings off)
→ name, phone (+address if delivery, +pickup_time optional)
→ RPC place_online_order(...) checks: type enabled, phone regex, address required,
   min-order for delivery, rate-limit per phone/hour, honeypot empty
→ { receipt, tracking link } → kitchen (first-name only) + admin (full details)
```

### 6.3 Status + tracking + payment

```
Chef: new → preparing → ready (ready→preparing allowed for correction)
Admin: ready → out_for_delivery → delivered (delivery) | ready → completed/picked up (pickup)
       any unfinished → cancelled | unpaid → paid (Mark as Paid / Mark table paid)
RPC update_order_status validates transition matrix + role.
Tracking auth: unguessable link (?id=<uuid>) OR receipt + phone match.
Revenue counts only paid && !cancelled, grouped by paid_at in settings.timezone.
```

Status matrix:

```
Dine-in:  new → preparing → ready → (paid)
Pickup:   new → preparing → ready → completed
Delivery: new → preparing → ready → out_for_delivery → completed
Any unfinished → cancelled (admin only)
```

## 7. Project Structure

```
khabar-golpo/
├── index.html
├── order.html
├── order-online.html
├── track.html
├── kitchen.html
├── admin/
│   ├── login.html  dashboard.html  orders.html  receipt.html
│   ├── delivery-slip.html  menu.html  tables.html  reservations.html
│   ├── feedback.html  gallery.html  reports.html  settings.html
├── css/                        # base.css, animations.css, per-panel css
├── js/
│   ├── config.js               # SUPABASE_URL, ANON_KEY, SITE_URL, MOCK_MODE
│   ├── supabaseClient.js
│   ├── api/                    # auth.js, public.js, ordering.js, kitchen.js, adminOrders.js, adminContent.js, reports.js
│   ├── mock/                   # mock data mirroring api shape
│   ├── pages/                  # one file per page
│   └── utils/                  # qr.js, receipt.js, format.js, guards.js, validate.js
├── supabase/                   # schema.sql, functions.sql, rls.sql, seed.sql
├── assets/
├── vercel.json
└── README.md (+ Architecture.md, Database.md, Security.md, Testing.md, Api Contract.md)
```

## 8. Deployment & Environments

```
feature branch → PR → Vercel preview URL → QA (Noshin) tests
  → merge to dev → Vercel dev + Supabase dev → test
  → merge to main → Vercel production + Supabase production
```

- Static hosting only; no env secrets on server. Only `anon` key ships in `config.js`; never `service_role`.
- QR codes printed only after final production domain is frozen (domain change invalidates all printed QRs).
- Rollback: Vercel instant rollback for frontend; Supabase migrations are forward-only SQL files in `supabase/`.

## 9. Cross-Cutting Decisions

| Decision | Rationale |
|----------|-----------|
| Server totals, not client totals | Prevents price tampering |
| Snapshot item name+price into `order_items` | Old receipts immutable after menu edits |
| Kitchen sees first name only, no PII/prices | Privacy + focus |
| Combined table bill (`table_bill`) | Multiple dine-in orders per table, one payment |
| Rate limit + honeypot, no captcha | Frictionless ordering, basic spam defense |
| Mock mode in API layer | Frontend/backend parallel work |
| Cash only | No payment gateway scope; admin records cash |

## 10. Scalability & Limits (Free Tier)

- Fits free-tier Supabase: low write volume (orders), Realtime on 2 tables, small Storage (compressed images, lazy 3D <2 MB).
- Pagination on admin orders/reports; indexes on `orders(status, created_at)`, `menu_items(category_id, is_available)`.
- If volume grows: add read replica / move images to CDN, add `orders` archival job, replace QR image API with locally generated QR.
- Known bottlenecks: Realtime fan-out on kitchen tablets, CSV export for large ranges (stream/paginate).

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Printed QR tied to domain | Freeze domain before printing |
| Realtime outage | Polling fallback (10–15 s) on kitchen/track |
| Chef marks wrong status | Allow ready→preparing; admin-only cancel/pay |
| Free-tier limits | Image compression, pagination, dev/prod separation |
