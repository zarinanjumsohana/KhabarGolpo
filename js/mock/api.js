
export const mockAuth = {
  // Login with hardcoded dev accounts (per Testing.md:17)
  login: (email, password) => {
    // Dev accounts: admin@khabargolpo.test / chef@khabargolpo.test
    if (email === "admin@khabargolpo.test" && password === "password") {
      return Promise.resolve({
        data: { user: { id: "admin-uuid", email: "admin@khabargolpo.test" }, role: "admin" },
        error: null
      })
    }
    if (email === "chef@khabargolpo.test" && password === "password") {
      return Promise.resolve({
        data: { user: { id: "chef-uuid", email: "chef@khabargolpo.test" }, role: "chef" },
        error: null
      })
    }
    return Promise.resolve({
      data: null,
      error: { code: "UNAUTHENTICATED", message: "Wrong email or password." }
    })
  },
  logout: () => Promise.resolve({ data: true, error: null }),
  getSession: () => Promise.resolve({
    data: { user: null, role: null },
    error: null
  })
}


export const mockKitchen = {
  
  getActiveOrders: () => Promise.resolve({
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
      created_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      wait_minutes: 2
    }],
    error: null
  }),

  
  subscribeOrders: (onEvent) => {
    onEvent(mockKitchen.getActiveOrders().data)
    return () => {} // mock unsubscribe
  },

  updateStatus: (orderId, to) => {
    
    const validTransitions = {
      new: ["preparing"],
      preparing: ["ready", "preparing"], // correction allowed
      ready: ["preparing"] // correction
    }
    const current = mockKitchen.getActiveOrders().data.find(o => o.id === orderId)
    if (!current) return Promise.resolve({ data: null, error: { code: "NOT_FOUND", message: "Order not found" } })

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
  },

  setAvailability: (itemId, isAvailable) => {
    return Promise.resolve({
      data: { id: itemId, is_available: isAvailable },
      error: null
    })
  }
}

export const mockAdminOrders = {
  listOrders: (filters = {}) => Promise.resolve({
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
  }),

  getOrder: (id) => Promise.resolve({
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
  }),

  cancelOrder: (id) => {
    // Only unfinished orders can be cancelled
    return Promise.resolve({
      data: { id, status: "cancelled" },
      error: null
    })
  },
  markOutForDelivery: (id, { delivery_note } = {}) => {
    return Promise.resolve({
      data: { id, status: "out_for_delivery", delivery_note },
      error: null
    })
  },
  markDelivered: (id) => {
    return Promise.resolve({
      data: { id, status: "delivered" },
      error: null
    })
  },
  markPickedUp: (id) => {
    return Promise.resolve({
      data: { id, status: "picked_up" },
      error: null
    })
  },
  markPaid: (id) => {
    return Promise.resolve({
      data: { id, payment_status: "paid", paid_at: new Date().toISOString() },
      error: null
    })
  },
  tableBill: (tableNumber) => {
    return Promise.resolve({
      data: {
        orders: [{
          receipt_number: "KG-1042",
          total: 545.00
        }],
        combined_total: 545.00
      },
      error: null
    })
  },
  markTablePaid: (tableNumber) => {
    return Promise.resolve({
      data: { paid_count: 1, combined_total: 545.00 },
      error: null
    })
  }
}
export const mockAdminContent = {
  // Settings
  getSettingsFull: () => Promise.resolve({
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
  }),

  updateSettings: (settings) => Promise.resolve({
    data: { id: 1, ...settings },
    error: null
  }),

  // Categories
  listCategories: () => Promise.resolve({
    data: [
      { id: "cat-1", name: "Starters", sort_order: 0 },
      { id: "cat-2", name: "Main Course", sort_order: 1 },
      { id: "cat-3", name: "Desserts", sort_order: 2 }
    ],
    error: null
  }),

  createCategory: (name) => Promise.resolve({
    data: { id: `cat-${Date.now()}`, name, sort_order: 0 },
    error: null
  }),

  updateCategory: (id, { name, sort_order }) => Promise.resolve({
    data: { id, name, sort_order },
    error: null
  }),

  deleteCategory: (id) => Promise.resolve({
    data: { id, deleted: true },
    error: null
  }),
  listItems: (categoryId = null) => Promise.resolve({
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
  }),

  createItem: (item) => Promise.resolve({
    data: { id: `item-${Date.now()}`, ...item },
    error: null
  }),

  updateItem: (id, item) => Promise.resolve({
    data: { id, ...item },
    error: null
  }),

  deleteItem: (id) => Promise.resolve({
    data: { id, deleted: true },
    error: null
  }),

  listTables: () => Promise.resolve({
    data: [
      { table_number: 1, is_active: true, qr_url: "/order?table=1" },
      { table_number: 2, is_active: true, qr_url: "/order?table=2" },
      { table_number: 5, is_active: true, qr_url: "/order?table=5" }
    ],
    error: null
  }),

  createTable: (table_number) => Promise.resolve({
    data: { table_number, is_active: true, qr_url: `/order?table=${table_number}` },
    error: null
  }),

  setTableActive: (tableNumber, active) => Promise.resolve({
    data: { table_number: tableNumber, is_active: active },
    error: null
  }),

  listReservations: (filters = {}) => Promise.resolve({
    data: [
      { id: "res-1", name: "Rahim Uddin", phone: "01712345678", date: "2026-10-15", time: "19:00", guests: 4, status: "pending" }
    ],
    error: null
  }),

  setReservationStatus: (id, status) => Promise.resolve({
    data: { id, status },
    error: null
  }),

  
  listFeedback: (unreadOnly = false) => Promise.resolve({
    data: [
      { id: "fb-1", type: "review", name: "Ali", phone: "01712345678", rating: 5, message: "Great food!", is_approved: false, is_read: false }
    ],
    error: null
  }),

  setFeedbackRead: (id) => Promise.resolve({
    data: { id, is_read: true },
    error: null
  }),

  approveReview: (id, approved) => Promise.resolve({
    data: { id, is_approved: approved },
    error: null
  }),

  deleteFeedback: (id) => Promise.resolve({
    data: { id, deleted: true },
    error: null
  }),
  listGallery: () => Promise.resolve({
    data: [
      { id: "gal-1", image_url: "https://example.com/image1.jpg", caption: "Plate presentation", sort_order: 0 }
    ],
    error: null
  }),

  addGalleryImage: (file, caption) => Promise.resolve({
    data: { id: `gal-${Date.now()}`, image_url: `https://storage.example.com/${Date.now()}.jpg`, caption },
    error: null
  }),

  deleteGalleryImage: (id) => Promise.resolve({
    data: { id, deleted: true },
    error: null
  })
}
export default {
  auth: mockAuth,
  kitchen: mockKitchen,
  adminOrders: mockAdminOrders,
  adminContent: mockAdminContent
}