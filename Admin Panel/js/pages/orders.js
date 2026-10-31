// js/pages/orders.js — all orders, filters, actions, live feed.

import { requireAdmin } from '../utils/guards.js';
import { initShell, setNavBadge } from './shell.js';
import { listOrders, getOrder, cancelOrder, acceptOrder, markOutForDelivery, markDelivered, markPickedUp, markPaid, subscribeOrders } from '../api/adminOrders.js';
import { listTables } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { openDrawer, openModal, confirmDialog, toast, emptyState, skeleton, esc, buttonLoading, reveal } from '../utils/ui.js';
import { money, titleCase, fmtDateTime, relTime, minsSince, shortName } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

const state = { q: '', type: '', status: '', payment: '', table: '', from: '', to: '', page: 1, perPage: 8 };
let rows = [];
let total = 0;
let drawer = null;
let currentId = null;
let loading = false;

const TYPE_LABEL = { 'dine-in': 'Dine-in', dine_in: 'Dine-in', pickup: 'Pickup', delivery: 'Delivery' };
const isActive = (o) => !['completed', 'cancelled'].includes(o.status);

/* ------------------------------ rendering ------------------------------ */
function cardHtml(o, i) {
  const wait = minsSince(o.created_at);
  const showWait = isActive(o) && o.status !== 'completed';
  const items = (o.items || []).slice(0, 3);
  const more = (o.items || []).length - items.length;
  const who = o.table_number ? `Table ${o.table_number}` : shortName(o.customer_name || 'Customer');

  return `
  <article class="order-card new-row" data-id="${o.id}" style="animation-delay:${Math.min(i * 45, 500)}ms" tabindex="0" role="button" aria-label="Open ${esc(o.receipt)}">
    <div class="oc-left">
      <span class="oc-receipt">${esc(o.receipt)}</span>
      <span class="oc-time">${icon('clock')} ${esc(fmtDateTime(o.created_at))}</span>
      ${showWait ? `<span><span class="wait ${wait > 30 ? 'hot' : ''}">${wait} min waiting</span></span>` : ''}
    </div>

    <div class="oc-mid">
      <span class="oc-who">
        <span class="type-chip type-${o.order_type}" data-icon="${o.order_type === 'delivery' ? 'truck' : o.order_type === 'pickup' ? 'bag' : 'table'}"></span>
        <span class="type-name type-${o.order_type}">${TYPE_LABEL[o.order_type] || ''}</span>
        <b>${esc(who)}</b>
        ${o.customer_name ? `<span class="sep">·</span><span class="muted">${esc(o.customer_name)}</span>` : ''}
        ${o.phone ? `<span class="sep">·</span><span class="muted">${esc(o.phone)}</span>` : ''}
        ${o.email ? `<span class="sep">·</span><span class="muted">${esc(o.email)}</span>` : ''}
        ${o.status === 'out_for_delivery' ? '<span class="sep">·</span><span class="muted">On the way</span>' : ''}
      </span>
      <span class="oc-items">
        ${items.map((it) => `<span class="oc-item">${esc(it.name)} <b>×${it.qty}</b></span>`).join('')}
        ${more > 0 ? `<span class="oc-more">+${more} more</span>` : ''}
      </span>
    </div>

    <div class="oc-right">
      <span class="oc-total">${money(o.total)}</span>
      <span class="oc-badges">
        <span class="badge st-${o.status}">${esc(titleCase(o.status))}</span>
        <span class="badge st-${o.payment_status}">${o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
      </span>
      <span class="oc-actions">
        ${o.status === 'new' ? `<button class="btn btn-success btn-xs" data-act="accepted" data-id="${o.id}">${icon('check')} Accept</button>` : ''}
        ${o.payment_status === 'unpaid' && o.status !== 'cancelled' ? `<button class="btn btn-success btn-xs" data-act="paid" data-id="${o.id}">${icon('check')} Pay</button>` : ''}
        <a class="btn btn-ghost btn-xs" href="./receipt.html?receipt=${encodeURIComponent(o.receipt)}" data-stop>${icon('printer')} Receipt</a>
      </span>
    </div>
  </article>`;
}

function renderList() {
  const host = $('list');
  if (!rows.length) {
    host.innerHTML = emptyState({
      icon: 'search',
      title: 'No orders match',
      hint: 'Try clearing a filter or widen the date range.',
    });
    hydrateIcons(host);
    $('pager').style.display = 'none';
    return;
  }
  host.innerHTML = rows.map(cardHtml).join('');
  hydrateIcons(host);
  renderPager();
}

function renderPager() {
  const pages = Math.max(1, Math.ceil(total / state.perPage));
  $('pager').style.display = 'flex';
  const from = (state.page - 1) * state.perPage + 1;
  const to = Math.min(total, state.page * state.perPage);
  $('pagerInfo').textContent = `Showing ${from}–${to} of ${total} order${total === 1 ? '' : 's'}`;

  let btns = `<button class="pg" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="Previous">${icon('chevronLeft')}</button>`;
  const list = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - state.page) <= 1) list.push(p);
    else if (list[list.length - 1] !== '…') list.push('…');
  }
  btns += list.map((p) => (p === '…' ? '<span class="pg">…</span>' : `<button class="pg ${p === state.page ? 'on' : ''}" data-page="${p}">${p}</button>`)).join('');
  btns += `<button class="pg" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="Next">${icon('chevronRight')}</button>`;
  $('pagerBtns').innerHTML = btns;
}

function updateNote() {
  const bits = [];
  if (state.type) bits.push(`Type: ${TYPE_LABEL[state.type]}`);
  if (state.status) bits.push(`Status: ${titleCase(state.status)}`);
  if (state.payment) bits.push(`Payment: ${titleCase(state.payment)}`);
  if (state.table) bits.push(`Table ${state.table}`);
  if (state.from || state.to) bits.push(`Date ${state.from || '…'} to ${state.to || '…'}`);
  if (state.q) bits.push(`Search “${state.q}”`);
  $('filterNote').textContent = `Showing ${rows.length} of ${total} orders` + (bits.length ? ` · ${bits.join(' · ')}` : ' · no filter, all orders');
}

function wireTypeTabs() {
  const tabs = document.querySelectorAll('#typeTabs [data-type]');
  const sync = () => tabs.forEach((t) => t.classList.toggle('on', t.dataset.type === state.type));
  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      state.type = t.dataset.type;
      state.page = 1;
      $('ftype').value = state.type;
      sync();
      load();
    })
  );
  $('ftype').addEventListener('change', sync);
  $('btnClear').addEventListener('click', sync);
}

async function load({ silent = false } = {}) {
  if (loading) return;
  loading = true;
  if (!silent) $('list').innerHTML = skeleton(5);
  const res = await listOrders(state);
  loading = false;
  if (res.error) {
    toast({ type: 'error', title: 'Could not load orders', message: res.error.message });
    return;
  }
  rows = res.data.rows;
  total = res.data.total;
  renderList();
  updateNote();
  const pending = rows.filter((o) => isActive(o)).length;
  setNavBadge('orders', pending);
}

/* ------------------------------ detail drawer ------------------------------ */
function timelineHtml(o) {
  const steps = {
    dine_in: [
      ['new', 'Received'],
      ['approved', 'Accepted'],
      ['preparing', 'Preparing'],
      ['ready', 'Ready at table'],
    ],
    'dine-in': [
      ['new', 'Received'],
      ['approved', 'Accepted'],
      ['preparing', 'Preparing'],
      ['ready', 'Ready at table'],
    ],
    pickup: [
      ['new', 'Received'],
      ['approved', 'Accepted'],
      ['preparing', 'Preparing'],
      ['ready', 'Ready for pickup'],
      ['completed', 'Picked up'],
    ],
    delivery: [
      ['new', 'Received'],
      ['approved', 'Accepted'],
      ['preparing', 'Preparing'],
      ['ready', 'Ready'],
      ['out_for_delivery', 'Out for delivery'],
      ['completed', 'Delivered'],
    ],
  }[o.order_type];

  const order = steps.map((s) => s[0]);
  const idx = o.status === 'cancelled' ? -1 : order.indexOf(o.status);

  return `
    <div class="tl">
      ${steps
        .map(
          ([key, label], i) => `
        <div class="tl-item ${idx > i || (o.status === 'completed' && i <= steps.length - 1) ? 'done' : ''} ${idx === i ? 'now' : ''}">
          <div class="tl-label">${label}</div>
          <div class="tl-time">${i <= idx ? esc(fmtDateTime(o.created_at)) : 'waiting'}</div>
        </div>`
        )
        .join('')}
      ${o.status === 'cancelled' ? `<div class="tl-item done" style="opacity:.85"><div class="tl-label" style="color:var(--red)">Cancelled</div><div class="tl-time">excluded from revenue</div></div>` : ''}
    </div>`;
}

function detailHtml(o) {
  const items = o.items || [];
  const sub = items.reduce((a, it) => a + it.line_total, 0);

  const actions = [];
  if (o.status === 'new')
    actions.push({ act: 'accepted', cls: 'btn-success', ic: 'check', label: 'Accept & send to kitchen' });
  if (o.payment_status === 'unpaid' && o.status !== 'cancelled')
    actions.push({ act: 'paid', cls: 'btn-success', ic: 'wallet', label: 'Mark as paid (cash)' });
  if (o.order_type === 'delivery' && o.status === 'ready')
    actions.push({ act: 'out', cls: 'btn-primary', ic: 'truck', label: 'Out for delivery' });
  if (o.order_type === 'delivery' && o.status === 'out_for_delivery')
    actions.push({ act: 'delivered', cls: 'btn-success', ic: 'check', label: 'Mark delivered' });
  if (o.order_type === 'pickup' && o.status === 'ready')
    actions.push({ act: 'picked', cls: 'btn-success', ic: 'check', label: 'Mark picked up' });
  if (isActive(o)) actions.push({ act: 'cancel', cls: 'btn-danger', ic: 'x', label: 'Cancel order' });

  return `
    <div class="dt-sec">
      <div class="oc-badges" style="justify-content:flex-start;margin-bottom:14px">
        <span class="type-chip type-${o.order_type}">${icon(o.order_type === 'delivery' ? 'truck' : o.order_type === 'pickup' ? 'bag' : 'table')} ${esc(titleCase(o.order_type))}</span>
        <span class="badge st-${o.status}">${esc(titleCase(o.status))}</span>
        <span class="badge st-${o.payment_status}">${o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
      </div>

      <div class="dt-row"><span>Placed</span><b>${esc(fmtDateTime(o.created_at))}</b></div>
      ${o.table_number ? `<div class="dt-row"><span>Table</span><b>#${o.table_number}</b></div>` : ''}
      ${o.customer_name ? `<div class="dt-row"><span>Customer</span><b>${esc(o.customer_name)}</b></div>` : ''}
      ${o.phone ? `<div class="dt-row"><span>Phone</span><b><a href="tel:${esc(o.phone)}" style="color:var(--brand)">${esc(o.phone)}</a></b></div>` : ''}
      ${o.email ? `<div class="dt-row"><span>Email</span><b>${esc(o.email)}</b></div>` : ''}
      ${o.address ? `<div class="dt-row"><span>Address</span><b>${esc(o.address)}${o.address_note ? `<br><span class="muted xsmall">${esc(o.address_note)}</span>` : ''}</b></div>` : ''}
      ${o.pickup_time ? `<div class="dt-row"><span>Preferred pickup</span><b>${esc(o.pickup_time)}</b></div>` : ''}
      ${o.delivery_agency_note ? `<div class="dt-row"><span>Agency note</span><b>${esc(o.delivery_agency_note)}</b></div>` : ''}
      ${o.paid_at ? `<div class="dt-row"><span>Paid at</span><b>${esc(fmtDateTime(o.paid_at))}</b></div>` : ''}
    </div>

    ${o.note ? `<div class="dt-sec"><h4>Order note</h4><div class="dt-note">${esc(o.note)}</div></div>` : ''}

    <div class="dt-sec">
      <h4>Items</h4>
      <div class="dt-items">
        ${items.map((it) => `<div class="dt-item"><span>${esc(it.name)}</span><span class="qty">×${it.qty}</span><span class="amt">${money(it.line_total)}</span></div>`).join('')}
      </div>
      <div class="dt-items" style="margin-top:12px;border-top:1px dashed var(--line);padding-top:10px">
        <div class="dt-item"><span class="muted">Subtotal</span><span></span><span class="amt">${money(sub)}</span></div>
        <div class="dt-item"><span class="muted">Tax</span><span></span><span class="amt">${money(o.tax)}</span></div>
        ${o.delivery_fee ? `<div class="dt-item"><span class="muted">Delivery fee</span><span></span><span class="amt">${money(o.delivery_fee)}</span></div>` : ''}
        <div class="dt-item" style="font-weight:700;font-size:16px"><span>Total</span><span></span><span class="amt">${money(o.total)}</span></div>
      </div>
    </div>

    <div class="dt-sec">
      <h4>Status timeline</h4>
      ${timelineHtml(o)}
    </div>

    <div class="dt-sec">
      <h4>Actions</h4>
      <div class="action-grid">
        ${actions.map((a) => `<button class="btn ${a.cls} btn-sm ${a.act === 'cancel' ? 'span-2' : ''}" data-drawer-act="${a.act}">${icon(a.ic)}<span>${a.label}</span></button>`).join('')}
        ${o.phone ? `<a class="btn btn-soft btn-sm" href="tel:${esc(o.phone)}">${icon('phone')}<span>Call customer</span></a>` : ''}
        ${o.address ? `<button class="btn btn-soft btn-sm" data-copy="${esc(o.address)}">${icon('copy')}<span>Copy address</span></button>` : ''}
        <a class="btn btn-ghost btn-sm span-2" href="./receipt.html?receipt=${encodeURIComponent(o.receipt)}">${icon('printer')}<span>Open receipt</span></a>
      </div>
    </div>`;
}

async function openDetail(id) {
  let order = rows.find((o) => o.id === id);
  if (!order) {
    const res = await getOrder(id);
    if (res.error || !res.data) {
      toast({ type: 'error', title: 'Order not found', message: res.error?.message || 'Refresh the list and try again.' });
      return;
    }
    order = res.data;
  }

  if (drawer && currentId === id) {
    drawer.body.innerHTML = detailHtml(order);
    hydrateIcons(drawer.body);
    bindDrawerActions(order, drawer);
    return;
  }

  closeDetail();
  currentId = id;
  const dr = openDrawer({ title: order.receipt, subtitle: `${titleCase(order.order_type)} · ${fmtDateTime(order.created_at)}` });
  const baseClose = dr.close;
  dr.close = () => {
    baseClose();
    if (drawer === dr) {
      drawer = null;
      currentId = null;
    }
  };
  drawer = dr;
  dr.body.innerHTML = detailHtml(order);
  hydrateIcons(dr.body);
  bindDrawerActions(order, dr);
}

function closeDetail() {
  drawer?.close();
  drawer = null;
  currentId = null;
}

function bindDrawerActions(order, dr) {
  dr.body.querySelectorAll('[data-drawer-act]').forEach((btn) =>
    btn.addEventListener('click', () => runAction(btn.dataset.drawerAct, order, btn))
  );
  dr.body.querySelectorAll('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        toast({ type: 'success', title: 'Address copied' });
      } catch {
        toast({ type: 'warning', title: 'Could not copy', message: 'Select the address text manually.' });
      }
    })
  );
}

async function runAction(act, order, btn) {
  if (act === 'accepted') {
    if (btn) buttonLoading(btn, true);
    return finish(acceptOrder(order.id), 'accepted', btn);
  }

  if (act === 'cancel') {
    const yes = await confirmDialog({
      title: `Cancel ${order.receipt}?`,
      message: 'The order leaves the kitchen feed and can never be paid. The customer sees “Cancelled” on tracking.',
      confirmText: 'Cancel order',
      danger: true,
    });
    if (!yes) return;
  }

  if (act === 'out') {
    let note = '';
    const res = await openModal({
      title: 'Out for delivery',
      content: `
        <div class="field">
          <label for="dlNote">Agency / rider note (optional)</label>
          <input id="dlNote" placeholder="Pathao · rider 01712345678" />
          <span class="hint">Shown to the admin only. Customers see it on tracking if you add a link.</span>
        </div>`,
      actions: [
        { label: 'Back', className: 'btn-ghost', value: false },
        {
          label: 'Send out',
          className: 'btn-primary',
          value: true,
          onClick: ({ btn: b }) => {
            note = document.getElementById('dlNote')?.value.trim() || '';
            buttonLoading(b, true);
          },
        },
      ],
    }).result;
    if (!res) return;
    return finish(markOutForDelivery(order.id, note), act);
  }

  if (act === 'delivered' || act === 'picked') {
    const yes = await confirmDialog({
      title: act === 'delivered' ? 'Mark as delivered?' : 'Mark as picked up?',
      message: `${order.receipt} will be completed. Remember to record the cash when it arrives.`,
      confirmText: 'Yes, complete it',
      icon: 'check',
    });
    if (!yes) return;
  }

  if (btn) buttonLoading(btn, true);
  const fn = { paid: markPaid, cancel: cancelOrder, delivered: markDelivered, picked: markPickedUp }[act];
  await finish(fn(order.id), act, btn);
}

async function finish(promise, act, btn) {
  const res = await promise;
  if (btn) buttonLoading(btn, false);
  if (res.error) {
    toast({ type: 'error', title: 'Action blocked', message: res.error.message });
    return;
  }
  const msg = {
    accepted: 'Order accepted. It is now on the kitchen screen.',
    paid: 'Payment recorded. It now counts in revenue.',
    cancel: 'Order cancelled and removed from the kitchen feed.',
    out: 'Order marked out for delivery.',
    delivered: 'Order marked delivered.',
    picked: 'Order marked picked up.',
  }[act];
  toast({ type: 'success', title: 'Done', message: msg });

  if (drawer && currentId) {
    const fresh = res.data && res.data.items ? res.data : null;
    if (fresh) {
      drawer.body.innerHTML = detailHtml(fresh);
      hydrateIcons(drawer.body);
      bindDrawerActions(fresh, drawer);
    }
  }
  load({ silent: true });
}

/* ------------------------------ filters ------------------------------ */
function readFilters() {
  state.q = $('fq').value.trim();
  state.type = $('ftype').value;
  state.status = $('fstatus').value;
  state.payment = $('fpay').value;
  state.table = $('ftable').value;
  state.from = $('ffrom').value;
  state.to = $('fto').value;
  state.page = 1;
}

function syncChips() {
  document.querySelectorAll('[data-quick]').forEach((c) => c.classList.toggle('on', c.dataset.quick === state.status));
  $('fstatus').value = state.status;
}

function wireFilters() {
  let t;
  $('fq').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      readFilters();
      load();
    }, 260);
  });
  ['ftype', 'fstatus', 'fpay', 'ftable', 'ffrom', 'fto'].forEach((id) =>
    $(id).addEventListener('change', () => {
      readFilters();
      syncChips();
      load();
    })
  );
  document.querySelectorAll('[data-quick]').forEach((c) =>
    c.addEventListener('click', () => {
      state.status = c.dataset.quick;
      state.page = 1;
      syncChips();
      load();
    })
  );
  $('btnClear').addEventListener('click', () => {
    ['fq', 'ftype', 'fstatus', 'fpay', 'ftable', 'ffrom', 'fto'].forEach((id) => ($(id).value = ''));
    Object.assign(state, { q: '', type: '', status: '', payment: '', table: '', from: '', to: '', page: 1 });
    syncChips();
    load();
    toast({ type: 'info', title: 'Filters cleared' });
  });
  $('btnRefresh').addEventListener('click', () => {
    load();
    toast({ type: 'success', title: 'Feed refreshed' });
  });
  $('pagerBtns').addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b || b.disabled) return;
    state.page = Number(b.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ------------------------------ list wiring ------------------------------ */
function wireList() {
  $('list').addEventListener('click', async (e) => {
    const accept = e.target.closest('[data-act="accepted"]');
    if (accept) {
      e.stopPropagation();
      buttonLoading(accept, true);
      await finish(acceptOrder(accept.dataset.id), 'accepted', accept);
      return;
    }
    const act = e.target.closest('[data-act="paid"]');
    if (act) {
      e.stopPropagation();
      buttonLoading(act, true);
      await finish(markPaid(act.dataset.id), 'paid', act);
      return;
    }
    if (e.target.closest('[data-stop]')) {
      e.stopPropagation();
      return;
    }
    const card = e.target.closest('.order-card');
    if (card) openDetail(card.dataset.id);
  });
  $('list').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const card = e.target.closest('.order-card');
    if (card) openDetail(card.dataset.id);
  });
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('orders', session);
  hydrateIcons($('page'));
  wireFilters();
  wireTypeTabs();
  wireList();
  const rp = new URLSearchParams(location.search).get('receipt');
  if (rp) { state.q = rp; $('fq').value = rp; }
  reveal();

  const [tablesRes] = await Promise.all([listTables(), load()]);
  if (tablesRes.data) {
    $('ftable').insertAdjacentHTML(
      'beforeend',
      tablesRes.data.map((t) => `<option value="${t.table_number}">Table ${t.table_number}</option>`).join('')
    );
  }

  let cool = 0;
  subscribeOrders((evt) => {
    load({ silent: true });
    if (evt.type === 'INSERT' && Date.now() - cool > 4000) {
      cool = Date.now();
      toast({ type: 'info', title: `New order ${evt.new.receipt}`, message: `${titleCase(evt.new.order_type)} just came in.`, duration: 9000, action: { label: 'View order', onClick: () => openDetail(evt.new.id) } });
    }
    if (evt.type === 'UPDATE') {
      setNavBadge('orders', rows.filter(isActive).length);
    }
  });
}

init();
