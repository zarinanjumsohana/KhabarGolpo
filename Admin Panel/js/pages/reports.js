// js/pages/reports.js — sales report with animated bars, donut and CSV export.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { salesReport, reportRange } from '../api/reports.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, countUp, stagger, reveal, skeleton, esc } from '../utils/ui.js';
import { money, num } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

const state = { group: 'daily', from: null, to: null };
let report = null;

const TYPE_META = {
  dine_in: { label: 'Dine-in', color: 'var(--brand)' },
  pickup: { label: 'Pickup', color: '#f0a500' },
  delivery: { label: 'Delivery', color: '#2f7d64' },
};

function moveSeg() {
  const seg = $('groupSeg');
  const active = seg.querySelector('button.on');
  const ind = $('segInd');
  if (!active) return;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

function renderKpis(r) {
  const t = r.totals;
  countUp($('rRevenue'), t.revenue, { prefix: '৳ ' });
  countUp($('rOrders'), t.orders, {});
  countUp($('rAvg'), t.avg_ticket, { prefix: '৳ ' });
  countUp($('rFees'), t.delivery_fees, { prefix: '৳ ' });
  $('rRevenueSub').textContent = `${num(t.paid_orders)} paid · ${num(t.tax)} tax collected`;
  $('rOrdersSub').textContent = `${num(r.rows.length)} periods in range`;
  $('rangePill').textContent = r.rows.length ? `${r.rows[0].label} → ${r.rows[r.rows.length - 1].label}` : 'No data';
  $('chartHint').textContent = `${state.group} buckets · paid revenue in ৳`;
}

function renderBars(r) {
  const host = $('bars');
  const chart = r.chart.filter((c) => c.value > 0);
  if (!chart.length) {
    host.innerHTML = `<div class="bars-empty">No paid orders in this range yet.</div>`;
    return;
  }
  const max = Math.max(...chart.map((c) => c.value), 1);
  host.innerHTML = chart
    .map((c, i) => {
      const pct = Math.max(6, Math.round((c.value / max) * 100));
      return `<div class="bar-col" style="--i:${i}" title="${esc(c.label)} · ${money(c.value)}">
        <span class="bar-val">${money(c.value)}</span>
        <span class="bar" style="height:${pct}%"></span>
        <span class="bar-label">${esc(c.label)}</span>
      </div>`;
    })
    .join('');
}

function renderDonut(r) {
  const host = $('donut');
  const legend = $('legend');
  const entries = Object.entries(r.byType).filter(([, v]) => v > 0);
  const total = entries.reduce((a, [, v]) => a + v, 0);

  if (!total) {
    host.innerHTML = `<div class="donut-empty">—</div>`;
    legend.innerHTML = `<p class="small muted">No paid orders in this range.</p>`;
    return;
  }

  const R = 70;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = entries
    .map(([type, value]) => {
      const frac = value / total;
      const len = frac * C;
      const dash = `stroke-dasharray:0 ${C};stroke-dashoffset:${-acc}`;
      acc += len;
      const meta = TYPE_META[type] || { color: 'var(--ink-soft)' };
      return `<circle class="donut-arc" r="${R}" cx="95" cy="95" fill="none" stroke="${meta.color}"
        stroke-width="26" stroke-linecap="butt" data-len="${len}" data-circ="${C}"
        style="${dash}" />`;
    })
    .join('');

  host.innerHTML = `
    <svg viewBox="0 0 190 190" width="190" height="190" role="img" aria-label="Sales by order type">
      <circle r="${R}" cx="95" cy="95" fill="none" stroke="var(--line)" stroke-width="26" />
      ${arcs}
    </svg>
    <div class="donut-center"><b>${money(total)}</b><span>paid revenue</span></div>`;

  requestAnimationFrame(() => {
    host.querySelectorAll('.donut-arc').forEach((el, i) => {
      const len = Number(el.dataset.len);
      const circ = Number(el.dataset.circ);
      el.style.transition = `stroke-dasharray .9s cubic-bezier(.22,1,.36,1) ${0.12 + i * 0.14}s`;
      el.style.strokeDasharray = `${len} ${circ - len}`;
    });
  });

  legend.innerHTML = entries
    .map(([type, value]) => {
      const meta = TYPE_META[type] || { label: type, color: 'var(--ink-soft)' };
      const pct = Math.round((value / total) * 100);
      return `<div class="legend-row">
        <span class="legend-dot" style="background:${meta.color}"></span>
        <span class="legend-label">${meta.label}</span>
        <span class="legend-val">${money(value)} · <b>${pct}%</b></span>
      </div>`;
    })
    .join('') + `<p class="xsmall muted">Delivery fees collected: ${money(r.delivery_fee_total)} (not added to totals).</p>`;
}

function renderTop(r) {
  const host = $('topList');
  if (!r.topItems.length) {
    host.innerHTML = `<p class="small muted">Nothing sold yet in this range.</p>`;
    return;
  }
  const max = r.topItems[0].qty || 1;
  host.innerHTML = r.topItems
    .map(
      (it, i) => `
      <div class="top-row" style="--i:${i}">
        <span class="top-rank">${i + 1}</span>
        <div class="top-main">
          <div class="top-name">${esc(it.name)}</div>
          <div class="top-track"><span class="top-bar" style="width:${Math.max(6, (it.qty / max) * 100)}%"></span></div>
        </div>
        <div class="top-nums"><b>${num(it.qty)}</b><span class="xsmall muted">${money(it.revenue)}</span></div>
      </div>`
    )
    .join('');
}

function renderRows(r) {
  const body = $('rowsBody');
  if (!r.rows.length) {
    body.innerHTML = `<tr><td colspan="5" class="ta-c muted">No data for this range.</td></tr>`;
    return;
  }
  body.innerHTML = [...r.rows]
    .reverse()
    .map(
      (row, i) => `
      <tr style="--i:${i}">
        <td class="fw-500">${esc(row.label)}</td>
        <td class="ta-r">${num(row.orders)}</td>
        <td class="ta-r">${money(row.revenue)}</td>
        <td class="ta-r">${money(row.delivery_fees)}</td>
        <td class="ta-r">${money(row.tax)}</td>
      </tr>`
    )
    .join('');
}

function exportCsv() {
  if (!report) return;
  const head = ['Period', 'Orders', 'Paid revenue (BDT)', 'Delivery fees (BDT)', 'Tax (BDT)'];
  const lines = [head.join(',')].concat(
    report.rows.map((row) =>
      [row.label, row.orders, row.revenue, row.delivery_fees, row.tax]
        .map((v) => {
          const s = String(v ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `khabar-golpo-${state.group}-sales.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  toast({ type: 'success', title: 'CSV exported', message: `${report.rows.length} periods saved to your downloads.` });
}

async function load() {
  const bars = $('bars');
  if (!bars.dataset.loaded) {
    $('repKpis').classList.add('is-loading');
    $('rowsBody').innerHTML = skeleton(5);
  }
  const res = await salesReport({ group: state.group, from: state.from, to: state.to });
  $('repKpis').classList.remove('is-loading');
  if (res.error) {
    toast({ type: 'error', title: 'Could not load report', message: res.error.message });
    return;
  }
  report = res.data;
  renderKpis(report);
  renderBars(report);
  renderDonut(report);
  renderTop(report);
  renderRows(report);
  stagger($('bars'), 45);
  bars.dataset.loaded = '1';
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('reports', session);
  hydrateIcons($('page'));
  moveSeg();
  reveal();
  window.addEventListener('resize', moveSeg);

  /* Date window: prefill with a sensible range for the current grouping. */
  const applyRange = () => {
    const r = reportRange(state.group);
    state.from = r.from;
    state.to = r.to;
    if ($('repFrom')) $('repFrom').value = r.from;
    if ($('repTo')) $('repTo').value = r.to;
  };
  applyRange();

  ['repFrom', 'repTo'].forEach((id) => {
    const input = $(id);
    if (!input) return;
    input.addEventListener('change', async () => {
      state.from = $('repFrom').value || null;
      state.to = $('repTo').value || null;
      await load();
    });
  });

  document.querySelectorAll('[data-group]').forEach((b) =>
    b.addEventListener('click', async () => {
      state.group = b.dataset.group;
      document.querySelectorAll('[data-group]').forEach((x) => x.classList.toggle('on', x === b));
      moveSeg();
      applyRange();
      await load();
    })
  );
  $('btnCsv').addEventListener('click', exportCsv);

  await load();
}

init();
