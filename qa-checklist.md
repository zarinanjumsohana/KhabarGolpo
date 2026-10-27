# Khabar Golpo — QA Checklist (Member 5: Noshin)

## Process Summary

1. Get the Vercel preview URL from the pull request.
2. Confirm `MOCK_MODE=false` (tests run against Supabase dev, not mock data).
3. Use dev accounts: `admin@khabargolpo.test` / `chef@khabargolpo.test`.
4. Walk every panel and order type below; log bugs with the template at the end.
5. Run the Smoke Set (section 7 of Testing.md) as the merge gate.
6. Block merge on any blocker-severity bug.

---

## 1. Customer Website (`/`)

- [ ] Navbar sticks and solidifies on scroll; smooth-scroll links work; hamburger menu on mobile
- [ ] Hero loads; 3D lazy-loads with static fallback; both CTA buttons navigate
- [ ] Menu: category tabs, search, veg/non-veg filter all work
- [ ] Sold-out items show tag and are disabled; featured items open 3D viewer
- [ ] Gallery grid/slider; click-to-enlarge popup closes with Esc/close button
- [ ] Reservation: valid submit shows success; invalid phone/date/guests blocked; honeypot filled is silently rejected
- [ ] Feedback: review without rating blocked; query/suggestion without rating allowed; submission hidden until approved
- [ ] Approved review appears in slider (name/rating/message only)
- [ ] Loading skeletons appear on slow load; friendly errors offline; responsive at 360px; reduced-motion respected

## 2. Dine-in Order (`/order?table=N`)

- [ ] Valid table shows "Table N" badge
- [ ] Inactive (`?table=99`), missing, or invalid table → clear error, no menu shown
- [ ] Sold-out items greyed out and cannot be added
- [ ] Cart drawer: add, change quantity, remove; bounce animation on add
- [ ] Totals display subtotal/tax/total; note field enforces 200-char limit
- [ ] Place order button disables on tap; success shows checkmark + receipt number (KG-XXXX) + "Order again"
- [ ] Cart kept on error; retry works
- [ ] Tampered price in DevTools is ignored (server total wins)
- [ ] Second order on same table gets new receipt; combined bill merges them (verify in admin)
- [ ] No 3D libraries loaded (check Network tab)

## 3. Pickup / Delivery (`/order-online`)

- [ ] Pickup-only or delivery-only toggle hides the other option with a message
- [ ] Pickup: name + phone required; phone format validated; optional pickup time; address not required
- [ ] Delivery: address required; delivery fee added; below-minimum order blocked with message showing the minimum
- [ ] Summary math matches server receipt; confirmation shows receipt + Track link
- [ ] Honeypot and per-phone hourly rate limit block excess orders with a message
- [ ] Ordering works without login; cash payment messaging shown

## 4. Tracking (`/track`)

- [ ] UUID link opens order directly
- [ ] Receipt + matching phone opens; receipt + wrong phone denied
- [ ] Timelines correct: dine-in 3 steps, pickup 4 steps, delivery 5 steps
- [ ] Auto-refreshes on status change (under 10 seconds); cancelled order shows "Cancelled"
- [ ] Shows items, order type, total, estimated time (from prep-time setting), delivery agency note when set, Call button (`tel:`)

## 5. Kitchen Panel (`/kitchen`)

- [ ] Chef login required
- [ ] New order appears within seconds without manual refresh
- [ ] Order card shows type badge, receipt number, items with quantities, note, elapsed timer
- [ ] Pickup/delivery cards show customer first name and pickup time only
- [ ] Status flow: new → preparing → ready; ready → preparing correction works
- [ ] Completed/paid/cancelled orders leave the feed
- [ ] Item summary counts are correct (e.g., Burger ×7)
- [ ] Table-grouped view is correct; old orders highlighted
- [ ] Sold-out toggle greys item on order pages after refresh
- [ ] Sound toggle works after tap
- [ ] No prices, revenue, phone numbers, or addresses visible (check View Source + Network tab)
- [ ] Realtime outage → polling fallback or clear retry message

## 6. Admin Panel (`/admin/*`)

- [ ] Chef role blocked from all admin pages and RPC calls
- [ ] Dashboard: today's orders, pending count, today's sales, top items, type counts, revenue (today/week/month/year) all match paid orders
- [ ] Orders: filters (date/type/table/status/payment), pagination, tap-to-call, copy address
- [ ] Actions: cancel (unfinished only), out-for-delivery with note, delivered, picked up, mark paid; cancelled orders cannot be paid; paid sets paid_at
- [ ] Receipt auto-exists per order; prints cleanly
- [ ] Combined bill sums all unpaid orders for a table; "Mark table paid" clears all
- [ ] Delivery slip shows name, phone, address, items, amount-to-collect; prints cleanly
- [ ] Menu: CRUD works; image upload rejects non-image and >2 MB files
- [ ] Tables: add/deactivate; QR print (single and all); QR scans to correct `?table=N`
- [ ] Reservations: confirm/cancel actions work
- [ ] Feedback: approve/read/delete works
- [ ] Gallery: upload/delete with captions
- [ ] Settings: save and take effect (tax, fee, toggles, hours)
- [ ] Reports: date groupings correct; CSV export opens correctly

## 7. Non-Functional

- [ ] Responsive at 360×640, 768, 1440 — no horizontal scroll
- [ ] Tap targets at least 44px on order pages
- [ ] Order/track/kitchen interactive in under 3 seconds on mid-range phone
- [ ] Receipt, delivery slip, and QR sheet print without nav/buttons
- [ ] All inputs have labels; contrast is readable; keyboard can close popups; focus states visible

## 8. Problem Cases (all must pass)

- [ ] Item sold out mid-order → order rejected with item named
- [ ] Item removed from menu → message asks customer to refresh
- [ ] Network drop → friendly error, cart kept, retry works
- [ ] Double tap on Place order → button disabled after first tap
- [ ] Same table orders again → new receipt; combined bill merges
- [ ] Delivery or pickup switched off → option hidden, message shown
- [ ] Delivery order without address → blocked with clear message
- [ ] Order below delivery minimum → blocked showing the minimum
- [ ] Too many orders from one phone → temporarily blocked
- [ ] Admin cancels order → leaves kitchen feed, excluded from revenue, tracking shows "Cancelled"
- [ ] Price edited in browser → ignored; database price used

## 9. Smoke Set (merge gate — must all pass)

1. [ ] Dine-in order → kitchen marks ready → receipt prints → mark paid → revenue increases
2. [ ] Delivery order → out-for-delivery → delivered → paid
3. [ ] Reservation submit → confirm
4. [ ] Review submit → approve → visible on website
5. [ ] Sold-out toggle propagates to order pages
6. [ ] Tracking with wrong phone fails

---

## Bug Report Template

```
Title: [Page] Short symptom
Env: preview/dev, browser+width, account role, MOCK_MODE=false
Steps: 1... 2... 3...
Expected: ...
Actual: ... (+ screenshot, console error, receipt/phone used)
Severity: blocker/major/minor | Repro: always/sometimes
```

**Severity guide:** blocker (order/payment/revenue wrong, auth bypass, PII leak) — fix before merge; major — fix before main; minor — backlog.
