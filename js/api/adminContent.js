// Khabar Golpo — Admin Content API layer
// Admin panel CRUD: settings, categories, items, tables, reservations, feedback, gallery
// Auto-switches based on MOCK_MODE in config.js (same pattern as js/api/kitchen.js)

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

// ---- Mock implementations (match js/mock/api.js mockAdminContent shapes) ----

const mockGetSettingsFull = () => Promise.resolve({
  data: {
    id: 1,
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

const mockUpdateSettings = (settings) => Promise.resolve({
  data: { id: 1, ...settings },
  error: null
})

const mockListCategories = () => Promise.resolve({
  data: [
    { id: "cat-1", name: "Starters", sort_order: 0 },
    { id: "cat-2", name: "Main Course", sort_order: 1 },
    { id: "cat-3", name: "Desserts", sort_order: 2 }
  ],
  error: null
})

const mockCreateCategory = (name) => Promise.resolve({
  data: { id: `cat-${Date.now()}`, name, sort_order: 0 },
  error: null
})

const mockUpdateCategory = (id, { name, sort_order }) => Promise.resolve({
  data: { id, name, sort_order },
  error: null
})

const mockDeleteCategory = (id) => Promise.resolve({
  data: { id, deleted: true },
  error: null
})

const mockListItems = (categoryId = null) => Promise.resolve({
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

const mockCreateItem = (item) => Promise.resolve({
  data: { id: `item-${Date.now()}`, ...item },
  error: null
})

const mockUpdateItem = (id, item) => Promise.resolve({
  data: { id, ...item },
  error: null
})

const mockDeleteItem = (id) => Promise.resolve({
  data: { id, deleted: true },
  error: null
})

const mockListTables = () => Promise.resolve({
  data: [
    { table_number: 1, is_active: true, qr_url: "/order?table=1" },
    { table_number: 2, is_active: true, qr_url: "/order?table=2" },
    { table_number: 5, is_active: true, qr_url: "/order?table=5" }
  ],
  error: null
})

const mockCreateTable = (table_number) => Promise.resolve({
  data: { table_number, is_active: true, qr_url: `/order?table=${table_number}` },
  error: null
})

const mockSetTableActive = (tableNumber, active) => Promise.resolve({
  data: { table_number: tableNumber, is_active: active },
  error: null
})

const mockListReservations = (filters = {}) => Promise.resolve({
  data: [
    { id: "res-1", name: "Rahim Uddin", phone: "01712345678", date: "2026-10-15", time: "19:00", guests: 4, status: "pending" }
  ],
  error: null
})

const mockSetReservationStatus = (id, status) => Promise.resolve({
  data: { id, status },
  error: null
})

const mockListFeedback = (unreadOnly = false) => Promise.resolve({
  data: [
    { id: "fb-1", type: "review", name: "Ali", phone: "01712345678", rating: 5, message: "Great food!", is_approved: false, is_read: false }
  ],
  error: null
})

const mockSetFeedbackRead = (id) => Promise.resolve({
  data: { id, is_read: true },
  error: null
})

const mockApproveReview = (id, approved) => Promise.resolve({
  data: { id, is_approved: approved },
  error: null
})

const mockDeleteFeedback = (id) => Promise.resolve({
  data: { id, deleted: true },
  error: null
})

const mockListGallery = () => Promise.resolve({
  data: [
    { id: "gal-1", image_url: "https://example.com/image1.jpg", caption: "Plate presentation", sort_order: 0 }
  ],
  error: null
})

const mockAddGalleryImage = (file, caption) => Promise.resolve({
  data: { id: `gal-${Date.now()}`, image_url: `https://storage.example.com/${Date.now()}.jpg`, caption },
  error: null
})

const mockDeleteGalleryImage = (id) => Promise.resolve({
  data: { id, deleted: true },
  error: null
})

// ---- Real Supabase RPC calls (uncomment when ready) ----
// const supabase = window.supabase || createClient(SUPABASE_URL, ANON_KEY)

// export async function getSettingsFull() {
//   if (MOCK_MODE) return mockGetSettingsFull()
//   // const { data, error } = await supabase.rpc('get_settings_full')
//   // return { data, error }
// }

// export async function updateSettings(settings) {
//   if (MOCK_MODE) return mockUpdateSettings(settings)
//   // const { data, error } = await supabase.rpc('update_settings', { p_settings: settings })
//   // return { data, error }
// }

// export async function listCategories() {
//   if (MOCK_MODE) return mockListCategories()
//   // const { data, error } = await supabase.rpc('list_categories')
//   // return { data, error }
// }

// export async function createCategory(name) {
//   if (MOCK_MODE) return mockCreateCategory(name)
//   // const { data, error } = await supabase.rpc('create_category', { p_name: name })
//   // return { data, error }
// }

// export async function updateCategory(id, { name, sort_order }) {
//   if (MOCK_MODE) return mockUpdateCategory(id, { name, sort_order })
//   // const { data, error } = await supabase.rpc('update_category', { p_id: id, p_name: name, p_sort_order: sort_order })
//   // return { data, error }
// }

// export async function deleteCategory(id) {
//   if (MOCK_MODE) return mockDeleteCategory(id)
//   // const { data, error } = await supabase.rpc('delete_category', { p_id: id })
//   // return { data, error }
// }

// export async function listItems(categoryId = null) {
//   if (MOCK_MODE) return mockListItems(categoryId)
//   // const { data, error } = await supabase.rpc('list_items', { p_category_id: categoryId })
//   // return { data, error }
// }

// export async function createItem(item) {
//   if (MOCK_MODE) return mockCreateItem(item)
//   // const { data, error } = await supabase.rpc('create_item', { p_item_json: JSON.stringify(item) })
//   // return { data, error }
// }

// export async function updateItem(id, item) {
//   if (MOCK_MODE) return mockUpdateItem(id, item)
//   // const { data, error } = await supabase.rpc('update_item', { p_id: id, p_item_json: JSON.stringify(item) })
//   // return { data, error }
// }

// export async function deleteItem(id) {
//   if (MOCK_MODE) return mockDeleteItem(id)
//   // const { data, error } = await supabase.rpc('delete_item', { p_id: id })
//   // return { data, error }
// }

// export async function listTables() {
//   if (MOCK_MODE) return mockListTables()
//   // const { data, error } = await supabase.rpc('list_tables')
//   // return { data, error }
// }

// export async function createTable(table_number) {
//   if (MOCK_MODE) return mockCreateTable(table_number)
//   // const { data, error } = await supabase.rpc('create_table', { p_table_number: table_number })
//   // return { data, error }
// }

// export async function setTableActive(tableNumber, active) {
//   if (MOCK_MODE) return mockSetTableActive(tableNumber, active)
//   // const { data, error } = await supabase.rpc('set_table_active', { p_table_number: tableNumber, p_is_active: active })
//   // return { data, error }
// }

// export async function listReservations(filters = {}) {
//   if (MOCK_MODE) return mockListReservations(filters)
//   // const { data, error } = await supabase.rpc('list_reservations', { p_filters: filters })
//   // return { data, error }
// }

// export async function setReservationStatus(id, status) {
//   if (MOCK_MODE) return mockSetReservationStatus(id, status)
//   // const { data, error } = await supabase.rpc('set_reservation_status', { p_id: id, p_status: status })
//   // return { data, error }
// }

// export async function listFeedback(unreadOnly = false) {
//   if (MOCK_MODE) return mockListFeedback(unreadOnly)
//   // const { data, error } = await supabase.rpc('list_feedback', { p_unread_only: unreadOnly })
//   // return { data, error }
// }

// export async function setFeedbackRead(id) {
//   if (MOCK_MODE) return mockSetFeedbackRead(id)
//   // const { data, error } = await supabase.rpc('set_feedback_read', { p_id: id })
//   // return { data, error }
// }

// export async function approveReview(id, approved) {
//   if (MOCK_MODE) return mockApproveReview(id, approved)
//   // const { data, error } = await supabase.rpc('approve_review', { p_id: id, p_approved: approved })
//   // return { data, error }
// }

// export async function deleteFeedback(id) {
//   if (MOCK_MODE) return mockDeleteFeedback(id)
//   // const { data, error } = await supabase.rpc('delete_feedback', { p_id: id })
//   // return { data, error }
// }

// export async function listGallery() {
//   if (MOCK_MODE) return mockListGallery()
//   // const { data, error } = await supabase.rpc('list_gallery')
//   // return { data, error }
// }

// export async function addGalleryImage(file, caption) {
//   if (MOCK_MODE) return mockAddGalleryImage(file, caption)
//   // const { data, error } = await supabase.rpc('add_gallery_image', { p_file: p_file, p_caption: p_caption })
//   // return { data, error }
// }

// export async function deleteGalleryImage(id) {
//   if (MOCK_MODE) return mockDeleteGalleryImage(id)
//   // const { data, error } = await supabase.rpc('delete_gallery_image', { p_id: id })
//   // return { data, error }
// }

// Mock-first: use mock implementations for immediate functionality
export async function getSettingsFull() {
  return mockGetSettingsFull()
}

export async function updateSettings(settings) {
  return mockUpdateSettings(settings)
}

export async function listCategories() {
  return mockListCategories()
}

export async function createCategory(name) {
  return mockCreateCategory(name)
}

export async function updateCategory(id, { name, sort_order }) {
  return mockUpdateCategory(id, { name, sort_order })
}

export async function deleteCategory(id) {
  return mockDeleteCategory(id)
}

export async function listItems(categoryId = null) {
  return mockListItems(categoryId)
}

export async function createItem(item) {
  return mockCreateItem(item)
}

export async function updateItem(id, item) {
  return mockUpdateItem(id, item)
}

export async function deleteItem(id) {
  return mockDeleteItem(id)
}

export async function listTables() {
  return mockListTables()
}

export async function createTable(table_number) {
  return mockCreateTable(table_number)
}

export async function setTableActive(tableNumber, active) {
  return mockSetTableActive(tableNumber, active)
}

export async function listReservations(filters = {}) {
  return mockListReservations(filters)
}

export async function setReservationStatus(id, status) {
  return mockSetReservationStatus(id, status)
}

export async function listFeedback(unreadOnly = false) {
  return mockListFeedback(unreadOnly)
}

export async function setFeedbackRead(id) {
  return mockSetFeedbackRead(id)
}

export async function approveReview(id, approved) {
  return mockApproveReview(id, approved)
}

export async function deleteFeedback(id) {
  return mockDeleteFeedback(id)
}

export async function listGallery() {
  return mockListGallery()
}

export async function addGalleryImage(file, caption) {
  return mockAddGalleryImage(file, caption)
}

export async function deleteGalleryImage(id) {
  return mockDeleteGalleryImage(id)
}