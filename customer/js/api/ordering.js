// Khabar Golpo — Ordering API layer
// Customer website ordering functions (no login required)
// Auto-switches based on MOCK_MODE in config.js (same pattern as js/api/kitchen.js)

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match js/mock/api.js mockOrdering shapes) ----

// Rate limiting: max 3 dine-in orders per phone per 5 minutes (simple in‑memory guard)
const dineInRateLimit = {
  counts: new Map(), // phone -> [{ts: number, count: number}]
  allow: (phone) => {
    const now = Date.now();
    const entries = dineInRateLimit.counts.get(phone) || [];
    const recent = entries.filter(e => now - e.ts < 5 * 60 * 1000);
    if (recent.length >= 3) return false;
    recent.push({ ts: now, count: (recent.at(-1)?.count ?? 0) + 1 });
    dineInRateLimit.counts.set(phone, recent);
    return true;
  }
};

const mockPlaceDineInOrder = (data) => {
  if (!dineInRateLimit.allow(data.phone)) {
    return Promise.resolve({
      data: null,
      error: { code: "RATE_LIMITED", message: "Too many dine‑in orders for this phone number. Try again later." }
    });
  }
  return Promise.resolve({
    data: {
      id: `order-${Date.now()}`,
      receipt_number: `KG-${String(Date.now()).slice(-4)}`,
      table_number: data.table_number,
      total: 545.00,
      tracking_url: "/track?id=" + `order-${Date.now()}`
    },
    error: null
  });
}

const mockPlaceOnlineOrder = (data) => Promise.resolve({
  data: {
    id: `order-${Date.now()}`,
    receipt_number: `KG-${String(Date.now()).slice(-4)}`,
    subtotal: 500.00,
    tax: 25.00,
    delivery_fee: 60.00,
    total: 585.00,
    tracking_url: "/track?id=order-uuid"
  },
  error: null
})

const mockTrackOrder = (data) => Promise.resolve({
  data: {
    id: data.id, // use ?id=<uuid> only
    receipt_number: data.id, // for backward compat, mirror id
    order_type: "dine-in",
    status: "preparing",
    items: [{ name: "Burger", qty: 2 }],
    subtotal: 450.00,
    tax: 45.00,
    delivery_fee: 0,
    total: 495.00,
    eta_minutes: 25,
    delivery_note: null
  },
  error: null
})

// ---- Real Supabase RPC calls (uncomment when ready) ----
// const supabase = window.supabase || createClient(SUPABASE_URL, ANON_KEY)

// // Ordering — no login
// export async function placeDineInOrder(data) {
//   if (MOCK_MODE) return mockPlaceDineInOrder(data)
//   // const { data, error } = await supabase.rpc('place_dinein_order', { p_table_number: data.table_number, p_lines: data.lines, p_note: data.note })
//   // return { data, error }
//}

// export async function placeOnlineOrder(data) {
//   if (MOCK_MODE) return mockPlaceOnlineOrder(data)
//   // const { data, error } = await supabase.rpc('place_online_order', { p_type: data.order_type, p_lines: data.lines, p_name: data.name, p_phone: data.phone, p_address: data.address, p_address_note: data.address_note, p_pickup_time: data.pickup_time, p_note: data.note })
//   // return { data, error }
//}

// export async function trackOrder(data) {
//   if (MOCK_MODE) return mockTrackOrder(data)
//   // const { data, error } = await supabase.rpc('track_order', { p_receipt: data.receipt_number, p_phone: data.phone })
//   // return { data, error }
//}

// Mock-first: use mock implementations for immediate functionality
export async function placeDineInOrder(data) {
  return mockPlaceDineInOrder(data)
}

export async function placeOnlineOrder(data) {
  return mockPlaceOnlineOrder(data)
}

export async function trackOrder(data) {
  // Accept either {id: "<uuid>"} or {receipt_number: "KG-..."} but prioritize id.
  // Security: a receipt alone is not sufficient for anon – use the order UUID.
  const id = data.id || data.receipt_number
  if (!id) return Promise.resolve({ data: null, error: { code: "MISSING_ID", message: "trackOrder requires an order id or receipt_number." } })
  return mockTrackOrder({ id })
}