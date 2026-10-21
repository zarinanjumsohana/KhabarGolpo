// js/pages/dashboard.js — revenue, live queue and analytics overview.

import { requireAdmin, saveLocalSession, login } from '../utils/guards.js';
import { isMock } from '../config.js';
import { initShell, setNavBadge } from './shell.js';
import { revenueSummary, salesReport } from '../api/reports.js';
import { listOrders, subscribeOrders } from '../api/adminOrders.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { countUp, stagger, reveal, setupTilt, toast, emptyState, esc } from '../utils/ui.js';
import { money, num, titleCase, relTime } from '../utils/format.js';

const $ = (id) => document.getElementById(id);
const DAY = 86400000;

const STATUS_META = [
  ['new', 'New', 'var(--st-new-fg)'],
  ['preparing', 'Preparing', 'var(--st-prep-fg)'],
  ['ready', 'Ready', 'var(--st-ready-fg)'],
  ['out_for_delivery', 'Out for delivery', 'var(--st-out-fg)'],
  ['completed', 'Completed', 'var(--st-done-fg)'],
  ['cancelled', 'Cancelled', 'var(--st-cancel-fg)'],
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function niceMax(v) {
  if (v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/* ---------------- modern glowing line chart ---------------- */
function drawLineChart(series) {
  const host = $('revChart');
  if (!host) return;
  if (!series.length) {
    host.innerHTML = emptyState({ icon: 'chart', title: 'No revenue yet' });
    hydrateIcons(host);
    return;
  }

  const W = 780;
  const H = 250;
  const padL = 60;
  const padR = 20;
  const padT = 20;
  const padB = 40;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const n = series.length;
  const max = niceMax(Math.max(...series.map((s) => s.value), 0));
  const X = (i) => padL + (iw * i) / Math.max(n - 1, 1);
  const Y = (v) => padT + ih - (v / max) * ih;
  const pts = series.map((s, i) => [X(i), Y(s.value)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${pts[n - 1][0].toFixed(1)},${(padT + ih).toFixed(1)} L${pts[0][0].toFixed(1)},${(padT + ih).toFixed(1)} Z`;

  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  len = Math.ceil(len) + 20;

  const grids = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = (padT + ih - f * ih).toFixed(1);
      return `<line x1="${padL}" x2="${(padL + iw).toFixed(1)}" y1="${y}" y2="${y}"/>`;
    })
    .join('');

  const takaLabel = (v) => `৳${v >= 1000 ? `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : v}`;
  const yLabels = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = (padT + ih - f * ih).toFixed(1);
      const val = Math.round(max * f);
      return `<text x="${padL - 10}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${takaLabel(val)}</text>`;
    })
    .join('');

  const xLabels = series
    .map((s, i) => {
      return `<text x="${X(i).toFixed(1)}" y="${H - 12}" text-anchor="middle">${esc(s.label)}</text>`;
    })
    .join('');

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Revenue trend for the last 14 days">
      <defs>
        <linearGradient id="revAreaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(217,84,43,.34)"/>
          <stop offset="0.55" stop-color="rgba(217,84,43,.10)"/>
          <stop offset="1" stop-color="rgba(217,84,43,0)"/>
        </linearGradient>
        <linearGradient id="revLineStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f0a500"/><stop offset="1" stop-color="#d9542b"/>
        </linearGradient>
      </defs>
      <g class="lc-grid">${grids}</g>
      <g class="lc-axis">${yLabels}${xLabels}</g>
      <path class="lc-area" d="${area}" fill="url(#revAreaFill)"/>
      <path class="lc-glow" d="${line}" stroke="url(#revLineStroke)"/>
      <path class="lc-line" d="${line}" stroke="url(#revLineStroke)" style="--len:${len}"/>
      <line class="lc-guide" x1="0" x2="0" y1="${padT}" y2="${(padT + ih).toFixed(1)}"/>
      <circle class="lc-focus" r="5.5" cx="0" cy="0" fill="#fffdf9" stroke="#d9542b" stroke-width="3"/>
    </svg>
    <div class="lc-labels"><span>14 days ago</span><span>Today</span></div>
    <div class="chart-tip" id="revTip"></div>`;

  const svg = host.querySelector('svg');
  const guide = host.querySelector('.lc-guide');
  const focus = host.querySelector('.lc-focus');
  const tip = host.querySelector('.chart-tip');
  const dateFor = (i) => new Date(Date.now() - (n - 1 - i) * DAY).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

  let raf = 0;
  let idx = -1;
  const paint = () => {
    raf = 0;
    if (!svg) return;
    const sr = svg.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    if (!sr.width) return;
    const sx = sr.width / W;
    const sy = sr.height / H;
    const p = pts[idx];
    guide.setAttribute('x1', p[0].toFixed(1));
    guide.setAttribute('x2', p[0].toFixed(1));
    guide.style.opacity = '1';
    focus.setAttribute('cx', p[0].toFixed(1));
    focus.setAttribute('cy', p[1].toFixed(1));
    focus.style.opacity = '1';
    tip.style.left = `${sr.left - hr.left + p[0] * sx}px`;
    tip.style.top = `${sr.top - hr.top + p[1] * sy}px`;
    tip.innerHTML = `<b>${money(series[idx].value)}</b><span>${dateFor(idx)} · revenue</span>`;
    tip.classList.add('on');
  };

  const onMove = (e) => {
    const sr = svg.getBoundingClientRect();
    if (!sr.width) return;
    const sx = W / sr.width;
    const px = (e.clientX - sr.left) * sx;
    idx = Math.round(((px - padL) / iw) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const onLeave = () => {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    guide.style.opacity = '0';
    focus.style.opacity = '0';
    tip.classList.remove('on');
  };

  host.onpointermove = onMove;
  host.onpointerleave = onLeave;
  host.onpointerdown = onMove;
}

/* ---------------- 7-day column chart ---------------- */
const pad2 = (n) => String(n).padStart(2, '0');
const dayKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function lastSevenDays(rows) {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = dayKeyOf(d);
    const row = byKey.get(key) || { key, orders: 0, revenue: 0 };
    out.push({ ...row, label: `${pad2(d.getDate())} ${d.toLocaleString('en-GB', { month: 'short' })}`, wd: i === 0 ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short' }) });
  }
  return out;
}

function renderWeekBars(rows) {
  const host = $('weekBars');
  if (!host) return;
  if (!rows.length) {
    host.innerHTML = '';
    return;
  }
  const max = Math.max(...rows.map((r) => r.orders), 1);
  const total = rows.reduce((a, r) => a + r.orders, 0);
  const badge = $('weekTotal');
  if (badge) badge.textContent = `${num(total)} orders`;
  host.innerHTML = rows
    .map((r, i) => {
      const isToday = i === rows.length - 1;
      const pct = Math.max(Math.round((r.orders / max) * 100), r.orders ? 6 : 0);
      return `<div class="dbar ${r.orders ? '' : 'is-zero'} ${isToday ? 'is-today' : ''}" style="--i:${i}" title="${esc(r.label)} · ${num(r.orders)} orders">
        <span class="dv">${num(r.orders)}</span>
        <span class="col" style="height:${pct}%"></span>
        <span class="dl">${esc(r.wd)}<small>${esc(r.label)}</small></span>
      </div>`;
    })
    .join('');
}

/* ---------------- order status donut ---------------- */
function renderDonut(counts) {
  const host = $('statusDonut');
  if (!host) return;
  const rows = STATUS_META.map(([key, label, color]) => ({ key, label, color, value: counts[key] || 0 })).filter((r) => r.value > 0);
  const total = rows.reduce((a, r) => a + r.value, 0);

  if (!total) {
    host.innerHTML = emptyState({ icon: 'inbox', title: 'No orders yet' });
    hydrateIcons(host);
    return;
  }

  const R = 72;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;
  const arcs = rows
    .map((r) => {
      const frac = r.value / total;
      const dash = Math.max(frac * CIRC - 3, 0.5);
      const arc = `<circle class="seg-arc" cx="93" cy="93" r="${R}" fill="none" style="stroke:${r.color}"
        stroke-width="22" stroke-linecap="round"
        stroke-dasharray="${dash.toFixed(2)} ${(CIRC - dash).toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"><title>${esc(r.label)}: ${num(r.value)}</title></circle>`;
      offset += frac * CIRC;
      return arc;
    })
    .join('');

  host.innerHTML = `
    <div class="donut-wrap">
      <div class="donut">
        <svg viewBox="0 0 186 186" role="img" aria-label="Order status distribution">
          <circle class="ring-bg" cx="93" cy="93" r="${R}" fill="none" stroke-width="22"/>
          ${arcs}
        </svg>
        <div class="donut-center"><b>${num(total)}</b><span>Orders</span></div>
      </div>
      <div class="legend">
        ${rows
          .map(
            (r) => `<div class="legend-row">
              <span class="legend-dot" style="background:${r.color}"></span>
              <span class="legend-label">${esc(r.label)}</span>
              <span class="legend-val">${num(r.value)}</span>
            </div>`
          )
          .join('')}
      </div>
    </div>`;
}

/* ---------------- lists ---------------- */
function renderRecent(rows) {
  const host = $('recentList');
  if (!rows.length) {
    host.innerHTML = emptyState({ icon: 'inbox', title: 'No orders yet', hint: 'New orders appear here within seconds.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = rows
    .map(
      (o, i) => `
    <div class="mini-order" style="animation-delay:${i * 60}ms">
      <span class="mo-ic" data-icon="${o.order_type === 'delivery' ? 'truck' : o.order_type === 'pickup' ? 'bag' : 'table'}"></span>
      <span class="mo-body">
        <span class="mo-receipt">${esc(o.receipt)}</span>
        <span class="mo-meta">${esc(titleCase(o.order_type))}${o.table_number ? ` · Table ${o.table_number}` : ''} · ${esc(relTime(o.created_at))}</span>
      </span>
      <span class="mo-amt">${money(o.total)}</span>
      <span class="badge st-${o.status}">${esc(titleCase(o.status))}</span>
    </div>`
    )
    .join('');
  hydrateIcons(host);
}

function renderTop(items) {
  const host = $('topItems');
  if (!items.length) {
    host.innerHTML = emptyState({ icon: 'chart', title: 'No sales in this window' });
    hydrateIcons(host);
    return;
  }
  const max = Math.max(...items.map((i) => i.qty), 1);
  host.innerHTML = items
    .map(
      (it, i) => `
    <div class="rank-row">
      <span class="rank-no">${i + 1}</span>
      <span>
        <span class="rank-name">${esc(it.name)}</span>
        <span class="rank-bar"><i class="bar-wide" style="--i:${i};width:${Math.round((it.qty / max) * 100)}%"></i></span>
      </span>
      <span class="rank-qty">×${num(it.qty)}</span>
    </div>`
    )
    .join('');
}

function renderTypes(counts) {
  const host = $('typeBars');
  const total = Math.max((counts.dine_in || 0) + (counts.pickup || 0) + (counts.delivery || 0), 1);
  const rows = [
    ['dine_in', 'Dine-in', counts.dine_in || 0],
    ['pickup', 'Pickup', counts.pickup || 0],
    ['delivery', 'Delivery', counts.delivery || 0],
  ];
  host.innerHTML = rows
    .map(
      ([cls, label, n], i) => `
    <div class="type-bar-row type-${cls}">
      <div class="type-bar-top"><b>${label}</b><span>${n} order${n === 1 ? '' : 's'} · ${Math.round((n / total) * 100)}%</span></div>
      <div class="type-bar-track"><i class="bar-wide" style="--i:${i};width:${Math.round((n / total) * 100)}%"></i></div>
    </div>`
    )
    .join('');
}


/* ---------------- Order value today: three channels flow into one ring ---------------- */
function drawFlow(orders) {
  const today = dayKeyOf(new Date());
  const live = orders.filter((o) => o.status !== 'cancelled' && dayKeyOf(new Date(o.created_at)) === today);
  const types = [['dine_in', 'Dine-in', '#f0a500'], ['pickup', 'Pickup', '#d9542b'], ['delivery', 'Delivery', '#38b2ac']];
  const g = {};
  types.forEach(([k]) => {
    const l = live.filter((o) => o.order_type === k);
    g[k] = { n: l.length, v: l.reduce((s, o) => s + Number(o.total || 0), 0) };
  });
  const total = types.reduce((s, [k]) => s + g[k].v, 0);
  const chips = $('flowChips');
  const svg = $('flowSvg');
  chips.replaceChildren();
  svg.replaceChildren();
  const NS = 'http://www.w3.org/2000/svg';
  const ys = [38, 128, 218];
  types.forEach(([k, label, color], i) => {
    const row = document.createElement('div');
    row.className = 'flow-chip';
    row.style.setProperty('--c', color);
    const pct = total ? Math.round((g[k].v / total) * 100) : 0;
    row.innerHTML = `<i class="fc-dot"></i><div><b>${label}</b><span>${g[k].n} order${g[k].n === 1 ? '' : 's'}</span></div><div class="fc-amt"><strong>${money(g[k].v)}</strong><em class="fc-pct">${pct}%</em></div>`;
    chips.appendChild(row);
    const d = `M0,${ys[i]} C170,${ys[i]} 230,128 400,128`;
    const line = document.createElementNS(NS, 'path');
    line.setAttribute('d', d); line.setAttribute('fill', 'none'); line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', 3); line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('opacity', g[k].n ? '.9' : '.35');
    const glow = line.cloneNode();
    glow.setAttribute('stroke-width', 10); glow.setAttribute('opacity', g[k].n ? '.14' : '.05');
    svg.append(glow, line);
    if (g[k].n) {
      const pulse = document.createElementNS(NS, 'path');
      pulse.setAttribute('d', d); pulse.setAttribute('pathLength', '100'); pulse.setAttribute('fill', 'none');
      pulse.setAttribute('stroke', '#fff'); pulse.setAttribute('stroke-width', '3'); pulse.setAttribute('stroke-linecap', 'round');
      pulse.setAttribute('class', 'flow-pulse'); pulse.style.animationDelay = `${i * 0.7}s`;
      svg.appendChild(pulse);
    }
  });
  let at = 0;
  const stops = types.map(([k, , color]) => {
    const share = total ? (g[k].v / total) * 100 : 0;
    const s = `${color} ${at}% ${at + share}%`;
    at += share;
    return s;
  });
  $('flowRing').style.setProperty('--arcs', total ? stops.join(',') : 'rgba(128,128,128,.25) 0 100%');
  $('flowTotal').textContent = money(total);
  $('flowOrders').textContent = `${live.length} order${live.length === 1 ? '' : 's'}`;
  const yk = dayKeyOf(new Date(Date.now() - 864e5));
  const yTotal = orders.filter((o) => o.status !== 'cancelled' && dayKeyOf(new Date(o.created_at)) === yk).reduce((s, o) => s + Number(o.total || 0), 0);
  const dl = $('flowDelta');
  if (yTotal) {
    const p = Math.round(((total - yTotal) / yTotal) * 100);
    dl.textContent = `${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}% vs yesterday`;
    dl.className = `flow-delta ${p >= 0 ? 'up' : 'down'}`;
  } else { dl.textContent = 'No orders yesterday'; dl.className = 'flow-delta'; }
}

/* ---------------- KPI trend chips ---------------- */
function trendChip(el, now, prev) {
  if (!el) return;
  if (!prev || !now) {
    el.hidden = true;
    return;
  }
  const pct = Math.round(((now - prev) / prev) * 100);
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  el.hidden = false;
  el.className = `stat-trend ${dir}`;
  el.innerHTML = `${icon(dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'activity', '')}<span>${pct > 0 ? '+' : ''}${pct}%</span>`;
}

/* ---------------- auto-sign-in (mock only) ---------------- */
async function autoSignIn() {
  if (!isMock()) return null;
  const DEMO = {
    'admin@khabargolpo.com': { password: 'admin123', role: 'admin', name: 'Khabar Golpo Admin' },
  };
  const email = 'admin@khabargolpo.com';
  const password = 'admin123';
  const res = await login({ email, password });
  if (!res.error && res.data.role === 'admin') {
    saveLocalSession(res.data);
    return res.data;
  }
  return null;
}

/* ---------------- load ---------------- */
async function load() {
  const [sumRes, salesRes, ordersRes] = await Promise.all([
    revenueSummary(),
    salesReport({ group: 'daily' }),
    listOrders({ perPage: 500, page: 1 }),
  ]);

  if (sumRes.error) {
    toast({ type: 'error', title: 'Could not load dashboard', message: sumRes.error.message });
    return;
  }
  const s = sumRes.data;
  const rows = salesRes.error ? [] : salesRes.data.rows || [];
  const orders = ordersRes.error ? [] : ordersRes.data.rows || [];

  const pw = (id, d) => {
    countUp($(id), d.revenue, { prefix: '৳ ' });
    $(id + 'Sub').textContent = `${num(d.orders || 0)} paid orders`;
  };
  pw('pWeek', s.week);
  pw('pMonth', s.month);
  pw('pYear', s.year);
  const best = s.topItems[0];
  $('pBest').textContent = best ? best.name : '—';
  $('pBestSub').textContent = best ? `${num(best.qty)} sold in 7 days` : 'No sales yet';

  drawFlow(orders);
  drawLineChart(s.series);
  renderDonut(
    STATUS_META.reduce((acc, [key]) => {
      acc[key] = orders.filter((o) => o.status === key && dayKeyOf(new Date(o.created_at)) === dayKeyOf(new Date())).length;
      return acc;
    }, {})
  );
  renderRecent(s.recent);
  renderTop(s.topItems);
  hydrateIcons($('page'));
  setNavBadge('orders', s.pending);
}

async function init() {
  let session = await requireAdmin();
  if (!session) {
    session = await autoSignIn();
    if (session) {
      $('greeting').innerHTML = `${greeting()}, <em>Admin</em>.`;
      $('pageDesc').textContent = `Live view of ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} — revenue, queue and best sellers.`;
    }
  }
  if (!session) return;

  $('greeting').innerHTML = `${greeting()}, <em>Admin</em>.`;
  $('pageDesc').textContent = `Live view of ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} — revenue, queue and best sellers.`;

  initShell('dashboard', session);
  hydrateIcons($('page'));
  stagger($('kpis'));
  reveal();
  setupTilt($('page'));

  await load();

  $('btnRefresh').addEventListener('click', async () => {
    await load();
    setupTilt($('page'));
    toast({ type: 'success', title: 'Refreshed', message: 'Dashboard numbers are up to date.' });
  });

  let cool = 0;
  subscribeOrders((evt) => {
    if (evt.type === 'INSERT' && Date.now() - cool > 4000) {
      cool = Date.now();
      toast({ type: 'info', title: `New order ${evt.new.receipt}`, message: `${titleCase(evt.new.order_type)} · ${money(evt.new.total)}`, duration: 9000, action: { label: 'View order', href: `./orders.html?receipt=${encodeURIComponent(evt.new.receipt)}` } });
    }
    load();
  });
}

init();
