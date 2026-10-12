
import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

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