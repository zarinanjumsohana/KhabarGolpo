# Khabar Golpo — Testing

> Owners: Noshin (manual QA / bug reports) + Anamika (API documentation & API testing) | Environments: Vercel preview → dev (Supabase dev) → prod

## 1. Strategy

| Level | Who / How | Coverage |
|-------|-----------|----------|
| Manual UI + E2E walkthroughs | Noshin, checklist below on preview + dev | All panels, all order types, print flows, mobile 360px |
| API testing | Anamika (Postman / `fetch` + Supabase RPC) | Every function in Api Contract.md, happy + error cases |
| Realtime / concurrency | Noshin + Anamika together | Kitchen live feed, double-tap, sold-out race |
| Regression before merge to main | Noshin sign-off on dev | Smoke set (§7) |
| Bug tracking | GitHub Issues with template (§8) | — |

No automated framework v1 (static JS, no build). Mock mode (`MOCK_MODE=true`) used only for early frontend layout tests — all acceptance tests run with `MOCK_MODE=false` against Supabase dev.

Test accounts (dev): `admin@khabargolpo.test` / `chef@khabargolpo.test` (passwords in team vault, never in repo).

## 2. Test Data

- Tables 1–10 active, Table 99 deactivated.
- Menu: ≥2 categories, items covering veg, non-veg, sold-out, featured/3D, deleted item case.
- Settings variants to toggle: tax 0% vs 5%, delivery on/off, pickup on/off, delivery fee, min delivery order, prep time.
- Phones: valid `017XXXXXXXX`, invalid formats, rate-limit probe number.

## 3. Functional Checklists

### 3.1 Customer website (`/`)

- [ ] Navbar sticks, solidifies on scroll, smooth-scrolls, hamburger on mobile
- [ ] Hero loads, 3D lazy + static fallback, both CTA buttons navigate
- [ ] Menu tabs/search/veg filter work; sold-out tag + disabled; featured opens 3D viewer
- [ ] Gallery grid/slider + popup + Esc/close
- [ ] Reservation: valid submit → pending + success; invalid phone/date/guests blocked; honeypot filled → rejected silently
- [ ] Feedback review without rating blocked; query/suggestion without rating allowed; submitted hidden until approval
- [ ] Approved review appears in slider (name/rating/message only)
- [ ] Skeletons on slow load; friendly errors offline; responsive 360px; reduced-motion respected

### 3.2 Dine-in (`/order?table=N`)

- [ ] Valid table shows "Table N" badge; `?table=99` (inactive) / missing / `999` → clear error, no menu
- [ ] Sold-out greyed, cannot add; large tap targets; cart drawer add/qty/remove; bounce on add
- [ ] Totals show subtotal/tax/total (display); note ≤200 enforced
- [ ] Place order: button disables, success shows checkmark + receipt `KG-XXXX` + Order-again; cart kept on error
- [ ] Tampered price in DevTools ignored (server total wins)
- [ ] Second order same table → new receipt; combined bill merges (admin)
- [ ] No 3D libs loaded (Network tab)

### 3.3 Pickup / delivery (`/order-online`)

- [ ] Pickup-only and delivery-only toggle states hide the other option + show message
- [ ] Pickup: name+phone required, phone format checked, optional pickup time; address not required
- [ ] Delivery: address required, fee added, min-order blocked with message showing minimum
- [ ] Summary math matches server receipt; confirmation shows receipt + Track link
- [ ] Honeypot + N-orders/hour/phone limit: excess blocked with message
- [ ] No-login ordering works; cash messaging shown

### 3.4 Tracking (`/track`)

- [ ] UUID link opens directly; receipt+matching phone opens; receipt+wrong phone denied
- [ ] Timelines correct per type (dine-in 3 steps, pickup 4, delivery 5)
- [ ] Auto-refresh on chef/admin status change (<10 s); cancelled shows Cancelled
- [ ] Shows items/type/total, ETA from prep-time, agency note when set, Call button (`tel:`)

### 3.5 Kitchen (`/kitchen`)

- [ ] Chef login required; admin can view but primary is chef
- [ ] New order appears in seconds without refresh; badge, receipt, items×qty, note, timer; pickup/delivery show first name + pickup time
- [ ] new→preparing→ready works; ready→preparing correction works; completed/paid/cancelled leave feed
- [ ] Item summary counts correct (e.g. Burger ×7); table-group view correct; old orders highlighted
- [ ] Sold-out toggle greys item on order pages within refresh
- [ ] Sound toggle works after tap; no prices/revenue/phones/addresses visible (View Source + Network)
- [ ] Realtime kill (offline) → polling fallback or clear retry message

### 3.6 Admin (`/admin/*`)

- [ ] Wrong role (chef) blocked from all admin pages + RPCs
- [ ] Dashboard: today/pending/today-sales/top items/type counts/revenue today-week-month-year correct vs paid orders
- [ ] Orders: filters (date/type/table/status/payment), pagination, tap-to-call, copy address
- [ ] Actions: cancel (unfinished only), out-for-delivery+note, delivered, picked-up, mark paid; cancelled cannot be paid; paid sets paid_at
- [ ] Receipt auto-exists per order, prints cleanly; combined bill sums table's unpaid; Mark-table-paid clears all
- [ ] Delivery slip shows name/phone/address/items/amount-to-collect, prints cleanly
- [ ] Menu CRUD + image upload (reject non-image/>2 MB); tables add/deactivate + QR print single/all; QR scans to correct `?table=N`
- [ ] Reservations confirm/cancel; feedback approve/read/delete; gallery upload/delete+caption; settings save + take effect (tax/fee/toggles/hours); reports groupings + CSV export opens correctly

## 4. API Testing (Anamika)

Base: `POST https://<supabase-dev>/rest/v1/rpc/<fn>` with `apikey: <anon>` (+ `Authorization: Bearer <jwt>` for auth fns). Also test via `js/api/*` in console.

For each function assert: HTTP/status, `{ data, error }` shape, `code` from contract, DB row written correctly, receipt format, server-computed totals.

| # | Case | Expect |
|---|------|--------|
| A1 | `place_dinein_order` valid | receipt `KG-XXXX`, totals from DB |
| A2 | inactive table / bad item id / sold-out item / qty 0,21 / 31 lines / note 201 chars | matching `TABLE_INACTIVE / ITEM_NOT_FOUND / SOLD_OUT / BAD_QTY / TOO_MANY_LINES / NOTE_TOO_LONG` |
| A3 | client sends fake low price | ignored, DB price used |
| A4 | double submit (2 rapid calls) | 2 receipts (button-disable is UI-only) — document behavior |
| A5 | `place_online_order` pickup valid / delivery valid | fee applied only delivery |
| A6 | delivery disabled / pickup disabled | `TYPE_DISABLED` |
| A7 | bad phone / missing address / below min / rate-limit exceeded / honeypot filled | `BAD_PHONE / ADDRESS_REQUIRED / BELOW_MINIMUM / RATE_LIMITED / SPAM_DETECTED` |
| A8 | `track_order` correct pair vs wrong phone vs unknown receipt | data vs `NOT_FOUND / PHONE_MISMATCH` |
| A9 | `update_order_status` legal vs skip (new→ready for chef?) vs terminal edits | success vs `BAD_TRANSITION / FORBIDDEN` |
| A10 | chef calls `cancel_order` / `mark_paid` | `FORBIDDEN` |
| A11 | `mark_paid` on cancelled | `ALREADY_CANCELLED` |
| A12 | `table_bill` sums only unpaid non-cancelled | correct combined total |
| A13 | anon direct `INSERT INTO orders` (bypass RPC) | RLS denial |
| A14 | `set_availability` as anon / chef / admin | denied / allowed / allowed |
| A15 | reports with date ranges, timezone edge (midnight order) | correct bucketing by `paid_at` |

Record results in a sheet: `Function | Input | Expected code | Actual | Pass/Fail | Notes`.

## 5. Non-Functional

- **Responsive**: 360×640, 768, 1440; no horizontal scroll; tap targets ≥44px on order pages.
- **Performance**: order/track/kitchen interactive <3 s on mid-range phone, 3D <2 MB lazy, images compressed.
- **Print**: receipt + delivery slip + QR sheet print without nav/buttons (print CSS).
- **Accessibility**: labels on all inputs, contrast charcoal-on-cream, keyboard-close popup, focus states.
- **Resilience**: airplane-mode submit → friendly error + cart kept; Supabase pause → friendly banner.

## 6. Problem-Case Matrix (must all pass)

Sold-out mid-order · deleted item · network drop · double tap · same-table reorder · type switched off · address missing · below minimum · rate limit · admin cancel · DevTools price edit — expected behaviors in README §5.12.

## 7. Smoke Set (gate for `main`)

1. Dine-in order → kitchen ready → receipt print → mark paid → revenue up.
2. Delivery order → out-for-delivery → delivered → paid.
3. Reservation submit → confirm. 4. Review submit → approve → visible.
5. Sold-out toggle propagates. 6. Tracking with wrong phone fails.

## 8. Bug Report Template (Noshin)

```
Title: [Page] Short symptom
Env: preview/dev, browser+width, account role, MOCK_MODE=false
Steps: 1... 2... 3...
Expected: ...
Actual: ... (+ screenshot/console error + receipt/phone used)
Severity: blocker/major/minor | Repro: always/sometimes
```

Severity: blocker (order/payment/revenue wrong, auth bypass, PII leak) → fix before merge; major → fix before main; minor → backlog.

## 9. Release Checklist

- [ ] Smoke set green on dev, API sheet green
- [ ] `MOCK_MODE=false`, prod keys, domain frozen, QRs re-printed if domain changed
- [ ] RLS + checklist in Security.md §12 green
- [ ] CSV + print verified; seed/demo data absent from prod
