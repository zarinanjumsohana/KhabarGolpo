
import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

const apiPath = "/rest/v1/rpc"

const mockGetActiveOrders = () => Promise.resolve({
  data: [{
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
  }, {
    id: "order-2",
    receipt_number: "KG-1043",
    order_type: "pickup",
    table_number: null,
    first_name: "Sara",
    pickup_time: "19:30",
    status: "ready",
    items: [{ name: "Pizza", qty: 1 }],
    note: "",
    created_at: new Date(Date.now() - 300000).toISOString(),
    wait_minutes: 2
  }],
  error: null
})

const mockSubscribeOrders = (onEvent) => {
  onEvent(mockGetActiveOrders().data)
  return () => {}
}

const mockUpdateStatus = (orderId, to) => {
  const validTransitions = {
    new: ["preparing"],
    preparing: ["ready", "preparing"],
    ready: ["preparing"]
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
  return Promise.resolve({
    data: { id: orderId, status: to },
    error: null
  })
}

const mockSetAvailability = (itemId, isAvailable) => Promise.resolve({
  data: { id: itemId, is_available: isAvailable },
  error: null
})

export async function getActiveOrders() {
  return mockGetActiveOrders()
}

export async function subscribeOrders(onEvent) {
  return mockSubscribeOrders(onEvent)
}

export async function updateStatus(orderId, to) {
  return mockUpdateStatus(orderId, to)
}

export async function setAvailability(itemId, isAvailable) {
  return mockSetAvailability(itemId, isAvailable)
}