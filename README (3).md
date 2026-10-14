# Khabar Golpo 🍽️

Khabar Golpo is a complete restaurant website and management system. Customers can read the story, browse the menu, view the gallery, book a table, and send feedback. They can order three ways: **dine-in** by scanning a QR code at the table, **pickup**, or **delivery** (handled by an outside delivery agency). Orders can be tracked live. The kitchen sees orders as they arrive, and the admin runs the whole restaurant from one panel.

---

## Table of Contents

1. [Team](#1-team)
2. [Tech Stack](#2-tech-stack)
3. [System Overview](#3-system-overview)
4. [Features](#4-features)
5. [Workflows](#5-workflows)
6. [System Design](#6-system-design)
7. [Project Structure](#7-project-structure)
8. [Default Settings and Assumptions](#8-default-settings-and-assumptions)

---

## 1. Team

| Member | Name | Responsibility |
|--------|------|----------------|
| Member-1 | Sohana | **Backend part:** API layer, database functions, security rules |
| Member-2 | Farhana | **Frontend part:** all pages, design, animations |
| Member-3 | Mushfique | **Database part:** database design and setup |
| Member-4 | Anamika | **API:** API documentation and API testing |
| Member-5 | Noshin | **Bug testing:** quality assurance and bug reports |

---

## 2. Tech Stack

| Area | Tools |
|------|-------|
| Frontend | HTML, CSS, JavaScript |
| Database and backend services | Supabase (database, login, realtime, storage) on the free tier |
| QR codes | QR code image API |
| Hosting | Vercel |

There is no custom server. The pages talk to Supabase through one JavaScript API layer. Every library is free.

---

## 3. System Overview

| Panel | Users | Purpose |
|-------|-------|---------|
| **Customer website** | Everyone | Story, menu, gallery, reservations, contact, feedback |
| **Order pages** | Diners and online customers | Dine-in (QR), pickup, and delivery ordering, plus live tracking |
| **Kitchen panel** | Chef | See and update orders live |
| **Admin panel** | Admin | Orders, delivery handling, receipts, menu, tables, reservations, feedback, gallery, reports, settings |

**Order types**

| Type | How the customer orders | Payment |
|------|------------------------|---------|
| **Dine-in** | Scans the QR code on the table | Cash at the table |
| **Pickup** | Orders on the website, collects at the restaurant | Cash at pickup |
| **Delivery** | Orders on the website, an outside delivery agency delivers | Cash on delivery |

**Not included:** staff management, waiter assignment or alerts, staff performance tracking, online payment, loyalty points, customer accounts, and a delivery-person panel.

### Sitemap

```
/                        Customer website (one scrolling page)
│   #home  #story  #menu  #gallery  #reservation  #contact  #feedback
│
/order?table=N           Dine-in order page (opened by QR code)
/order-online            Pickup / delivery order page
/track                   Order tracking

/kitchen                 Kitchen panel (chef login)

/admin/login             Admin login
/admin/dashboard         Revenue and today's overview
/admin/orders            All orders, delivery handling, payment
/admin/receipt           Receipt and combined bill
/admin/delivery-slip     Printable delivery slip
/admin/menu              Categories and items
/admin/tables            Tables and QR codes
/admin/reservations      Bookings
/admin/feedback          Reviews, queries, suggestions
/admin/gallery           Photos
/admin/reports           Sales reports and CSV
/admin/settings          Restaurant info, tax, delivery, hours
```

---

## 4. Features

### 4.1 Customer Website

| Section | Features |
|---------|----------|
| **Navbar** | Sticky, turns solid with a soft shadow on scroll, smooth-scroll links, "Order Online" button, hamburger menu on mobile |
| **Hero** | Full-screen intro animation, 3D hero object (loads lazily, static image fallback), "Order Online" and "Book a Table" buttons |
| **Our Story** | Story text, chef or owner note, image with scroll-reveal animation |
| **Menu (view-only)** | Category tabs, search, veg/non-veg filter, cards with photo, name, description, price, veg badge, "Sold out" tag, featured badge. Cards tilt on hover. Signature dishes can open a drag-to-rotate 3D viewer |
| **Gallery** | Grid or slider, click-to-enlarge popup with keyboard close |
| **Reservation** | Name, phone, date, time, guests, note. Validation, spam trap, success message. Saved as *pending* |
| **Contact** | Address, phone, email, opening hours, map, social links |
| **Feedback / Review / Queries** | Type (Review, Query, Suggestion), star rating for reviews, message. Approved reviews appear in a slider |
| **General** | loading skeletons, friendly error messages, responsive from 360px, respects "reduce motion" |

### 4.2 Dine-in Order Page (QR)

| Feature | Behaviour |
|---------|-----------|
| **Table badge** | "Table 5" fixed at the top, taken from the QR link and checked against the database |
| **Menu** | Category tabs, search, large tap targets. Sold-out items are greyed out and cannot be added |
| **Cart drawer** | Slides in. Add, change quantity, remove. Small bounce animation on add |
| **Running total** | Subtotal, tax (if set), total. Display only: the database recalculates on submit |
| **Order note** | Optional, up to 200 characters ("less spicy") |
| **Sticky cart bar** | Item count and total, always visible |
| **Place order** | Button disables while sending to stop double orders |
| **Confirmation** | Animated checkmark, receipt number, "Order again" button |
| **Errors** | Invalid table, item sold out, item removed, no network. The cart is kept so the customer can retry |
| **Weight** | No 3D libraries, so it loads fast on a phone |

### 4.3 Pickup and Delivery Order Page (`/order-online`)

| Step | Features |
|------|----------|
| **1. Menu and cart** | Same menu, search, categories, and cart as the dine-in page |
| **2. Pickup / Delivery choice** | After the cart, the customer picks one of two clear options. An option that the admin has switched off is hidden |
| **3. Customer info** | **Name** (required) · **Phone** (required, format checked) · **Address** (required for delivery only: street or area, plus a landmark or note) · optional preferred pickup time (pickup only) · optional order note |
| **4. Summary** | Items, subtotal, tax, **delivery fee** (delivery only, set by the admin), total. Payment: cash at pickup or cash on delivery |
| **5. Place order** | Button disables while sending. Confirmation shows the receipt number and a "Track my order" link |
| **Checks** | Delivery needs an address. Minimum order amount for delivery (if set). Clear message if delivery or pickup is switched off |
| **Protection** | Hidden spam field, input limits, and a limit on how many orders one phone number can place per hour |

Customers do not need an account.

### 4.4 Order Tracking (`/track`)

- Opened from the confirmation link, or by entering the **receipt number and phone number**.
- Status timeline that refreshes automatically:

| Order type | Timeline |
|------------|----------|
| Dine-in | Received → Preparing → Ready |
| Pickup | Received → Preparing → Ready for pickup → Picked up |
| Delivery | Received → Preparing → Ready → Out for delivery → Delivered |

- Order details: items, order type, total
- Estimated time (from the admin's preparation-time setting)
- Optional delivery agency note (agency name or tracking link, if the admin adds one)
- "Call restaurant" button

### 4.5 Kitchen Panel

| Feature | Behaviour |
|---------|-----------|
| **Login** | Chef account only |
| **Live feed** | New orders appear within seconds, with no refresh |
| **Order cards** | Order type badge (Dine-in Table 5, Pickup, or Delivery), receipt number, items with quantities, note, time placed. Pickup and delivery cards show the customer's first name and pickup time |
| **Status buttons** | New → Preparing → Ready (Ready can go back to Preparing to fix a mistake) |
| **Item summary** | Total quantity of each item across all active orders (e.g. *Burger ×7, Fries ×12*) |
| **Table-wise view** | Switch to see dine-in orders grouped by table |
| **Waiting time** | Live timer on each card. Old orders are highlighted |
| **Sold-out toggle** | Chef marks an item unavailable, and the menus update |
| **Sound alert (optional)** | Chef taps "Enable sound" once, because browsers block sound until the user taps |
| **Privacy** | No prices, revenue, phone numbers, or addresses are shown |
| **Cleanup** | Completed, paid, and cancelled orders leave the feed |

### 4.6 Admin Panel

| Page | Features |
|------|----------|
| **Dashboard** | Today's orders, pending orders, today's sales, top-selling items, order counts by type, and **revenue for today, this week, this month, and this year** |
| **Orders** | List of **all orders** with type, table or customer name, phone, address, items, total, status, payment. Filter by date, type, table, status, payment. Pagination |
| **Order actions** | Cancel · **Out for delivery** (with optional agency or rider note) · **Delivered** · **Picked up** · **Mark as Paid (Cash)** · tap-to-call the customer · copy address |
| **Receipts** | Receipt created automatically for every order. Print from the browser. **Combined bill** for all unpaid dine-in orders of one table, with **Mark table paid** |
| **Delivery slip** | Printable page with customer name, phone, address, items, and the amount to collect, to hand to the delivery agency |
| **Menu** | Add, edit, delete categories and items. Price, description, image upload, veg flag, featured flag, availability toggle, ordering |
| **Tables and QR** | Add or deactivate tables. QR code generated automatically for each table. Print one or all QR codes |
| **Reservations** | List by date. Confirm or cancel after calling the customer |
| **Feedback** | Read or unread. Approve reviews for the website. Delete |
| **Gallery** | Upload and delete photos, with captions |
| **Reports** | Daily, weekly, monthly, and yearly sales. Best sellers. Orders per day. Sales split by dine-in, pickup, and delivery, with delivery fees shown separately. CSV export |
| **Settings** | Restaurant name, tagline, address, phone, email, opening hours, tax percentage, time zone, logo · turn **pickup** and **delivery** on or off · **delivery fee** · **minimum delivery order** · delivery area note · estimated preparation time · pickup hours |

**Receipt contents:** restaurant name, address, phone · receipt number · date and time · order type · table number (dine-in) or customer name, phone, and address (pickup and delivery) · items with quantity, unit price, line total · subtotal · tax · delivery fee · grand total · payment method · thank-you note.

---

## 5. Workflows

### 5.1 Table and QR Setup

```
Admin adds Table 5
      │
      ▼
Admin page builds the link  https://<site>/order?table=5
      │
      ▼
QR image is generated  ──►  Admin prints it  ──►  Placed on Table 5
```

### 5.2 Dine-in Order

```
 1  Diner scans QR ───────────► order page opens with "Table 5"
 2  Diner picks items ────────► cart shows the running total
 3  Diner taps Place order ───► database checks, prices, saves, assigns receipt KG-1042
 4  Confirmation shown ───────► receipt number appears
 5  Kitchen card appears ─────► chef taps Preparing, then Ready
 6  Admin sees the order and its receipt
 7  Waiter serves the food and hands over the printed receipt
 8  Diner pays cash ──────────► admin taps Mark as Paid
 9  Order counts in revenue ──► leaves the kitchen feed
```

### 5.3 Pickup Order

```
 1  Customer opens Order Online, adds items to the cart
 2  Chooses Pickup, enters name and phone (and optional pickup time)
 3  Places order ─────────────► receipt number + tracking link
 4  Kitchen prepares it ──────► Preparing → Ready
 5  Customer sees "Ready for pickup" on the tracking page
 6  Customer arrives and pays cash ──► admin taps Picked up and Mark as Paid
```

### 5.4 Delivery Order

```
 1  Customer opens Order Online, adds items to the cart
 2  Chooses Delivery, enters name, phone, and address
 3  Summary shows the delivery fee ──► places order ──► receipt number + tracking link
 4  Kitchen prepares it ──────► Preparing → Ready
 5  Admin prints the delivery slip and hands the order to the delivery agency
 6  Admin taps Out for delivery (optional agency or rider note)
 7  Customer sees "Out for delivery" on the tracking page
 8  Agency delivers and collects cash ──► admin taps Delivered
 9  Admin receives the cash ──► taps Mark as Paid
```

### 5.5 Billing and Receipts

```
Per order:    receipt auto-created ──► printed ──► cash received ──► Mark as Paid
Whole table:  Combined bill (all unpaid, non-cancelled orders of Table 5) ──► Mark table paid
Any order:    Print the receipt again whenever needed
Delivery:     Delivery slip for the agency, showing the amount to collect
```

### 5.6 Reservation

```
Customer submits the form ──► saved as "pending" ──► admin sees it
      ──► admin phones the customer ──► sets "confirmed" or "cancelled"
```

### 5.7 Feedback and Reviews

```
Customer submits ──► saved hidden ──► admin reads it
      ├─ review ──► Approve ──► appears on the website (name, rating, message only)
      └─ query or suggestion ──► read, then delete or follow up by phone
```

### 5.8 Menu and Availability

```
Admin edits an item or uploads an image ──► customers see it on the next load
Chef or admin toggles "Sold out" ──────────► item is greyed out and cannot be ordered
```

### 5.9 Revenue and Reports

```
Dashboard opens ──► database sums PAID, non-cancelled orders
                    for today, this week (Mon–Sun), this month, this year
                    in the restaurant's time zone
Reports page ──► choose dates and grouping ──► table, best sellers, split by order type, CSV export
```

### 5.10 Login and Roles

```
Admin or chef opens a panel ──► not logged in? redirect to login
      ──► email and password ──► role checked
            ├─ admin ──► admin panel
            └─ chef  ──► kitchen panel only
Wrong role ──► blocked by the page AND by the database rules
```

### 5.11 Order Status Rules

```
 Dine-in:   new ──► preparing ──► ready                                   (then paid)
 Pickup:    new ──► preparing ──► ready ──► completed (picked up)
 Delivery:  new ──► preparing ──► ready ──► out for delivery ──► completed (delivered)

 Any unfinished order ──► cancelled        (admin only)
 Payment: unpaid ──► paid                  (admin only, never on a cancelled order)
```

| Action | Chef | Admin | Customer |
|--------|:----:|:-----:|:--------:|
| Place an order | | | ✔ |
| new → preparing → ready | ✔ | ✔ | |
| Out for delivery, Delivered, Picked up | | ✔ | |
| Cancel an order | | ✔ | |
| Mark as paid | | ✔ | |
| Track an order | | ✔ | ✔ (own order only) |

### 5.12 Problem Cases

| Situation | What happens |
|-----------|--------------|
| Item sold out while ordering | Order rejected with a message naming the item. Customer removes it |
| Item removed from the menu | Message asks the customer to refresh |
| Network drops | Friendly error, cart kept, retry works |
| Double tap on Place order | Button disabled after the first tap |
| Same table orders again | New order, new receipt. The combined bill merges them |
| Delivery switched off by admin | Delivery option hidden, message shown |
| Delivery order without an address | Blocked with a clear message |
| Order below the delivery minimum | Blocked, showing the minimum amount |
| Too many orders from one phone | Temporarily blocked with a message |
| Admin cancels an order | Leaves the kitchen feed, excluded from revenue, tracking shows "Cancelled" |
| Price edited in the browser | Ignored: the database uses its own prices |

---

## 6. System Design

### 6.1 Architecture

```
 Diner phone ─────────► order.html ───────────┐
 Online customer ─────► order-online.html ────┤
 Anyone ──────────────► index.html, track.html┤
 Chef tablet ─────────► kitchen.html ─────────┼──► JS API layer ──► Supabase
 Admin computer ──────► admin/*.html ─────────┘                      ├─ Postgres  (tables + database functions)
                                                                     ├─ Auth      (admin and chef login)
        Static files hosted on Vercel                                ├─ Realtime  (live kitchen orders)
                                                                     └─ Storage   (menu and gallery images)
```

The pages never talk to Supabase directly. They call the **API layer**, which can also return fake data (mock mode), so the frontend can be built before the database is ready.

### 6.2 Data Flow: Placing a Dine-in Order

```
Diner phone        Order page + API layer          Supabase                        Kitchen / Admin
    │ scan QR ───────► read ?table=5
    │                  check table 5 ───────────────► is the table active?
    │                  ◄──────────── ok
    │ pick items, see total (display only)
    │ Place order ───► send table, item IDs,       ► place-order function:
    │                  quantities, note               • table active? items exist and available?
    │                                                 • quantities 1–20?
    │                                                 • totals from DATABASE prices
    │                                                 • receipt number KG-1042
    │                                                 • save order and order lines
    │                  ◄───────── receipt number, total
    │ confirmation ◄──
    │                                               live event ───────────────────► kitchen card appears
    │                                               list refresh ──────────────────► admin sees order and receipt
```

### 6.3 Data Flow: Placing a Pickup or Delivery Order

```
Customer           Order Online page + API layer    Supabase                        Kitchen / Admin
    │ items in cart
    │ choose Pickup or Delivery
    │ enter name, phone (address if delivery)
    │ Place order ───► send items, order type,     ► online-order function:
    │                  customer info, note            • pickup / delivery switched on?
    │                                                 • phone format, address (delivery), minimum order
    │                                                 • order limit per phone number
    │                                                 • totals and delivery fee from DATABASE values
    │                                                 • receipt number, save order and lines
    │                  ◄───────── receipt number, tracking link
    │ confirmation ◄──
    │                                               live event ───────────────────► kitchen card (type badge, first name)
    │                                               list refresh ──────────────────► admin order with phone and address
```

### 6.4 Data Flow: Tracking and Status Changes

```
Chef taps Preparing ──► status function checks the move is allowed ──► order row changes
      ──► live event ──► every open kitchen screen refreshes
      ──► the customer's tracking page refreshes within seconds
      ──► admin orders list shows the new status

Admin taps Out for delivery or Delivered ──► same path ──► tracking page timeline moves forward
```

Tracking works only with the unguessable order link, or with the receipt number **and** the matching phone number.

### 6.5 Data Model

```
 auth users 1──1 profiles (role: admin or chef)

 categories 1──* menu items 1──* order items *──1 orders *──0..1 tables

 Stand-alone: reservations · feedback · gallery images · settings (one row)
```

| Table | Key content |
|-------|-------------|
| **menu items** | name, price, image, veg flag, availability, featured flag |
| **orders** | receipt number, **order type** (dine-in, pickup, delivery), table (dine-in only), **customer name, phone, address, address note, pickup time** (pickup and delivery), status, payment status, subtotal, tax, **delivery fee**, total, delivery agency note, created and paid times |
| **order items** | **item name and price copied at order time**, quantity, line total |
| **tables** | table number, active flag |
| **reservations** | name, phone, date, time, guests, status |
| **feedback** | type, rating, message, approved flag, read flag |
| **gallery images** | image, caption, order |
| **settings** | restaurant info, tax percentage, time zone, pickup on/off, delivery on/off, delivery fee, minimum delivery order, preparation time |

Item names and prices are copied into each order line, so later menu changes never alter old receipts.

### 6.6 Main API Functions

| Group | Functions |
|-------|-----------|
| **Login** | log in, log out, get current user and role |
| **Public** | get settings, categories, menu items, gallery, approved reviews · create reservation · submit feedback · check a table |
| **Ordering** | place dine-in order · place pickup or delivery order · track order |
| **Kitchen** | get active orders · listen for live order changes · update order status · set item availability |
| **Admin orders** | list orders with filters · get one order · cancel · mark out for delivery · mark delivered or picked up · mark paid · get table bill · mark table paid |
| **Admin content** | create, edit, delete categories and menu items · upload images · manage tables · manage reservations · manage feedback · manage gallery · update settings |
| **Reports** | revenue summary (today, week, month, year) · sales report · top items · sales by order type |

Every function returns the same shape: the data, or a clear error with a code and a friendly message.

### 6.7 Security

```
Browser ──► page guard (convenience only) ──► login token ──► database access rules (Row Level Security)
        ──► function checks (role, status rules) ──► field limits in the database
```

| Layer | Protects against |
|-------|------------------|
| Access rules on every table | Anyone reading or changing data they should not |
| Totals and fees calculated in the database | Fake prices or fees |
| Role check inside admin functions | Chef or anonymous users doing admin actions |
| Customer name, phone, and address visible to admin only | Leaking customer details. The kitchen sees only the first name |
| Tracking needs the unguessable link, or receipt number plus phone | Strangers looking up orders |
| Spam field, input limits, order limit per phone | Fake or repeated online orders |
| Public forms can only add *pending* or *unapproved* entries | Self-approved reviews or bookings |
| User text shown as plain text, never as code | Script injection |
| Only the public key in the code, never the master key | A leaked master key |
| Image uploads: images only, 2 MB, admin only | Bad files |

### 6.8 Business Rules

1. Prices, tax, delivery fees, and totals always come from the database.
2. A receipt number is created when the order is placed.
3. Payment is cash only (at the table, at pickup, or on delivery), recorded by the admin.
4. Revenue counts only paid, non-cancelled orders, by payment date.
5. Cancelled orders cannot be paid.
6. Customers cannot edit or cancel an order after placing it. Only the admin cancels.
7. Delivery is done by an outside agency. The admin updates the delivery status.
8. Reviews show only after admin approval.
9. Reservations are confirmed by phone.
10. Limits: quantity 1–20 per line, up to 30 lines per order, note up to 200 characters.

### 6.9 Design System

| Element | Choice |
|---------|--------|
| **Mood** | French, white, minimalist, cozy |
| **Colours** | Warm white or cream, soft beige, one muted accent (sage or dusty gold), charcoal text |
| **Fonts** | Elegant serif for headings (Cormorant Garamond), clean sans for body (Jost) |
| **Details** | Thin lines, soft shadows, rounded cards, subtle grain, French headings (*Notre Histoire, Carte, Galerie, Réservation*) |
| **Motion** | Scroll reveals, smooth scrolling, hero intro, hover lift and tilt, cart slide-in, animated checkmark, page fade |
| **3D** | Hero object, 3D dish viewer, tilt cards, CSS card flips |

| Page | Effects allowed |
|------|-----------------|
| Customer website | All |
| Order and tracking pages | Light animations only, no 3D |
| Kitchen and admin | Minimal: speed and clarity first |

**Performance rules:** lazy-load 3D, keep models under 2 MB, show a static image fallback, respect reduced motion, test on a mid-range phone.

### 6.10 Deployment Flow

```
Developer branch ──► GitHub pull request ──► Vercel preview link ──► Member-5 tests
      ──► merge to dev ──► test ──► merge to main ──► Vercel production

Supabase: a dev project for testing, a production project for real data
```

Print the QR codes only after the final website address is decided. A changed address breaks every printed QR code.

---

## 7. Project Structure

```
khabar-golpo/
├── index.html                  # Customer website
├── order.html                  # Dine-in order page (QR)
├── order-online.html           # Pickup / delivery order page
├── track.html                  # Order tracking
├── kitchen.html                # Kitchen panel
├── admin/
│   ├── login.html
│   ├── dashboard.html
│   ├── orders.html
│   ├── receipt.html            # Receipt and combined bill
│   ├── delivery-slip.html      # Slip for the delivery agency
│   ├── menu.html
│   ├── tables.html             # Tables and QR codes
│   ├── reservations.html
│   ├── feedback.html
│   ├── gallery.html
│   ├── reports.html
│   └── settings.html
├── css/                        # base, animations, and one file per panel
├── js/
│   ├── config.js               # Supabase address and public key, site address, mock mode switch
│   ├── supabaseClient.js
│   ├── api/                    # API layer: one file per area
│   ├── mock/                   # Fake data for early frontend work
│   ├── pages/                  # One script per page
│   └── utils/                  # QR, receipt printing, formatting, page guards
├── supabase/                   # SQL files: tables, functions, access rules, sample data
├── assets/                     # Images, fonts, icons
├── vercel.json
└── README.md
```

---

## 8. Default Settings and Assumptions

These are the current defaults and can be changed by the team.

| Topic | Default |
|-------|---------|
| Online orders and the kitchen | Pickup and delivery orders reach the kitchen immediately |
| Delivery fee | One flat amount, set in Settings |
| Payment | Cash only |
| Fake order protection | Spam field, input limits, and a limit on orders per phone number |
| Customer data | Name, phone, and address kept with the order and visible to the admin only |
| Receipts | Created automatically and printed from the browser |
| Revenue periods | Calendar week (Monday to Sunday), month, and year, in the restaurant's time zone |
| Accounts | One admin and one chef, created manually. There is no sign-up page |
