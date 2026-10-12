// Khabar Golpo — Ordering API layer
// Customer website ordering functions (no login required)
// Auto-switches based on MOCK_MODE in config.js (same pattern as js/api/kitchen.js)

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match js/mock/api.js mockOrdering shapes) ----

const mockPlaceDineInOrder = (data) => Promise.resolve({
  data: {
    id: `order-${Date.now()}`,
    receipt_number: `KG-${String(Date.now()).slice(-4)}`,
    total: 545.00,
    tracking_url: "/track?id=order-uuid"
  },
  error: null
})

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
    id: `order-uuid`,
    receipt_number: "KG-1042",
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
  return mockTrackOrder(data)
}