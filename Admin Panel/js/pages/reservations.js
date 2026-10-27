// js/pages/reservations.js — bookings by date with confirm / cancel.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listReservations, setReservationStatus } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, emptyState, esc, confirmDialog, stagger, reveal, skeleton } from '../utils/ui.js';
import { fmtDate, titleCase } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

const state = { date: new Date(), scope: 'day', status: '', q: '' };
let calMonth = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
let counts = {};

async function loadCounts() {
  const res = await listReservations({});
  counts = {};
  (res.data || []).forEach((r) => {
    if (r.status === 'cancelled') return;
    const c = counts[r.date] || { n: 0, guests: 0, pending: false };
    counts[r.date] = { n: c.n + 1, guests: c.guests + Number(r.guests || 0), pending: c.pending || r.status === 'pending' };
  });
  renderCal();
}

function renderCal() {
  const grid = $('calGrid');
  if (!grid) return;
  const todayKey = dateKey(new Date());
  const selKey = dateKey(state.date);
  const last = new Date(calMonth.getFullYear(), calMonth.getMonth() + 2, 1);
  $('calTitle').textContent = `${calMonth.toLocaleDateString('en-GB', { month: 'long' })} to ${last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`;
  let html = '';
  for (let k = 0; k < 3; k++) {
    const mo = new Date(calMonth.getFullYear(), calMonth.getMonth() + k, 1);
    const y = mo.getFullYear();
    const m = mo.getMonth();
    const lead = (mo.getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    let cells = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span class="cal-dow">${d}</span>`).join('') + '<span></span>'.repeat(lead);
    for (let d = 1; d <= days; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const c = counts[key];
      const lvl = c ? Math.min(c.n, 3) : 0;
      cells += `<button class="cal-day ${c ? `has h${lvl}` : ''} ${c && c.pending ? 'pend' : ''} ${key === todayKey ? 'today' : ''} ${key === selKey ? 'sel' : ''}" data-date="${key}" title="${c ? `${c.n} booking${c.n > 1 ? 's' : ''}, ${c.guests} guests` : 'No bookings'}">${d}</button>`;
    }
    html += `<div class="cal-month" style="--k:${k}"><h4>${mo.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h4><div class="cal-mgrid">${cells}</div></div>`;
  }
  grid.innerHTML = html;
}


function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function syncDate() {
  calMonth = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
  renderCal();
  $('dateLabel').textContent = fmtDate(state.date.toISOString(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  $('rDate').value = dateKey(state.date);
}

function card(r, i) {
  return `
  <article class="res-card" style="--i:${i}">
    <div class="res-top">
      <span class="res-name">${esc(r.name)}</span>
      <span class="badge st-${r.status}">${esc(titleCase(r.status))}</span>
    </div>
    <div class="res-meta">
      <span>${icon('clock')} <b>${esc(r.time)}</b></span>
      <span>${icon('user')} <b>${r.guests}</b> guests</span>
      <span>${icon('qr')} Table <b>${r.tables && r.tables.table_number ? r.tables.table_number : '—'}</b></span>
    </div>
    <div class="res-meta">
      <span>${icon('calendar')} <b>${esc(fmtDate(`${r.date}T00:00:00`))}</b></span>
      <span>${icon('phone')} <a href="tel:${esc(r.phone)}" style="color:var(--brand)">${esc(r.phone)}</a></span>
    </div>
    ${r.note ? `<div class="res-note">${esc(r.note)}</div>` : ''}
    <div class="res-actions">
      ${r.status === 'pending' ? `<button class="btn btn-success btn-xs" data-act="confirmed" data-id="${r.id}">${icon('check')} Confirm</button>` : ''}
      ${r.status !== 'cancelled' ? `<button class="btn btn-danger btn-xs" data-act="cancelled" data-id="${r.id}">${icon('x')} Cancel</button>` : ''}
      ${r.status === 'cancelled' ? `<button class="btn btn-soft btn-xs" data-act="pending" data-id="${r.id}">${icon('refresh')} Reopen</button>` : ''}
      <a class="btn btn-ghost btn-xs" href="tel:${esc(r.phone)}">${icon('phone')} Call guest</a>
    </div>
  </article>`;
}

async function load() {
  const host = $('resGrid');
  host.innerHTML = skeleton(6);
  const res = await listReservations({
    date: state.scope === 'day' ? dateKey(state.date) : '',
    status: state.status,
    q: state.q,
  });
  if (res.error) {
    toast({ type: 'error', title: 'Could not load reservations', message: res.error.message });
    return;
  }
  const rows = res.data.filter((r) => !state.q || r.name.toLowerCase().includes(state.q) || r.phone.includes(state.q));
  if (!rows.length) {
    host.innerHTML = emptyState({
      icon: 'calendar',
      title: state.scope === 'day' ? 'No bookings for this day' : 'No reservations found',
      hint: 'Reservations arrive from the customer website and land here as pending.',
    });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = rows.map(card).join('');
  hydrateIcons(host);
  stagger(host, 55);
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('reservations', session);
  hydrateIcons($('page'));
  syncDate();
  reveal();

  $('btnPrev').addEventListener('click', () => {
    state.date.setDate(state.date.getDate() - 1);
    syncDate();
    load();
  });
  $('btnNext').addEventListener('click', () => {
    state.date.setDate(state.date.getDate() + 1);
    syncDate();
    load();
  });
  $('btnToday').addEventListener('click', () => {
    state.date = new Date();
    state.scope = 'day';
    document.querySelectorAll('[data-scope]').forEach((c) => c.classList.toggle('on', c.dataset.scope === 'day'));
    syncDate();
    load();
  });
  $('rDate').addEventListener('change', (e) => {
    if (!e.target.value) return;
    state.date = new Date(`${e.target.value}T00:00:00`);
    syncDate();
    load();
  });
  $('rStatus').addEventListener('change', (e) => {
    state.status = e.target.value;
    load();
  });
  document.querySelectorAll('[data-scope]').forEach((c) =>
    c.addEventListener('click', () => {
      state.scope = c.dataset.scope;
      document.querySelectorAll('[data-scope]').forEach((x) => x.classList.toggle('on', x === c));
      load();
    })
  );
  let t;
  $('rSearch').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = e.target.value.trim().toLowerCase();
      load();
    }, 180);
  });

  $('resGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const status = btn.dataset.act;
    if (status === 'cancelled') {
      const yes = await confirmDialog({
        title: 'Cancel this reservation?',
        message: 'Call the guest first if you have not already. Cancelled bookings stay in the list for the day.',
        danger: true,
        confirmText: 'Cancel booking',
      });
      if (!yes) return;
    }
    const res = await setReservationStatus(btn.dataset.id, status);
    if (res.error) return toast({ type: 'error', title: 'Could not update', message: res.error.message });
    toast({ type: 'success', title: `Reservation ${status}` });
    load();
    loadCounts();
  });

  $('calPrev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCal(); });
  $('calNext').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCal(); });
  $('calGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-date]');
    if (!b) return;
    const [yy, mm, dd] = b.dataset.date.split('-').map(Number);
    state.date = new Date(yy, mm - 1, dd);
    state.scope = 'day';
    document.querySelectorAll('[data-scope]').forEach((x) => x.classList.toggle('on', x.dataset.scope === 'day'));
    syncDate();
    load().then(() => $('resGrid').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  });

  await load();
  loadCounts();
}

init();
