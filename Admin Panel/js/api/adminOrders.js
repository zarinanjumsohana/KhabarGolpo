// js/api/adminOrders.js — order operations for the admin panel.
// Business rules (transition matrix, payment, table bills) live in Postgres RPCs.

import { isMock } from '../config.js';
import { supabase } from '../supabaseClient.js';
import { Mock, mockRealtime } from '../mock/index.js';
import { ok, fail, fromSupabase, friendly, withMock } from './shared.js';

export async function listOrders(filters = {}) {
  return withMock(
    () => Mock.adminOrders.listOrders(filters),
    async () => {
      const sb = await supabase();
      const { type, status, payment, table, q, from, to, page = 1, perPage = 10 } = filters;
      let query = sb.from('orders').select('*, order_items(*)', { count: 'exact' });

      if (type) query = query.eq('order_type', type);
      if (status) query = query.eq('status', status);
      if (payment) query = query.eq('payment_status', payment);
      if (table) query = query.eq('table_number', Number(table));
      if (from) query = query.gte('created_at', new Date(from).toISOString());
      if (to) query = query.lte('created_at', new Date(`${String(to).slice(0, 10)}T23:59:59`).toISOString());
      if (q) {
        query = query.or(`receipt_number.ilike.%${q}%,customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
      }

      const fromRow = (page - 1) * perPage;
      const res = await query
        .order('created_at', { ascending: false })
        .range(fromRow, fromRow + perPage - 1);

      if (res.error) return fail('LIST_FAILED', friendly(res.error.message));
      const rows = (res.data || []).map(mapOrder);
      return ok({ rows, total: res.count ?? rows.length, page, perPage });
    }
  );
}

/* The live tables use receipt_number / customer_phone / item_name / quantity.
   The panel was written against the short names, so normalise here once. */
function mapOrder(o) {
  const { order_items, ...rest } = o;
  const items = (order_items || o.items || []).map((i) => ({
    id: i.id,
    name: i.item_name || i.name || '',
    qty: i.quantity != null ? i.quantity : i.qty,
    price: Number(i.unit_price != null ? i.unit_price : i.price) || 0,
    line_total: Number(i.line_total) || 0,
  }));
  return {
    ...rest,
    receipt: o.receipt_number || o.receipt || '',
    phone: o.customer_phone || o.phone || '',
    address: o.delivery_address || o.address || '',
    address_note: o.address_note || '',
    tax: Number(o.tax_amount != null ? o.tax_amount : o.tax) || 0,
    items,
  };
}

export async function getOrder(id) {
  return withMock(
    () => Mock.adminOrders.getOrder(id),
    async () => {
      const sb = await supabase();
      const res = await sb.from('orders').select('*, order_items(*)').eq('id', id).single();
      if (res.error) return fail('NOT_FOUND', 'That order could not be found.');
      return ok(mapOrder(res.data));
    }
  );
}

async function transition(id, status, note) {
  const sb = await supabase();
  const res = await sb.rpc('update_order_status', {
    p_order_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (res.error) return fail('INVALID_TRANSITION', friendly(res.error.message));
  return ok(res.data ?? { id, status });
}

export const cancelOrder = (id) =>
  withMock(() => Mock.adminOrders.cancelOrder(id), () => transition(id, 'cancelled'));

export const acceptOrder = (id) =>
  withMock(() => ok({ id, status: 'approved' }), () => transition(id, 'approved'));

export const markOutForDelivery = (id, note) =>
  withMock(() => Mock.adminOrders.markOutForDelivery(id, note), () => transition(id, 'out_for_delivery', note));

export const markDelivered = (id) =>
  withMock(() => Mock.adminOrders.markDelivered(id), () => transition(id, 'completed'));

export const markPickedUp = (id) =>
  withMock(() => Mock.adminOrders.markPickedUp(id), () => transition(id, 'completed'));

export async function markPaid(id) {
  return withMock(
    () => Mock.adminOrders.markPaid(id),
    async () => {
      const sb = await supabase();
      const res = await sb.rpc('mark_paid', { p_order_id: id });
      if (res.error) return fail('PAY_FAILED', friendly(res.error.message));
      return ok(res.data ?? { id, payment_status: 'paid' });
    }
  );
}

export async function getTableBill(tableId) {
  return withMock(
    () => Mock.adminOrders.getTableBill(tableId),
    async () => {
      const sb = await supabase();
      const res = await sb.rpc('table_bill', { p_table_id: tableId });
      if (res.error) return fail('NO_OPEN_BILL', friendly(res.error.message));
      return ok(res.data);
    }
  );
}

export async function markTablePaid(tableId) {
  return withMock(
    () => Mock.adminOrders.markTablePaid(tableId),
    async () => {
      const sb = await supabase();
      const res = await sb.rpc('mark_table_paid', { p_table_id: tableId });
      if (res.error) return fail('TABLE_PAY_FAILED', friendly(res.error.message));
      return ok(res.data);
    }
  );
}

/** Live order feed. Returns an unsubscribe function. */
let channelSeq = 0;

export function subscribeOrders(cb) {
  if (isMock()) return mockRealtime.subscribe(cb);

  let channel = null;
  let polling = null;
  supabase().then((sb) => {
    if (!sb) return;
    /* Every caller gets its own topic: reusing one name means the second
       .on() runs after subscribe() and Supabase throws. */
    const topic = `admin-orders-${++channelSeq}`;
    channel = sb
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => cb({ type: payload.eventType, new: mapOrder(payload.new || {}), old: payload.old })
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          // Realtime outage → polling fallback (Architecture §11)
          polling = setInterval(async () => {
            const res = await sb
              .from('orders')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1);
            if (res.data?.[0]) cb({ type: 'POLL', new: mapOrder(res.data[0]) });
          }, 12000);
        }
      });
  });

  return () => {
    if (channel) supabase().then((sb) => sb?.removeChannel(channel));
    if (polling) clearInterval(polling);
  };
}
