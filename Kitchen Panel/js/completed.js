/* KhabarGolpo kitchen — completed orders today.
   The completed page used to show hard-coded demo rows. It now reads the real
   orders the kitchen has finished and keeps the same row design. */

import { requireStaff } from './session.js';

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

const money = (n) => '৳ ' + Number(n || 0).toLocaleString('en-US');

function metaOf(o) {
  if (o.order_type === 'dine-in') return `Dine-in &middot; Table ${esc(o.table_number || '—')}`;
  if (o.order_type === 'pickup') return `Pickup${o.customer_name ? ' &middot; ' + esc(o.customer_name) : ''}`;
  return `Delivery${o.customer_name ? ' &middot; ' + esc(o.customer_name) : ''}`;
}

function row(o) {
  const items = (o.order_items || [])
    .map((it) => `${esc(it.quantity)} &times; ${esc(it.item_name)}`)
    .join(' &middot; ');
  const paid = o.payment_status === 'paid';
  return `
    <div class="done-row">
      <span class="done-id">${esc(o.receipt_number || 'Order')}</span>
      <span class="done-meta">${metaOf(o)}</span>
      <span class="done-items">${items || '—'}</span>
      <span class="done-time tnum">${money(o.total)}</span>
      <span class="done-state${paid ? '' : ' is-unpaid'}">${paid ? 'Paid' : 'Unpaid'}</span>
    </div>`;
}

async function refreshNav(sb) {
  const text = (sel, v) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = v;
  };
  try {
    const { data } = await sb.from('orders').select('status').in('status', ['approved', 'preparing', 'ready']);
    const counts = { waiting: 0, preparing: 0 };
    (data || []).forEach((o) => {
      if (o.status === 'approved') counts.waiting += 1;
      else counts.preparing += 1;
    });
    text('[data-status-count="waiting"]', counts.waiting);
    text('[data-status-count="preparing"]', counts.preparing);
    text('[data-nav-active]', counts.waiting + counts.preparing);
  } catch (e) {
    /* nav badges are cosmetic — never block the list */
  }
  try {
    const { count } = await sb.from('menu_items').select('id', { count: 'exact', head: true });
    if (count != null) text('[data-menu-nav-count]', count);
  } catch (e) {
    /* ignore */
  }
}

async function load(sb) {
  const host = document.getElementById('doneList');
  if (!host) return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .eq('status', 'completed')
    .gte('created_at', start.toISOString())
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) {
    host.innerHTML = `<p class="muted" style="padding:24px">Could not load completed orders: ${esc(error.message)}</p>`;
    return;
  }

  const rows = data || [];
  host.innerHTML = rows.length
    ? rows.map(row).join('')
    : `<div class="done-row"><span class="done-id">—</span><span class="done-meta">No completed orders yet today</span><span class="done-items">Finished orders appear here as soon as the kitchen marks them completed.</span><span class="done-time tnum"></span><span class="done-state is-neutral">—</span></div>`;

  await refreshNav(sb);
}

const boot = async () => {
  const staff = await requireStaff();
  if (!staff) return;
  const sb = staff.sb;
  await load(sb);

  sb.channel('kitchen-completed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load(sb))
    .subscribe();

  setInterval(() => load(sb), 30000);
};

boot();
