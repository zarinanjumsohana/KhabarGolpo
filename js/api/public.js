// Khabar Golpo — Public API layer
// Customer website functions (no login required)
// Auto-switches based on MOCK_MODE in config.js (same pattern as js/api/kitchen.js)

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match expected API shapes) ----

const mockGetSettings = () => Promise.resolve({
  data: {
    restaurant_name: "Khabar Golpo",
    tagline: "Authentic Bengali Flavors",
    address: "Dhaka, Bangladesh",
    phone: "01712345678",
    email: "info@khabargolpo.test",
    hours: "12:00 PM - 11:00 PM",
    tax_percent: 5.00,
    timezone: "Asia/Dhaka",
    pickup_enabled: true,
    delivery_enabled: true,
    delivery_fee: 50.00,
    min_delivery_amount: 300.00,
    delivery_area_note: "Within 5km radius",
    prep_time_minutes: 25,
    pickup_hours: "12:00 PM - 10:00 PM",
    logo_url: null
  },
  error: null
})

const mockGetCategories = () => Promise.resolve({
  data: [
    { id: "cat-1", name: "Starters", sort_order: 0 },
    { id: "cat-2", name: "Main Course", sort_order: 1 },
    { id: "cat-3", name: "Desserts", sort_order: 2 }
  ],
  error: null
})

const mockGetMenu = () => Promise.resolve({
  data: [
    {
      id: "item-1",
      category_id: "cat-1",
      name: "Shutki Bhorta",
      description: "Traditional dried fish mash",
      price: 180.00,
      image_url: null,
      is_veg: false,
      is_available: true,
      is_featured: false,
      sort_order: 0
    },
    {
      id: "item-2",
      category_id: "cat-2",
      name: "Chicken Bhuna",
      description: "Spiced chicken curry",
      price: 320.00,
      image_url: null,
      is_veg: false,
      is_available: true,
      is_featured: true,
      sort_order: 0
    }
  ],
  error: null
})

const mockGetGallery = () => Promise.resolve({
  data: [
    { id: "gal-1", image_url: "https://example.com/image1.jpg", caption: "Plate presentation", sort_order: 0 }
  ],
  error: null
})

const mockGetApprovedReviews = () => Promise.resolve({
  data: [
    { name: "Ali", rating: 5, message: "Great food!" }
  ],
  error: null
})

const mockCheckTable = (n) => Promise.resolve({
  data: { exists: true, is_active: true },
  error: null
})

const mockCreateReservation = (data) => Promise.resolve({
  data: { id: `res-${Date.now()}`, status: "pending" },
  error: null
})

const mockSubmitFeedback = (data) => Promise.resolve({
  data: { id: `fb-${Date.now()}` },
  error: null
})

// Ordering mocks
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

// // Public — no login
// export async function getSettings() {
//   if (MOCK_MODE) return mockGetSettings()
//   // const { data, error } = await supabase.rpc('get_settings')
//   // return { data, error }
// }

// export async function getCategories() {
//   if (MOCK_MODE) return mockGetCategories()
//   // const { data, error } = await supabase.rpc('get_categories')
//   // return { data, error }
// }

// export async function getMenu() {
//   if (MOCK_MODE) return mockGetMenu()
//   // const { data, error } = await supabase.rpc('get_menu')
//   // return { data, error }
// }

// export async function getGallery() {
//   if (MOCK_MODE) return mockGetGallery()
//   // const { data, error } = await supabase.rpc('get_gallery')
//   // return { data, error }
// }

// export async function getApprovedReviews() {
//   if (MOCK_MODE) return mockGetApprovedReviews()
//   // const { data, error } = await supabase.rpc('get_approved_reviews')
//   // return { data, error }
// }

// export async function checkTable(n) {
//   if (MOCK_MODE) return mockCheckTable(n)
//   // const { data, error } = await supabase.rpc('check_table', { p_table: n })
//   // return { data, error }
// }

// export async function createReservation(data) {
//   if (MOCK_MODE) return mockCreateReservation(data)
//   // const { data, error } = await supabase.rpc('create_reservation', { p_name: data.name, p_phone: data.phone, p_date: data.date, p_time: data.time, p_guests: data.guests, p_note: data.note })
//   // return { data, error }
// }

// export async function submitFeedback(data) {
//   if (MOCK_MODE) return mockSubmitFeedback(data)
//   // const { data, error } = await supabase.rpc('submit_feedback', { p_type: data.type, p_name: data.name, p_phone: data.phone, p_rating: data.rating, p_message: data.message })
//   // return { data, error }
// }

// // Ordering — no login
// export async function placeDineInOrder(data) {
//   if (MOCK_MODE) return mockPlaceDineInOrder(data)
//   // const { data, error } = await supabase.rpc('place_dinein_order', { p_table_number: data.table_number, p_lines: data.lines, p_note: data.note })
//   // return { data, error }
// }

// export async function placeOnlineOrder(data) {
//   if (MOCK_MODE) return mockPlaceOnlineOrder(data)
//   // const { data, error } = await supabase.rpc('place_online_order', { p_type: data.order_type, p_lines: data.lines, p_name: data.name, p_phone: data.phone, p_address: data.address, p_address_note: data.address_note, p_pickup_time: data.pickup_time, p_note: data.note })
//   // return { data, error }
// }

// export async function trackOrder(data) {
//   if (MOCK_MODE) return mockTrackOrder(data)
//   // const { data, error } = await supabase.rpc('track_order', { p_receipt: data.receipt_number, p_phone: data.phone })
//   // return { data, error }
// }

// Mock-first: use mock implementations for immediate functionality
export async function getSettings() {
  return mockGetSettings()
}

export async function getCategories() {
  return mockGetCategories()
}

export async function getMenu() {
  return mockGetMenu()
}

export async function getGallery() {
  return mockGetGallery()
}

export async function getApprovedReviews() {
  return mockGetApprovedReviews()
}

export async function checkTable(n) {
  return mockCheckTable(n)
}

export async function createReservation(data) {
  return mockCreateReservation(data)
}

export async function submitFeedback(data) {
  return mockSubmitFeedback(data)
}

// Ordering — no login
export async function placeDineInOrder(data) {
  return mockPlaceDineInOrder(data)
}

export async function placeOnlineOrder(data) {
  return mockPlaceOnlineOrder(data)
}

export async function trackOrder(data) {
  return mockTrackOrder(data)
}