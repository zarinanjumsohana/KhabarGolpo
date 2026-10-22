// js/pages/receipt.js — printable receipts + combined table bills.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listOrders, getTableBill, markTablePaid } from '../api/adminOrders.js';
import { listTables } from '../api/adminContent.js';
import { getSettings } from '../api/public.js';
import { receiptDocument, printArea } from '../utils/receipt.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, emptyState, esc, confirmDialog, skeleton } from '../utils/ui.js';
import { money, titleCase, fmtDateTime } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

let mode = 'single';
let rType = 'dine_in';
let settings = null;
let orders = [];
let tables = [];
let selectedReceipt = null;
let currentBill = null;

/* ------------------------------ picker ------------------------------ */
function renderPicker() {
  const host = $('pickerList');

  if (mode === 'table') {
    const withBills = tables.filter((t) => t.is_active);
    host.innerHTML = withBills
      .map(
        (t) => `
      <button class="pick-item" data-table="${t.id}">
        <span><span class="pi-id">Table ${t.table_number}</span><br><span class="pi-meta">${t.seats} seats</span></span>
        <span class="pi-meta" data-icon="chevronRight"></span>
      </button>`
      )
      .join('');
    hydrateIcons(host);
    return;
  }

  const q = $('rSearch').value.trim().toLowerCase();
  const pool = orders.filter((o) => o.order_type === rType);
  const filtered = q
    ? pool.filter(
        (o) =>
          o.receipt.toLowerCase().includes(q) ||
          String(o.table_number || '').includes(q) ||
          String(o.customer_name || '').toLowerCase().includes(q)
      )
    : pool;

  if (!filtered.length) {
    host.innerHTML = emptyState({ icon: 'receipt', title: 'No orders found' });
    hydrateIcons(host);
    return;
  }

  host.innerHTML = filtered
    .map(
      (o) => `
    <button class="pick-item ${o.receipt === selectedReceipt ? 'on' : ''}" data-receipt="${esc(o.receipt)}">
      <span>
        <span class="pi-id">${esc(o.receipt)}</span><br>
        <span class="pi-meta">${esc(titleCase(o.order_type))}${o.table_number ? ` · T${o.table_number}` : ''} · ${esc(fmtDateTime(o.created_at))}</span>
      </span>
      <span class="pi-meta">${money(o.total)}</span>
    </button>`
    )
    .join('');
}

function renderPaper(html) {
  $('stage').innerHTML = `<div class="paper-holder" style="width:100%;display:grid;place-items:center">${html}</div>`;
  hydrateIcons($('stage'));
}

async function showSingle(receipt) {
  selectedReceipt = receipt;
  const order = orders.find((o) => o.receipt === receipt);
  if (!order) {
    $('stage').innerHTML = emptyState({ icon: 'receipt', title: 'Pick an order', hint: 'Choose a receipt on the left to preview and print it.' });
    hydrateIcons($('stage'));
    return;
  }
  renderPaper(receiptDocument({ settings, order }));
}

async function showTableBill(tableId) {
  const res = await getTableBill(tableId);
  const tbl = tables.find((t) => t.id === tableId);
  if (res.error) {
    currentBill = null;
    const lastPaid = orders
      .filter((o) => o.order_type === 'dine_in' && o.table_number === tbl?.table_number && o.payment_status === 'paid')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    $('stage').innerHTML = emptyState({
      icon: 'check',
      title: `Table ${tbl?.table_number ?? ''}: all bills paid`,
      hint: lastPaid ? `Last bill ${money(lastPaid.total)} · ${lastPaid.receipt} · PAID. Nothing is waiting on this table.` : 'No bill has been recorded for this table yet.',
    });
    if (lastPaid) $('stage').insertAdjacentHTML('beforeend', `<div class="no-print" style="text-align:center;margin-top:14px"><span class="badge st-paid">Paid</span> <a class="btn btn-ghost btn-sm" href="./receipt.html?receipt=${encodeURIComponent(lastPaid.receipt)}">Open last receipt</a></div>`);
    hydrateIcons($('stage'));
    return;
  }
  currentBill = res.data;
  renderPaper(
    receiptDocument({ settings, order: res.data.orders[0], tableOrders: res.data.orders }) +
      `<div class="no-print" style="margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <span class="pill">${res.data.orders.length} unpaid order${res.data.orders.length === 1 ? '' : 's'} · ${money(res.data.total)}</span>
        <button class="btn btn-success btn-sm" id="btnTablePaid">${icon('wallet')}<span>Mark table paid</span></button>
      </div>`
  );
  hydrateIcons($('stage'));
  document.getElementById('btnTablePaid')?.addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: `Close Table ${tbl?.table_number} bill?`,
      message: `All ${res.data.orders.length} unpaid orders (${money(res.data.total)}) will be recorded as paid cash.`,
      confirmText: 'Mark table paid',
      icon: 'wallet',
    });
    if (!yes) return;
    const out = await markTablePaid(tableId);
    if (out.error) {
      toast({ type: 'error', title: 'Could not close bill', message: out.error.message });
      return;
    }
    toast({ type: 'success', title: 'Table bill paid', message: `${money(res.data.total)} recorded in revenue.` });
    currentBill = null;
    await refresh();
    showTableBill(tableId);
  });
}

/* ------------------------------ modes ------------------------------ */
function setMode(next) {
  mode = next;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  moveSeg();
  $('wrapSearch').style.display = mode === 'single' ? '' : 'none';
  $('rTypeTabs').style.display = mode === 'single' ? '' : 'none';
  $('tableChips').style.display = mode === 'single' ? 'none' : '';
  if (mode === 'table') {
    $('stage').innerHTML = emptyState({ icon: 'table', title: 'Pick a table', hint: 'Show every unpaid dine-in order for one table on a single bill.' });
    hydrateIcons($('stage'));
  } else {
    showSingle(selectedReceipt);
  }
  renderPicker();
}

function moveSeg() {
  const seg = $('modeSeg');
  const active = seg.querySelector('button.on');
  const ind = $('segInd');
  if (!active) return;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

async function refresh() {
  const [ordersRes, tablesRes, settingsRes] = await Promise.all([
    listOrders({ page: 1, perPage: 60 }),
    listTables(),
    getSettings(),
  ]);
  if (ordersRes.error) {
    toast({ type: 'error', title: 'Could not load orders', message: ordersRes.error.message });
    return;
  }
  orders = ordersRes.data.rows;
  tables = tablesRes.data || [];
  settings = settingsRes.data || {};
  renderPicker();
}

async function init() {
  document.querySelectorAll('[data-rtype]').forEach((b) =>
    b.addEventListener('click', () => {
      rType = b.dataset.rtype;
      document.querySelectorAll('[data-rtype]').forEach((x) => x.classList.toggle('on', x === b));
      renderPicker();
    })
  );
  const session = await requireAdmin();
  if (!session) return;
  initShell('receipt', session);
  hydrateIcons($('page'));

  $('pickerList').innerHTML = skeleton(6);

  const params = new URLSearchParams(location.search);
  selectedReceipt = params.get('receipt');

  document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('btnPrint').addEventListener('click', () => {
    const paper = document.querySelector('#stage .paper');
    if (!paper) {
      toast({ type: 'warning', title: 'Nothing to print', message: 'Choose a receipt or a table bill first.' });
      return;
    }
    printArea(paper);
  });

  let t;
  $('rSearch').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(renderPicker, 180);
  });

  $('pickerList').addEventListener('click', async (e) => {
    const single = e.target.closest('[data-receipt]');
    if (single) {
      renderPicker();
      showSingle(single.dataset.receipt);
      return;
    }
    const tbl = e.target.closest('[data-table]');
    if (tbl) {
      document.querySelectorAll('[data-table]').forEach((el) => el.classList.remove('on'));
      tbl.classList.add('on');
      showTableBill(tbl.dataset.table);
    }
  });

  await refresh();
  moveSeg();
  window.addEventListener('resize', moveSeg);

  if (selectedReceipt) showSingle(selectedReceipt);
  else {
    $('stage').innerHTML = emptyState({ icon: 'receipt', title: 'Pick an order', hint: 'Choose a receipt on the left to preview and print it.' });
    hydrateIcons($('stage'));
  }
}

init();
