# Khabar Golpo — Database

> Owner: Mushfique | Backend: Sohana | Platform: Supabase Postgres (Free Tier) | SQL sources in `supabase/` (`schema.sql`, `functions.sql`, `rls.sql`, `seed.sql`)

## 1. ER Overview

```
auth.users 1──1 profiles (role: admin | chef)

categories 1──* menu_items 1──* order_items *──1 orders *──0..1 tables

Stand-alone: reservations · feedback · gallery_images · settings (single row)
```

- `orders` is the central fact table. Each order has 1–30 `order_items`.
- `order_items` **snapshots** `item_name` + `unit_price` at order time so menu edits never rewrite history.
- `tables` only linked for `order_type = 'dine-in'`.
- `settings` has exactly one row (`id = 1`).

## 2. Tables

### 2.1 profiles

Extends `auth.users`. Created manually; no public sign-up.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | FK → auth.users.id, ON DELETE CASCADE |
| role | text | CHECK IN ('admin','chef'), NOT NULL |
| created_at | timestamptz | DEFAULT now() |

Seed: 1 admin + 1 chef.

### 2.2 categories

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| name | text | NOT NULL, UNIQUE, CHECK length 1–60 |
| sort_order | int | DEFAULT 0 |
| created_at | timestamptz | DEFAULT now() |

### 2.3 menu_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| category_id | uuid | FK → categories.id ON DELETE RESTRICT, NOT NULL |
| name | text | NOT NULL, 1–80 chars |
| description | text | DEFAULT '', ≤500 chars |
| price | numeric(10,2) | NOT NULL, CHECK > 0 AND ≤ 100000 |
| image_url | text | NULL (Storage URL) |
| is_veg | boolean | DEFAULT false |
| is_available | boolean | DEFAULT true (false = sold out) |
| is_featured | boolean | DEFAULT false (signature / 3D viewer) |
| sort_order | int | DEFAULT 0 |
| created_at / updated_at | timestamptz | DEFAULT now() |

Indexes: `(category_id, is_available)`, `(is_featured) WHERE is_featured`.

### 2.4 tables

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| table_number | int | NOT NULL, UNIQUE, CHECK > 0 AND < 500 |
| is_active | boolean | DEFAULT true (false = deactivated) |
| created_at | timestamptz | DEFAULT now() |

QR link (built client-side, not stored): `https://<site>/order?table=<table_number>`.

### 2.5 orders

| Column | Type | Constraints / Notes |
|--------|------|---------------------|
| id | uuid PK | DEFAULT gen_random_uuid() — also used as unguessable tracking id |
| receipt_number | text UNIQUE | NOT NULL, format `KG-XXXX` (sequence, e.g. KG-1042), generated in RPC |
| order_type | text | NOT NULL, CHECK IN ('dine-in','pickup','delivery') |
| table_id | uuid NULL | FK → tables.id, NULL unless dine-in; must point to active table |
| customer_name | text NULL | Required for pickup/delivery, 1–80 chars |
| customer_phone | text NULL | Required for pickup/delivery, regex `^(\+8801|01)[3-9]\d{8}$` (BD / international) — adjust per locale |
| delivery_address | text NULL | Required for delivery, 5–300 chars |
| address_note | text NULL | Landmark/note, ≤200 chars |
| pickup_time | text NULL | Optional free-text / time for pickup |
| note | text NULL | Order note, ≤200 chars |
| status | text | DEFAULT 'new', CHECK IN ('new','preparing','ready','out_for_delivery','completed','cancelled') |
| payment_status | text | DEFAULT 'unpaid', CHECK IN ('unpaid','paid') |
| subtotal / tax_amount / delivery_fee / total | numeric(10,2) | NOT NULL, computed server-side; `total = subtotal+tax+delivery_fee` |
| delivery_note | text NULL | Admin-added agency/rider note |
| created_at | timestamptz | DEFAULT now() |
| paid_at | timestamptz NULL | Set on mark-paid; revenue groups by this |

Checks:
- dine-in → `table_id NOT NULL`, customer fields NULL-allowed.
- pickup/delivery → `table_id IS NULL`, name+phone required.
- delivery → address required, `delivery_fee` from settings.
- `payment_status='paid'` forbidden when `status='cancelled'`.
- Allowed transitions enforced in `update_order_status()` (see §4).

Indexes: `(status, created_at DESC)`, `(order_type, created_at DESC)`, `(customer_phone, created_at DESC)`, `(receipt_number)`, `(table_id) WHERE payment_status='unpaid' AND status != 'cancelled'`.

### 2.6 order_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| order_id | uuid | FK → orders.id ON DELETE CASCADE, NOT NULL |
| menu_item_id | uuid | FK → menu_items.id ON DELETE RESTRICT, NOT NULL |
| item_name | text | Snapshot, NOT NULL |
| unit_price | numeric(10,2) | Snapshot, NOT NULL, > 0 |
| quantity | int | CHECK 1–20 |
| line_total | numeric(10,2) | `unit_price * quantity` |

Max 30 lines per order (enforced in RPC). Index: `(order_id)`.

### 2.7 reservations

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| name | text | NOT NULL, 1–80 |
| phone | text | NOT NULL, same phone regex |
| date | date | NOT NULL, CHECK >= CURRENT_DATE |
| time | time | NOT NULL |
| guests | int | CHECK 1–50 |
| note | text | ≤300 chars |
| status | text | DEFAULT 'pending', CHECK IN ('pending','confirmed','cancelled') |
| created_at | timestamptz | DEFAULT now() |

Index: `(date, status)`.

### 2.8 feedback

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| type | text | CHECK IN ('review','query','suggestion'), NOT NULL |
| name | text | NOT NULL, 1–80 |
| phone | text NULL | Optional |
| rating | int NULL | Required if review, CHECK 1–5 |
| message | text | NOT NULL, 1–1000 chars |
| is_approved | boolean | DEFAULT false (only approved reviews go public) |
| is_read | boolean | DEFAULT false |
| created_at | timestamptz | DEFAULT now() |

Index: `(is_approved, created_at DESC)` for public slider.

### 2.9 gallery_images

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid PK | DEFAULT gen_random_uuid() |
| image_url | text | NOT NULL |
| caption | text | ≤150 chars |
| sort_order | int | DEFAULT 0 |
| created_at | timestamptz | DEFAULT now() |

### 2.10 settings (single row, id=1)

| Column | Type | Default |
|--------|------|---------|
| id | int PK CHECK (=1) | 1 |
| restaurant_name, tagline, address, phone, email, hours | text | seeded |
| logo_url | text NULL | — |
| tax_percent | numeric(5,2) | 0, CHECK 0–50 |
| timezone | text | e.g. `Asia/Dhaka` |
| pickup_enabled / delivery_enabled | boolean | true |
| delivery_fee | numeric(10,2) | 0 |
| min_delivery_amount | numeric(10,2) | 0 (0 = no minimum) |
| delivery_area_note | text | '' |
| prep_time_minutes | int | e.g. 25 |
| pickup_hours | text | '' |

Only admin can UPDATE.

## 3. Receipt Numbering

- Sequence `receipt_seq` → formatted `KG-<n>` (e.g. `KG-1042`) inside order RPC in a single transaction to avoid duplicates under concurrency.
- Never reused; cancelled orders keep their number.

## 4. Functions (RPC)

All in `supabase/functions.sql`, `SECURITY DEFINER` where they must bypass RLS + explicit role checks via `auth.jwt()`.

| Function | Who | What |
|----------|-----|------|
| `place_dinein_order(p_table_number int, p_lines jsonb, p_note text)` | anon | Validates table active, items exist+available, qty/limits, computes totals from DB prices + tax, inserts order+lines, returns receipt+total+id |
| `place_online_order(p_type text, p_lines jsonb, p_name text, p_phone text, p_address text, p_address_note text, p_pickup_time text, p_note text)` | anon | Checks type enabled, phone/address/min-order, rate limit (N/hour per phone), honeypot must be empty, computes totals+delivery fee |
| `track_order(p_receipt text, p_phone text)` / `get_order_by_id(p_id uuid)` | anon (guarded) | Returns order+lines only if receipt+phone match, or id is unguessable link |
| `update_order_status(p_order uuid, p_to text)` | chef+admin | Validates transition matrix; chef limited to new→preparing→ready (+ready→preparing); admin full except terminal guards |
| `cancel_order(p_order uuid)` | admin | Only unfinished orders; sets cancelled |
| `mark_paid(p_order uuid)` / `mark_table_paid(p_table int)` | admin | Refuses cancelled; sets paid_at=now() |
| `table_bill(p_table int)` | admin | All unpaid, non-cancelled dine-in orders of table + combined total |
| `set_availability(p_item uuid, p_avail bool)` | chef+admin | Sold-out toggle |
| `revenue_summary()` / `sales_report(from,to,group)` / `top_items(from,to)` / `sales_by_type(from,to)` | admin | Aggregate paid && !cancelled by paid_at in settings.timezone; delivery fees split out |

Transition matrix enforced:

```
new → preparing → ready → [dine-in: paid] | [pickup: completed] | [delivery: out_for_delivery → completed]
ready → preparing (correction, chef+admin)
any non-terminal (not completed/cancelled) → cancelled (admin)
```

## 5. RLS Summary (details in Security.md)

- `categories, menu_items, gallery_images (approved view), settings`: public SELECT; write admin-only.
- `orders, order_items`: anon can INSERT only via RPC; SELECT restricted (admin full, chef active-non-PII view, customer own-order via RPC only).
- `reservations, feedback`: anon INSERT-only (forced pending/unapproved); admin full; no public SELECT except approved reviews via RPC/view.
- `profiles`: self-read + admin-read.
- Storage: public read, admin write, image MIME + 2 MB.

## 6. Indexes & Performance

- Hot paths indexed: kitchen feed `(status, created_at)`, admin filters, tracking `(receipt_number)`.
- Menu list is small — full fetch + client filter; no full-text index needed v1...
- Reports aggregate on `paid_at` range; keep range bounded, paginate, CSV export server-side in chunks.

## 7. Seed & Migrations

- `seed.sql`: 1 admin + 1 chef (Auth created manually, then profiles rows), sample categories/items, tables 1–10, settings row, demo gallery.
- Dev vs prod: identical schema, different Supabase projects. Migrations are numbered SQL files; never edit applied migration — add new one.
- Backup: Supabase daily backup (prod); export CSV reports as secondary record.

## 8. Storage Buckets

| Bucket | Public | Write | Limits |
|--------|--------|-------|--------|
| menu-images | read | admin only | image/*, ≤2 MB, compress client-side |
| gallery-images | read | admin only | image/*, ≤2 MB |

File path convention: `<bucket>/<uuid>.<ext>`.
