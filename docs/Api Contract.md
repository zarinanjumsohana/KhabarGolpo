# Khabar Golpo — API Contract

> Owner: Anamika (docs + testing) · Implementer: Sohana | Transport: Supabase RPC via `js/api/*` — pages never call Supabase directly | File: `Api Contract.md`

## 1. Conventions

- **Base**: `POST https://<project>.supabase.co/rest/v1/rpc/<function>` with header `apikey: <anon>`; authenticated calls add `Authorization: Bearer <jwt>`.
- **JS usage**: `import { placeDineInOrder } from './js/api/ordering.js'` — same names as below (camelCase in JS, snake_case in RPC).
- **Envelope** — every function returns exactly one of:

```js
{ data: <payload>, error: null }
{ data: null, error: { code: "SOLD_OUT", message: "Fries is sold out." } }
```

- `message` is user-friendly and safe to display; `code` is stable for `if` branching.
- Money: numbers with 2 decimals (e.g. `245.00`). Dates: ISO strings. Phone (BD): `^01[3-9]\d{8}$`.
- Limits: `quantity` 1–20, ≤30 lines/order, `note` ≤200 chars, names 1–80, `message` ≤1000.

### Error codes

| Code | Meaning |
|------|---------|
| `TABLE_INACTIVE` / `TABLE_NOT_FOUND` | Bad `?table=` |
| `ITEM_NOT_FOUND` / `SOLD_OUT` | Item removed or unavailable |
| `BAD_QTY` / `TOO_MANY_LINES` / `NOTE_TOO_LONG` | Limit breach |
| `TYPE_DISABLED` | Pickup/delivery switched off |
| `BAD_PHONE` / `ADDRESS_REQUIRED` / `BELOW_MINIMUM` | Online-order validation |
| `RATE_LIMITED` / `SPAM_DETECTED` | Honeypot / per-phone hourly cap |
| `NOT_FOUND` / `PHONE_MISMATCH` | Tracking lookup |
| `BAD_TRANSITION` / `ALREADY_CANCELLED` / `ALREADY_PAID` | Status/payment guards |
| `FORBIDDEN` / `UNAUTHENTICATED` | Role / login |
| `VALIDATION_ERROR` / `INTERNAL` | Generic / unexpected |

## 2. Auth — `js/api/auth.js`

### `login(email, password)` → `{ data: { user, role }, error }`

```js
// request
await login("admin@khabargolpo.test", "••••••");
// success
{ data: { user: { id: "uuid", email: "admin@…" }, role: "admin" }, error: null }
// failure
{ data: null, error: { code: "UNAUTHENTICATED", message: "Wrong email or password." } }
```

### `logout()` → `{ data: true, error: null }`
### `getSession()` → `{ data: { user, role } | null, error: null }` — role from `profiles`.

## 3. Public — `js/api/public.js` (no login)

| Function | Request | Response `data` |
|----------|---------|-----------------|
| `getSettings()` | — | `{ restaurant_name, phone, address, hours, tax_percent, pickup_enabled, delivery_enabled, delivery_fee, min_delivery_amount, prep_time_minutes, … }` |
| `getCategories()` | — | `[{ id, name, sort_order }]` |
| `getMenu()` | — | `[{ id, category_id, name, description, price, image_url, is_veg, is_available, is_featured }]` (available + sold-out; deleted excluded) |
| `getGallery()` | — | `[{ id, image_url, caption }]` ordered |
| `getApprovedReviews()` | — | `[{ name, rating, message }]` — no phone/PII |
| `checkTable(n)` | `{ table_number: 5 }` | `{ exists: true, is_active: true }` or error `TABLE_NOT_FOUND/TABLE_INACTIVE` |
| `createReservation({name,phone,date,time,guests,note,honeypot})` | date `YYYY-MM-DD`, `honeypot: ""` | `{ id, status: "pending" }` |
| `submitFeedback({type,name,phone?,rating?,message})` | `rating` required iff `type:"review"` | `{ id }` (always unapproved) |

Example:

```js
await createReservation({ name: "Rahim", phone: "01712345678", date: "2026-10-20", time: "19:00", guests: 4, note: "", honeypot: "" });
// → { data: { id: "uuid", status: "pending" }, error: null }
```

## 4. Ordering — `js/api/ordering.js` (no login)

### `placeDineInOrder({ table_number, lines, note? })`

```js
// request
await placeDineInOrder({ table_number: 5, lines: [{ item_id: "uuid-burger", qty: 2 }, { item_id: "uuid-fries", qty: 1 }], note: "less spicy" });
// success
{ data: { id: "order-uuid", receipt_number: "KG-1042", total: 545.00, tracking_url: "/track?id=order-uuid" }, error: null }
// failures
{ data: null, error: { code: "SOLD_OUT", message: "Fries is sold out. Please remove it." } }
{ data: null, error: { code: "TABLE_INACTIVE", message: "This table is not active." } }
```

Server: validates table active, items exist+available, qty/limits; prices+tax from DB; single transaction; receipt `KG-XXXX`.

### `placeOnlineOrder({ order_type, lines, name, phone, address?, address_note?, pickup_time?, note?, honeypot })`

```js
// delivery request
await placeOnlineOrder({ order_type: "delivery", lines: [{ item_id: "uuid", qty: 2 }], name: "Sara", phone: "01712345678", address: "House 5, Road 2, Dhanmondi", address_note: "Near park", note: "", honeypot: "" });
// success
{ data: { id: "order-uuid", receipt_number: "KG-1043", subtotal: 500.00, tax: 25.00, delivery_fee: 60.00, total: 585.00, tracking_url: "/track?id=order-uuid" }, error: null }
```

Pickup omits `address`; `pickup_time` optional. Errors: `TYPE_DISABLED`, `BAD_PHONE`, `ADDRESS_REQUIRED`, `BELOW_MINIMUM` (message includes minimum), `RATE_LIMITED`, `SPAM_DETECTED`.

### `trackOrder({ receipt_number, phone })` and `getOrderById(id)`

```js
await trackOrder({ receipt_number: "KG-1042", phone: "01712345678" });
// → { data: { id, receipt_number, order_type, status, items: [{ name, qty, unit_price, line_total }], subtotal, tax, delivery_fee, total, eta_minutes: 25, delivery_note: "Pathao • …" | null }, error: null }
```

Timelines: dine-in `new→preparing→ready`; pickup `+completed`; delivery `ready→out_for_delivery→completed`; `cancelled` terminal. Wrong phone → `PHONE_MISMATCH` (never reveal which half was wrong beyond message).

## 5. Kitchen — `js/api/kitchen.js` (chef or admin JWT)

### `getActiveOrders()` → `{ data: OrderCard[], error }`

```js
// chef view (PII-redacted, no prices)
{ data: [{ id, receipt_number, order_type, table_number: 5 | null, first_name: "Sa" | null, pickup_time: "19:30" | null, status: "preparing", items: [{ name, qty }], note, created_at, wait_minutes: 12 }], error: null }
```

Admin calling same fn gets full card (phone/address/totals) — decided server-side by role.

### `subscribeOrders(onEvent)` → `{ unsubscribe }`

Realtime `INSERT/UPDATE/DELETE` on `orders` (+ `order_items` join refresh). Client falls back to 10–15 s polling if channel fails.

### `updateStatus(order_id, to)` — chef: `new→preparing→ready`, `ready→preparing`; admin: all legal

```js
await updateStatus("order-uuid", "preparing");
// → { data: { id, status: "preparing" }, error: null }
// illegal → { data: null, error: { code: "BAD_TRANSITION", message: "Cannot move from new to ready." } }
```

### `setAvailability(item_id, is_available)` — chef + admin

```js
await setAvailability("item-uuid", false);
// → { data: { id: "item-uuid", is_available: false }, error: null }
```

## 6. Admin Orders — `js/api/adminOrders.js` (admin JWT)

```js
listOrders({ from?, to?, type?, table?, status?, payment?, page?, per_page? })
// → { data: { rows: [{ id, receipt_number, order_type, table_number, customer_name, customer_phone, total, status, payment_status, created_at }], total_count }, error: null }

getOrder(id)  // full order + lines + receipt fields + delivery_note
cancelOrder(id)              // → { data: { id, status: "cancelled" } } ; paid/cancelled → ALREADY_*
markOutForDelivery(id, { delivery_note? })  // delivery only, from ready
markDelivered(id) | markPickedUp(id)        // terminal completed (+paid still separate)
markPaid(id)                 // → { data: { id, payment_status: "paid", paid_at } } ; cancelled → ALREADY_CANCELLED
tableBill(table_number)      // → { data: { orders: [{ receipt_number, total }], combined_total } } (unpaid, non-cancelled dine-in)
markTablePaid(table_number)  // → { data: { paid_count, combined_total } }
```

Receipt contents (rendered from `getOrder`): name/address/phone, receipt no, datetime, type/table-or-customer, lines (qty×unit=line), subtotal, tax, delivery fee, grand total, payment method (Cash), thank-you.

## 7. Admin Content — `js/api/adminContent.js` (admin JWT)

```
Categories: createCategory({name}) | updateCategory(id,{name,sort_order}) | deleteCategory(id) — fails if items exist
Items: createItem({...}) | updateItem(id,{...}) | deleteItem(id) | uploadItemImage(file) → { image_url }
  validation: name 1–80, price >0, image/* ≤2MB → Storage menu-images/<uuid>.ext
Tables: createTable({table_number}) | setTableActive(n,bool) | listTables() → [{ table_number, is_active, qr_url: "/order?table=N" }]
Reservations: listReservations({date?,status?}) | setReservationStatus(id,"confirmed"|"cancelled")
Feedback: listFeedback({unread_only?}) | setFeedbackRead(id) | approveReview(id,bool) | deleteFeedback(id)
Gallery: listGallery() | addGalleryImage({file,caption}) | deleteGalleryImage(id)
Settings: getSettingsFull() | updateSettings({...}) — tax 0–50, fees ≥0, toggles, hours, timezone
```

All mutations return the saved row; deletes return `{ id, deleted: true }`.

## 8. Reports — `js/api/reports.js` (admin JWT)

```js
revenueSummary()  // → { data: { today, week_mon_sun, month, year }, error: null }  (paid && !cancelled, by paid_at + timezone)
salesReport({ from, to, group: "day"|"week"|"month" })
 // → { data: { rows: [{ bucket: "2026-10-01", orders, gross, delivery_fees }], csv_url? }, error: null }
topItems({ from, to, limit? })  // → { data: [{ name, qty, gross }] }
salesByType({ from, to })       // → { data: { dine_in: {...}, pickup: {...}, delivery: {...} } } (fees split out)
```

CSV export: client builds from `salesReport` rows (header `date,orders,gross,delivery_fees`).

## 9. Types (shared)

```ts
type OrderType = "dine-in" | "pickup" | "delivery";
type OrderStatus = "new" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
type Money = number; // 2dp
interface OrderLine { item_id: string; qty: number; }          // request
interface OrderLineSaved { name: string; qty: number; unit_price: Money; line_total: Money; } // response
```

## 10. Versioning

- v1 frozen with this doc. Additive changes (new optional fields) need no version bump; breaking changes (rename/remove, new required input, new status) require `v2` RPC name + updated `js/api/*` + note here.
