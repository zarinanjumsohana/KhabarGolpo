/* KhabarGolpo kitchen - live order board.
   Reads the orders the admin has accepted and renders them with the same card
   markup the demo board used, so the panel looks exactly the same. Chef actions
   move the order along: waiting -> preparing -> ready -> completed. */

import { supabase } from './supabaseClient.js';
import { requireStaff } from './session.js';

const BOARD = '#view-orders';
const ADVANCE = { approved: 'preparing', preparing: 'ready', ready: 'completed' };
const LABEL = { approved: 'Waiting', preparing: 'Preparing', ready: 'Ready' };
const STATE = { approved: 'waiting', preparing: 'preparing', ready: 'ready' };
const BTN = { approved: 'Start preparing', preparing: 'Mark as ready', ready: 'Mark completed' };

const esc = (v) =>
  String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clock = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const minutesSince = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));

function typeTag(o) {
  if (o.order_type === 'dine-in') {
    return `<span class="tag is-dine">Dine-in &middot; Table ${esc(o.table_number || '—')}</span>`;
  }
  if (o.order_type === 'pickup') {
    return `<span class="tag is-pickup">Pickup${o.customer_name ? ' &middot; ' + esc(o.customer_name) : ''}</span>`;
  }
  return `<span class="tag is-delivery">Delivery${o.customer_name ? ' &middot; ' + esc(o.customer_name) : ''}</span>`;
}

function card(o) {
  const state = STATE[o.status] || 'waiting';
  const mins = minutesSince(o.created_at);
  const items = (o.order_items || [])
    .map(
      (it) => `<li class="order-item" data-item-name="${esc(it.item_name)}"><span class="qty tnum">${it.quantity}</span><span class="item-body"><span class="item-name">${esc(it.item_name)}</span></span></li>`
    )
    .join('');

  const stepOf = (label, i) => {
    const order = ['waiting', 'preparing', 'ready'];
    const at = order.indexOf(state);
    const cls = i < at ? 'done' : i === at ? 'now' : '';
    return `<li class="step ${cls}"><span class="step-dot" aria-hidden="true"></span>${label}</li>`;
  };

  return `
    <article class="order${mins > 30 && state !== 'ready' ? ' is-late' : ''}" data-order-id="${esc(o.receipt_number || o.id)}" data-order-uuid="${esc(o.id)}" data-live="1" data-order-state="${state}" data-minutes="${mins}">
    <header class="order-head">
      <div>
        <p class="order-id">${esc(o.receipt_number || 'Order')}</p>
        <div class="order-tags">
          ${typeTag(o)}
          <span class="state-chip is-${state}" data-state-chip>${LABEL[o.status] || 'Waiting'}</span>
        </div>
      </div>
      <div class="elapsed">
        <span class="elapsed-time tnum">${mins} min</span>
        <span class="elapsed-meta tnum">Placed at ${clock(o.created_at)}</span>
      </div>
    </header>
    <ul class="order-items">${items}</ul>
    ${o.note ? `<p class="order-note"><span>${esc(o.note)}</span></p>` : ''}
    <footer class="order-foot">
      <ol class="steps" aria-label="Order progress">
        ${stepOf('Waiting', 0)}${stepOf('Preparing', 1)}${stepOf('Ready', 2)}
      </ol>
      <button class="btn btn-primary btn-advance btn-block" type="button" data-order-advance>${BTN[o.status] || 'Start preparing'}</button>
    </footer>
  </article>`;
}

function refreshCounts() {
  const counts = { waiting: 0, preparing: 0, ready: 0 };
  document.querySelectorAll(`${BOARD} .order[data-order-state]`).forEach((el) => {
    const s = el.getAttribute('data-order-state');
    if (s in counts) counts[s] += 1;
  });
  const text = (sel, v) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = v;
  };
  text('[data-status-count="waiting"]', counts.waiting);
  text('[data-status-count="preparing"]', counts.preparing + counts.ready);
  const active = counts.waiting + counts.preparing + counts.ready;
  text('[data-nav-active]', active);
  text('[data-metric-active]', active);
  text('[data-metric-late]', document.querySelectorAll(`${BOARD} .order.is-late`).length);
}

/* "By Items" view: every dish across the active orders, grouped like a prep list. */
function whoOf(o) {
  if (o.order_type === 'dine-in') return `Table ${o.table_number || '—'}`;
  return o.customer_name || (o.order_type === 'pickup' ? 'Pickup' : 'Delivery');
}

function renderMatrix(rows) {
  const host = document.getElementById('itemMatrix');
  const meta = document.getElementById('matrixMeta');
  if (!host) return;

  const items = new Map();
  rows.forEach((o) =>
    (o.order_items || []).forEach((it) => {
      const key = it.item_name || 'Item';
      const entry = items.get(key) || { name: key, qty: 0, lines: [] };
      entry.qty += Number(it.quantity) || 0;
      entry.lines.push({ who: whoOf(o), qty: it.quantity, note: o.note || '' });
      items.set(key, entry);
    })
  );

  const list = [...items.values()].sort((a, b) => b.qty - a.qty);
  const portions = list.reduce((a, i) => a + i.qty, 0);

  if (meta) {
    meta.textContent = list.length
      ? `${portions} portions · ${list.length} dishes · ${rows.length} active orders`
      : 'No active orders right now.';
  }

  host.innerHTML = list
    .map(
      (item) => `
      <article class="product-box" data-item-name="${esc(item.name)}">
        <div class="product-box-head">
          <div>
            <h3 class="product-name">${esc(item.name)}</h3>
            <p class="product-cat">${item.lines.length} order${item.lines.length === 1 ? '' : 's'}</p>
          </div>
          <span class="product-mult tnum" aria-label="Total quantity ${item.qty}">x${item.qty}</span>
        </div>
        <ul class="product-orders">
          ${item.lines
            .map(
              (l, i) => `<li class="product-order">
                <span class="product-order-main"><span class="product-order-name">${i + 1}. ${esc(l.who)}</span><span class="product-order-qty tnum">x${l.qty}</span></span>
                ${l.note ? `<span class="product-order-note">${esc(l.note)}</span>` : ''}
              </li>`
            )
            .join('')}
        </ul>
      </article>`
    )
    .join('');
}

export async function loadOrders(sb) {
  const host = document.querySelector(BOARD);
  if (!host) return;

  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(*)')
    .in('status', ['approved', 'preparing', 'ready'])
    .order('created_at', { ascending: true });

  if (error) {
    host.innerHTML = `<p class="muted" style="padding:24px">Could not load orders: ${esc(error.message)}</p>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    host.innerHTML = '<p class="muted" style="padding:24px">No accepted orders right now. New orders appear here as soon as the admin accepts them.</p>';
    refreshCounts();
    renderMatrix(rows);
    document.dispatchEvent(new CustomEvent('kg:orders-changed'));
    return;
  }

  host.innerHTML = rows.map(card).join('');
  refreshCounts();
  renderMatrix(rows);
  document.dispatchEvent(new CustomEvent('kg:orders-changed'));
}

const boot = async () => {
  const staff = await requireStaff();
  if (!staff) return;
  const sb = staff.sb;

  /* Header: today's date and the signed-in chef, not demo text. */
  const pill = document.querySelector('.topbar .pill');
  if (pill) {
    const icon = pill.querySelector('svg');
    pill.textContent = '';
    if (icon) pill.appendChild(icon);
    pill.appendChild(
      document.createTextNode(
        new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
      )
    );
  }
  const chefEl = document.querySelector('.service-chef');
  if (chefEl) chefEl.textContent = `${staff.name || 'Staff'} on shift`;

  await loadOrders(sb);

  /* Chef action: move the order to the next state. */
  document.addEventListener(
    'click',
    async (e) => {
      const btn = e.target.closest && e.target.closest('[data-order-advance]');
      if (!btn) return;
      const el = btn.closest('.order');
      if (!el || el.getAttribute('data-live') !== '1') return;   // demo cards keep their own behaviour

      e.preventDefault();
      e.stopPropagation();

      const uuid = el.getAttribute('data-order-uuid');
      if (!uuid) return;

      btn.disabled = true;
      /* One kitchen RPC for every step: approved/new -> preparing -> ready ->
         completed. It keeps the chef flow independent of the admin matrix. */
      const { error } = await sb.rpc('kg_kitchen_advance', { p_order_id: uuid });
      btn.disabled = false;

      if (error) {
        const live = document.querySelector('[data-live]');
        if (live) live.textContent = error.message;
        return;
      }
      await loadOrders(sb);
    },
    true
  );

  /* Live updates: a new accepted order shows up without refreshing. */
  sb.channel('kitchen-orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadOrders(sb))
    .subscribe();

  /* Safety net if realtime is blocked on the network. */
  setInterval(() => loadOrders(sb), 30000);
};

boot();
