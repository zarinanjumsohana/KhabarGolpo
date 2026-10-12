// Khabar Golpo — Admin Orders API layer
// Admin panel functions for order management
// Auto-switches based on MOCK_MODE in config.js (same pattern as js/api/kitchen.js)

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match js/mock/api.js mockAdminOrders shapes) ----

const mockListOrders = (filters = {}) => Promise.resolve({
  data: [{
    id: "order-1",
    receipt_number: "KG-1042",
    order_type: "dine-in",
    table_number: 5,
    customer_name: "Ali Ahmed",
    customer_phone: "01712345678",
    total: 545.00,
    status: "preparing",
    payment_status: "unpaid",
    created_at: new Date().toISOString()
  }, {
    id: "order-2",
    receipt_number: "KG-1043",
    order_type: "pickup",
    table_number: null,
    customer_name: "Sara Begum",
    customer_phone: "01798765432",
    total: 890.00,
    status: "ready",
    payment_status: "unpaid",
    created_at: new Date(Date.now() - 120000).toISOString()
  }],
  total_count: 2,
  error: null
})

const mockGetOrder = (id) => Promise.resolve({
  data: {
    id: id,
    receipt_number: "KG-1042",
    order_type: "dine-in",
    table_number: 5,
    customer_name: "Ali Ahmed",
    customer_phone: "01712345678",
    delivery_address: null,
    customer_note: "well done",
    status: "preparing",
    payment_status: "unpaid",
    subtotal: 450.00,
    tax_amount: 45.00,
    delivery_fee: 0,
    total: 495.00,
    items: [
      { item_id: "item-1", item_name: "Burger", unit_price: 225.00, quantity: 2, line_total: 450.00 },
      { item_id: "item-2", item_name: "Fries", unit_price: 45.00, quantity: 1, line_total: 45.00 }
    ],
    delivery_note: null,
    created_at: new Date().toISOString(),
    paid_at: null
  },
  error: null
})

const mockCancelOrder = (id) => Promise.resolve({
  data: { id, status: "cancelled" },
  error: null
})

const mockMarkOutForDelivery = (id, { delivery_note } = {}) => Promise.resolve({
  data: { id, status: "out_for_delivery", delivery_note },
  error: null
})

const mockMarkDelivered = (id) => Promise.resolve({
  data: { id, status: "delivered" },
  error: null
})

const mockMarkPickedUp = (id) => Promise.resolve({
  data: { id, status: "picked_up" },
  error: null
})

const mockMarkPaid = (id) => Promise.resolve({
  data: { id, payment_status: "paid", paid_at: new Date().toISOString() },
  error: null
})

const mockTableBill = (tableNumber) => Promise.resolve({
  data: {
    orders: [{
      receipt_number: "KG-1042",
      total: 545.00
    }],
    combined_total: 545.00
  },
  error: null
})

const mockMarkTablePaid = (tableNumber) => Promise.resolve({
  data: { paid_count: 1, combined_total: 545.00 },
  error: null
})

// ---- Real Supabase RPC calls (uncomment when ready) ----
// const supabase = window.supabase || createClient(SUPABASE_URL, ANON_KEY)

// // export async function listOrders(filters = {}) {
// //   if (MOCK_MODE) return mockListOrders(filters)
// //   // const { data, error } = await supabase.rpc('list_orders', { p_filters: filters })
// //   // return { data, error }
// // }

// // export async function getOrder(id) {
// //   if (MOCK_MODE) return mockGetOrder(id)
// //   // const { data, error } = await supabase.rpc('get_order_by_id', { p_id: id })
// //   // return { data, error }
// // }

// // export async function cancelOrder(id) {
// //   if (MOCK_MODE) return mockCancelOrder(id)
// //   // const { data, error } = await supabase.rpc('cancel_order', { p_order: id })
// //   // return { data, error }
// //}

// // export async function markOutForDelivery(id, { delivery_note } = {}) {
// //   if (MOCK_MODE) return mockMarkOutForDelivery(id, { delivery_note })
// //   // const { data, error } = await supabase.rpc('mark_out_for_delivery', { p_order: id, p_delivery_note: delivery_note })
// //   // return { data, error }
// // }

// // export async function markDelivered(id) {
// //   if (MOCK_MODE) return mockMarkDelivered(id)
// //   // const { data, error } = await supabase.rpc('mark_delivered', { p_order: id })
// //   // return { data, error }
// //}

// // export async function markPickedUp(id) {
// //   if (MOCK_MODE) return mockMarkPickedUp(id)
// //   // const { data, error } = await supabase.rpc('mark_picked_up', { p_order: id })
// //   // return { data, error }
// //}

// // export async function markPaid(id) {
// //   if (MOCK_MODE) return mockMarkPaid(id)
// //   // const { data, error } = await supabase.rpc('mark_paid', { p_order: id })
// //   // return { data, error }
// //}

// // export async function tableBill(tableNumber) {
// //   if (MOCK_MODE) return mockTableBill(tableNumber)
// //   // const { data, error } = await supabase.rpc('table_bill', { p_table: tableNumber })
// //   // return { data, error }
// //}

// // export async function markTablePaid(tableNumber) {
// //   if (MOCK_MODE) return mockMarkTablePaid(tableNumber)
// //   // const { data, error } = await supabase.rpc('mark_table_paid', { p_table: tableNumber })
// //   // return { data, error }
// //}

// Mock-first: use mock implementations for immediate functionality
export async function listOrders(filters = {}) {
  return mockListOrders(filters)
}

export async function getOrder(id) {
  return mockGetOrder(id)
}

export async function cancelOrder(id) {
  return mockCancelOrder(id)
}

export async function markOutForDelivery(id, { delivery_note } = {}) {
  return mockMarkOutForDelivery(id, { delivery_note })
}

export async function markDelivered(id) {
  return mockMarkDelivered(id)
}

export async function markPickedUp(id) {
  return mockMarkPickedUp(id)
}

export async function markPaid(id) {
  return mockMarkPaid(id)
}

export async function tableBill(tableNumber) {
  return mockTableBill(tableNumber)
}

export async function markTablePaid(tableNumber) {
  return mockMarkTablePaid(tableNumber)
}