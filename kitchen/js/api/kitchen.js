// Khabar Golpo — Kitchen API layer
// Chef (or admin) functions for order status, live orders, availability
// Auto-switches based on MOCK_MODE in config.js

import { isMock } from "../config.js";
import { supabase } from "../supabaseClient.js";

// ---- Mock implementations ----

let mockOrders = [
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
];

const mockGetActiveOrders = () => Promise.resolve({
  data: mockOrders.filter(o => o.status !== 'completed'),
  error: null
});

const mockSubscribeOrders = (onEvent) => {
  onEvent(mockOrders.filter(o => o.status !== 'completed'));
  return () => {};
};

const mockUpdateStatus = (orderId, to) => {
  const current = mockOrders.find(o => o.id === orderId);
  if (!current) {
    return Promise.resolve({ data: null, error: { code: "NOT_FOUND", message: "Order not found" } });
  }
  mockOrders = mockOrders.map(o => o.id === orderId ? { ...o, status: to } : o);
  return Promise.resolve({
    data: mockOrders.find(o => o.id === orderId),
    error: null
  });
};

const mockSetAvailability = (itemId, isAvailable) => Promise.resolve({
  data: { id: itemId, is_available: isAvailable },
  error: null
});

// ---- Public API Layer ----

export async function getActiveOrders() {
  if (isMock()) return mockGetActiveOrders();
  const sb = await supabase();
  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .in('status', ['new', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  if (error) return { data: null, error: { code: 'FETCH_FAILED', message: error.message } };

  const formatted = (data || []).map(o => ({
    id: o.id,
    receipt_number: o.receipt_number,
    order_type: o.order_type,
    table_number: o.table_number,
    first_name: (o.customer_name || '').split(' ')[0] || null,
    pickup_time: o.pickup_time,
    status: o.status,
    items: (o.order_items || []).map(i => ({ name: i.item_name, qty: i.quantity })),
    note: o.note,
    created_at: o.created_at,
    wait_minutes: Math.max(0, Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000))
  }));

  return { data: formatted, error: null };
}

export async function subscribeOrders(onEvent) {
  if (isMock()) return mockSubscribeOrders(onEvent);
  const sb = await supabase();
  
  // Initial fetch
  getActiveOrders().then(res => {
    if (res.data) onEvent(res.data);
  });

  const channel = sb.channel('kitchen_orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, async () => {
      const refreshed = await getActiveOrders();
      if (refreshed.data) onEvent(refreshed.data);
    })
    .subscribe();

  return () => {
    sb.removeChannel(channel);
  };
}

export async function updateStatus(orderId, to) {
  if (isMock()) return mockUpdateStatus(orderId, to);
  const sb = await supabase();
  const { data, error } = await sb.rpc('update_order_status', {
    p_order_id: orderId,
    p_status: to
  });
  if (error) return { data: null, error: { code: 'UPDATE_FAILED', message: error.message } };
  return { data, error: null };
}

export async function setOrderCompleted(orderId) {
  return updateStatus(orderId, "completed");
}

export async function setAvailability(itemId, isAvailable) {
  if (isMock()) return mockSetAvailability(itemId, isAvailable);
  const sb = await supabase();
  const { data, error } = await sb
    .from('menu_items')
    .update({ is_available: isAvailable })
    .eq('id', itemId)
    .select()
    .single();

  if (error) return { data: null, error: { code: 'UPDATE_FAILED', message: error.message } };
  return { data, error: null };
}
