// js/utils/receipt.js — browser printing helpers (receipts, delivery slips, QR sheets).

export function printArea(element) {
  if (!element) return;
  const prev = document.querySelector('.print-area');
  prev?.classList.remove('print-area');
  element.classList.add('print-area');
  document.body.classList.add('printing');
  const cleanup = () => {
    document.body.classList.remove('printing');
    element.classList.remove('print-area');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => {
    window.print();
    setTimeout(cleanup, 800);
  }, 120);
}

export function receiptDocument({ settings, order, tableOrders = null }) {
  const s = settings || {};
  const lines = tableOrders || [order];
  const sub = lines.reduce((a, o) => a + (o.subtotal || 0), 0);
  const tax = lines.reduce((a, o) => a + (o.tax || 0), 0);
  const fee = lines.reduce((a, o) => a + (o.delivery_fee || 0), 0);
  const total = lines.reduce((a, o) => a + (o.total || 0), 0);
  const combined = Boolean(tableOrders);

  const rows = lines
    .flatMap((o) => o.items.map((it) => `<tr>
        <td>${escapeHtml(it.name)}</td>
        <td class="ta-r">${it.qty}</td>
        <td class="ta-r">${Number(it.price).toFixed(0)}</td>
        <td class="ta-r">${Number(it.line_total).toFixed(0)}</td>
      </tr>` + (combined ? `<tr class="rc-group"><td colspan="4">${escapeHtml(o.receipt)} · ${escapeHtml(o.order_type.replace('_', ' '))}</td></tr>` : '')))
    .join('');

  return `
  <div class="paper">
    <div class="paper-head">
      <div class="paper-mark">${escapeHtml((s.name || 'Khabar Golpo').slice(0, 1))}</div>
      <h2>${escapeHtml(s.name || 'Khabar Golpo')}</h2>
      <p>${escapeHtml(s.address || '')}</p>
      <p>${escapeHtml(s.phone || '')}${s.email ? ' · ' + escapeHtml(s.email) : ''}</p>
    </div>

    <div class="paper-meta">
      <div><span>Receipt</span><strong>${combined ? 'TABLE BILL' : escapeHtml(order.receipt)}</strong></div>
      <div><span>Date</span><strong>${combined ? new Date().toDateString() : fmt(order.created_at)}</strong></div>
      <div><span>Type</span><strong>${combined ? 'Combined' : escapeHtml(order.order_type.replace('_', ' '))}</strong></div>
      ${!combined && order.table_number ? `<div><span>Table</span><strong>#${escapeHtml(String(order.table_number))}</strong></div>` : ''}
      ${!combined && order.customer_name ? `<div><span>Customer</span><strong>${escapeHtml(order.customer_name)}</strong></div>` : ''}
      ${!combined && order.phone ? `<div><span>Phone</span><strong>${escapeHtml(order.phone)}</strong></div>` : ''}
      ${!combined && order.address ? `<div class="rc-span"><span>Address</span><strong>${escapeHtml(order.address)}</strong></div>` : ''}
      <div><span>Payment</span><strong>${escapeHtml(order.payment_status === 'paid' ? 'PAID (Cash)' : 'UNPAID')}</strong></div>
    </div>

    <table class="rc-table">
      <thead><tr><th>Item</th><th class="ta-r">Qty</th><th class="ta-r">Price</th><th class="ta-r">Total</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No items</td></tr>'}</tbody>
    </table>

    <div class="paper-totals">
      <div><span>Subtotal</span><b>${money(sub)}</b></div>
      <div><span>Tax${s.tax_rate ? ` (${s.tax_rate}%)` : ''}</span><b>${money(tax)}</b></div>
      ${fee ? `<div><span>Delivery fee</span><b>${money(fee)}</b></div>` : ''}
      <div class="grand"><span>Grand total</span><b>${money(total)}</b></div>
    </div>

    <div class="paper-foot">
      <p>Payment method: Cash${combined ? '' : ` · ${order.payment_status === 'paid' ? 'Received' : 'Due'}`}</p>
      <p class="paper-thanks">Thank you for eating with us!</p>
      <div class="paper-barcode"></div>
    </div>
  </div>`;
}

export function slipDocument({ settings, order }) {
  const s = settings || {};
  const rows = (order.items || [])
    .map(
      (it) => `<tr><td>${escapeHtml(it.name)}</td><td class="ta-r">${it.qty}</td><td class="ta-r">${Number(it.line_total).toFixed(0)}</td></tr>`
    )
    .join('');
  return `
  <div class="paper slip">
    <div class="paper-head">
      <div class="paper-mark">${escapeHtml((s.name || 'Khabar Golpo').slice(0, 1))}</div>
      <h2>Delivery Slip</h2>
      <p>${escapeHtml(s.name || 'Khabar Golpo')} · ${escapeHtml(s.phone || '')}</p>
    </div>
    <div class="slip-no"><span>Order</span><strong>${escapeHtml(order.receipt)}</strong></div>
    <div class="paper-meta">
      <div class="rc-span"><span>Customer</span><strong>${escapeHtml(order.customer_name || '')}</strong></div>
      <div><span>Phone</span><strong>${escapeHtml(order.phone || '')}</strong></div>
      <div class="rc-span"><span>Address</span><strong>${escapeHtml(order.address || '')}</strong></div>
      ${order.address_note ? `<div class="rc-span"><span>Landmark / note</span><strong>${escapeHtml(order.address_note)}</strong></div>` : ''}
      <div><span>Placed</span><strong>${fmt(order.created_at)}</strong></div>
    </div>
    <table class="rc-table">
      <thead><tr><th>Item</th><th class="ta-r">Qty</th><th class="ta-r">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="paper-totals">
      <div><span>Order total</span><b>${money(order.total)}</b></div>
      <div class="grand"><span>Collect cash</span><b>${money(order.total)}</b></div>
    </div>
    <div class="paper-foot"><p class="paper-thanks">Hand this slip to the delivery agency.</p></div>
  </div>`;
}

function money(n) {
  return `৳ ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
