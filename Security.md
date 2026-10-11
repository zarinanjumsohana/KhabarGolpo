# Khabar Golpo — Security

> Owner: Sohana | Applies to: Supabase (Postgres RLS, Auth, Storage), JS API layer, static pages on Vercel

## 1. Security Model

```
Browser → page guard (UX only) → Supabase Auth JWT → RLS policies (real enforcement) → RPC role + transition checks → CHECK constraints
```

Golden rules:

1. **Never trust the client.** Prices, tax, fees, totals, receipt numbers, statuses are computed/validated in the database.
2. **Page guards are convenience, not security.** Every privileged read/write is re-checked by RLS + RPC (`auth.jwt()` role).
3. **Only the `anon` public key ships** in `js/config.js`. The `service_role` key never leaves Supabase dashboard.

## 2. Authentication & Roles

- Email/password via Supabase Auth. No sign-up page; 1 admin + 1 chef created manually, linked in `profiles(id, role)`.
- Session: Supabase JWT in localStorage; API layer attaches it automatically; logout clears it.
- Page guards (`js/utils/guards.js`): `/kitchen` requires chef|admin, `/admin/*` requires admin; otherwise redirect to login. Bypassable — RLS is the backstop.
- Wrong-role access blocked twice: redirect + RLS/RPC denial with `FORBIDDEN`.

| Capability | Customer (anon) | Chef | Admin |
|------------|:---:|:---:|:---:|
| Place order | ✔ | | |
| Track own order | ✔ (receipt+phone or uuid link) | | ✔ |
| new→preparing→ready, sold-out toggle | | ✔ | ✔ |
| Cancel, out-for-delivery, delivered, picked-up, mark paid, content CRUD, settings, reports | | | ✔ |

## 3. Row Level Security (per table)

Policies live in `supabase/rls.sql`. Principle of least privilege:

| Table | anon | chef (authenticated) | admin |
|-------|------|----------------------|-------|
| categories, menu_items | SELECT where visible | SELECT all | ALL |
| tables | SELECT is_active (for QR check) | SELECT | ALL |
| settings | SELECT | SELECT | SELECT + UPDATE |
| gallery_images | SELECT | SELECT | ALL |
| feedback | INSERT only (forced `is_approved=false`) | SELECT (no PII beyond name?) | ALL; public reads approved reviews only via view/RPC |
| reservations | INSERT only (forced `status='pending'`) | — | ALL |
| orders | INSERT via RPC only; SELECT own via RPC only | SELECT active orders, **PII-redacted view** (no phone/address/full name/prices) | ALL |
| order_items | SELECT only as part of authorized order fetch | SELECT for active orders | ALL |
| profiles | — | SELECT own row | SELECT all |

Chef PII redaction: kitchen RPC/view returns `first_name` only, no `customer_phone`, `delivery_address`, no `subtotal/total`. Full details only in admin RPC.

## 4. RPC Function Guards

Every `SECURITY DEFINER` function starts with:

1. Role check (`is_admin()` / `is_chef_or_admin()` helpers reading `auth.jwt()` → `profiles.role`).
2. Input validation (lengths, regex, ranges — mirrors CHECK constraints).
3. Business-rule validation (type enabled, table active, items available, transition allowed, not-cancelled-before-pay).
4. All writes in one transaction; errors raised with explicit codes mapped by API layer to `{ code, message }`.

## 5. Input Validation & Anti-Spam

| Layer | Rule |
|-------|------|
| DB CHECKs | qty 1–20, ≤30 lines, note ≤200, names 1–80, message ≤1000, price >0, guests 1–50, rating 1–5, phone regex `^01[3-9]\d{8}$` |
| Public forms | Required-field + format checks, max lengths, reservation date ≥ today |
| Spam | Hidden honeypot field (must stay empty), rate limit N orders/hour per phone (RPC counts recent `orders` by phone), reservation/feedback throttling |
| Type toggles | RPC refuses `pickup`/`delivery` when `settings.*_enabled = false`; client hides option |
| Delivery | Address required, min-order enforced, fee from settings only |

## 6. Injection & XSS

- No raw SQL from client — only parameterized supabase-js + RPC with `jsonb` args.
- All user text (names, notes, reviews, captions) rendered as **plain text** (`textContent`, never `innerHTML`); approved reviews show name/rating/message only.
- Phone/address copied into receipt/slip via text nodes; printed pages use same escaping.
- Markdown/HTML in inputs stored as-is but never interpreted.

## 7. Privacy

- Customer PII (name, phone, address) stored on `orders`, visible to **admin only**. Kitchen gets first name + pickup time; tracking page shows requester's own order only.
- Tracking requires **unguessable `orders.id` (uuid) link** or **receipt + matching phone**; receipt alone is insufficient.
- No customer accounts, no order history across sessions, no analytics PII.
- Tap-to-call / copy-address only in admin panel (authenticated).

## 8. Storage & Upload Security

- Buckets `menu-images`, `gallery-images`: public READ, admin-only WRITE/DELETE via storage policies.
- Client + policy enforce `image/*` MIME and ≤2 MB; filenames are server-generated uuids (no path traversal).
- Admin previews image before publish; gallery delete removes DB row + object.

## 9. Keys, Config & Deployment

- `js/config.js` contains only `SUPABASE_URL` + `anon` key + `SITE_URL` + `MOCK_MODE` — safe to be public.
- `service_role` key: Supabase dashboard only, never in repo, never in Vercel env for frontend.
- Separate dev/prod Supabase projects; prod keys only on `main` deployment.
- Vercel: HTTPS enforced, preview URLs password-less but QA data is dev-only; no secrets in `vercel.json`.
- QR codes: static links with table number only (no tokens); table validity checked server-side so forged `?table=999` fails safely.

## 10. Transport & Browser

- All traffic HTTPS (Vercel + Supabase). No mixed content; CDN libs pinned with SRI where available.
- Auth tokens in Supabase-managed storage; logout + role-change revokes access immediately via RLS.
- Sound alert on kitchen requires user tap (autoplay policy) — no bypass attempted.
- `Referrer-Policy` / `X-Content-Type-Options` via Vercel headers in `vercel.json`.

## 11. Incident Playbook

| Event | Action |
|-------|--------|
| Spam wave from a phone | Lower hourly limit in RPC, block phone via admin cancel + note, check honeypot |
| Leaked anon key | Rotate in Supabase dashboard, update `config.js`, redeploy (low risk — RLS still holds) |
| Suspected tampered totals | Compare `order_items` snapshots vs `menu_items`; RPC logs show server computation |
| Wrong status / accidental cancel | Re-create not possible — use status correction (ready→preparing) or contact customer; cancelled excluded from revenue |
| Abusive review | Unapprove/delete in admin feedback; never expose delete to public |

## 12. Security Checklist (pre-launch)

- [ ] RLS enabled on all tables; anon direct INSERT/UPDATE denied except via RPC
- [ ] RPC role checks tested for chef-vs-admin (see Testing.md)
- [ ] Only anon key in repo; service_role absent from git history
- [ ] Honeypot + rate limit verified; delivery/tax computed server-side
- [ ] Tracking without phone fails; kitchen shows no PII/prices
- [ ] Upload rejects non-image / >2 MB
- [ ] Admin routes redirect when logged out; direct RPC without JWT denied
