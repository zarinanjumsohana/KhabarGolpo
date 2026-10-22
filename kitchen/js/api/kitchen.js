// Khabar Golpo — Kitchen API layer
// Chef (or admin) functions for order status, live orders, availability
// Auto-switches based on MOCK_MODE in config.js

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match js/mock/api.js shapes) ----

const mockGetActiveOrders = () => Promise.resolve({
  data: [
    {
      id: "order-1",
      receipt_number: "KG-1042",
      order_type: "dine-in",
      table_number: 5,
      first_name: "Ali",
      pickup_time: null,
      status: "preparing",
      items: [{ name: "Burger", qty: 2 }, { name: "Fries", qty: 1 }],
      note: "well done",
      created_at: new Date().toISOString(),
      wait_minutes: 8
    },
    {
      id: "order-2",
      receipt_number: "KG-1043",
      order_type: "dine-in",
      table_number: 3,
      first_name: "Sara",
      pickup_time: "19:30",
      status: "ready",
      items: [{ name: "Pizza", qty: 1 }],
      note: "",
      created_at: new Date(Date.now() - 300000).toISOString(),
      wait_minutes: 2
    },
    {
      id: "order-3",
      receipt_number: "KG-1044",
      order_type: "dine-in",
      table_number: 2,
      first_name: "Rahim",
      pickup_time: null,
      status: "completed",
      items: [{ name: "Biryani", qty: 2 }],
      note: "",
      created_at: new Date(Date.now() - 600000).toISOString(),
      wait_minutes: 0
    }
  ],
  error: null
})

const mockSubscribeOrders = (onEvent) => {
  // Immediately push initial data, then fall back to polling sim
  onEvent(mockGetActiveOrders().data)
  // Return mock unsubscribe
  return () => {}
}

const mockUpdateStatus = (orderId, to) => {
  const validTransitions = {
    new: ["preparing"],
    preparing: ["ready", "preparing"],
    ready: ["preparing", "completed"],
    completed: [] // terminal state
  }
  const current = mockGetActiveOrders().data.find(o => o.id === orderId)
  if (!current) {
    return Promise.resolve({ data: null, error: { code: "NOT_FOUND", message: "Order not found" } })
  }
  const allowed = validTransitions[current.status] && validTransitions[current.status].includes(to)
  if (!allowed) {
    return Promise.resolve({
      data: null,
      error: { code: "BAD_TRANSITION", message: `Cannot move from ${current.status} to ${to}.` }
    })
  }
  // Update the in‑memory order status
  const orders = mockGetActiveOrders().data.map(o =>
    o.id === orderId ? { ...o, status: to } : o
  )
  // Re‑create the resolved object with the updated data array
  return Promise.resolve({
    data: orders,
    error: null
  })
}

const mockSetAvailability = (itemId, isAvailable) => Promise.resolve({
  data: { id: itemId, is_available: isAvailable },
  error: null
})

// ---- Real Supabase RPC calls (uncomment when ready) ----
// const supabase = window.supabase || createClient(SUPABASE_URL, ANON_KEY)

// export async function getActiveOrders() {
//   if (MOCK_MODE) return mockGetActiveOrders()
//   // const { data, error } = await supabase.rpc('get_active_orders')
//   // return { data, error }
//}

// export async function subscribeOrders(onEvent) {
//   if (MOCK_MODE) return mockSubscribeOrders(onEvent)
//   // const channel = supabase.channel('orders')
//   //   .on('INSERT', { event: '* ' }, (payload) => onEvent(payload.new))
//   //   .on('UPDATE', (payload) => onEvent(payload.new)
//   //   .subscribe()
//   // return { unsubscribe: () => supabase.remove(channel) }
//}

// export async function updateStatus(orderId, to) {
//   if (MOCK_MODE) return mockUpdateStatus(orderId, to)
//   // const { data, error } = await supabase.rpc('update_order_status', { p_order: orderId, p_to: to })
//   // return { data, error }
//}

// export async function setAvailability(itemId, isAvailable) {
//   if (MOCK_MODE) return mockSetAvailability(itemId, isAvailable)
//   // const { data, error } = await supabase.rpc('set_availability', { p_item: itemId, p_avail: isAvailable })
//   // return { data, error }
//}

// Mock-first: use mock implementations for immediate functionality
export async function getActiveOrders() {
  return mockGetActiveOrders()
}

export async function subscribeOrders(onEvent) {
  return mockSubscribeOrders(onEvent)
}

export async function updateStatus(orderId, to) {
  return mockUpdateStatus(orderId, to)
}

export async function setOrderCompleted(orderId) {
  // Mark a dine‑in order as completed (terminal state). This also removes it from the “active” feed.
  return mockUpdateStatus(orderId, "completed")
}

export async function setAvailability(itemId, isAvailable) {
  return mockSetAvailability(itemId, isAvailable)
}