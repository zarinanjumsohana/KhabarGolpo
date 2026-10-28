// js/pages/reservations.js — bookings by date with confirm / cancel.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listReservations, setReservationStatus } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, emptyState, esc, confirmDialog, stagger, reveal, skeleton, openModal } from '../utils/ui.js';
import { fmtDate, titleCase } from '../utils/format.js';
import {
  extractReservationEmail,
  cleanReservationNote,
  sendReservationConfirmation,
  getEmailConfig,
  saveEmailConfig,
} from '../utils/emailService.js';

const $ = (id) => document.getElementById(id);

const state = { date: new Date(), scope: 'day', status: '', q: '' };
let calMonth = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
let counts = {};
let currentList = [];

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
  const email = extractReservationEmail(r);
  const note = cleanReservationNote(r);
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
      ${email ? `<span>${icon('mail')} <a href="mailto:${esc(email)}" style="color:var(--brand)">${esc(email)}</a></span>` : ''}
    </div>
    ${note ? `<div class="res-note">${esc(note)}</div>` : ''}
    <div class="res-actions">
      ${r.status === 'pending' ? `<button class="btn btn-success btn-xs" data-act="confirmed" data-id="${r.id}">${icon('check')} Confirm</button>` : ''}
      ${r.status !== 'cancelled' ? `<button class="btn btn-danger btn-xs" data-act="cancelled" data-id="${r.id}">${icon('x')} Cancel</button>` : ''}
      ${r.status === 'cancelled' ? `<button class="btn btn-soft btn-xs" data-act="pending" data-id="${r.id}">${icon('refresh')} Reopen</button>` : ''}
      <a class="btn btn-ghost btn-xs" href="tel:${esc(r.phone)}">${icon('phone')} Call</a>
      ${email ? `<button class="btn btn-ghost btn-xs" data-act="email" data-id="${r.id}">${icon('mail')} Email</button>` : ''}
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
  currentList = res.data || [];
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
    if (status === 'email') {
      const targetRes = currentList.find((x) => x.id === btn.dataset.id);
      if (!targetRes) return;
      const r = await sendReservationConfirmation(targetRes);
      if (r.ok) {
        toast({ type: 'success', title: 'Email confirmation', message: `Confirmation ready for ${r.email}` });
      } else {
        toast({ type: 'error', title: 'Email failed', message: r.message || 'No email found' });
      }
      return;
    }
    if (status === 'cancelled') {
      const yes = await confirmDialog({
        title: 'Cancel this reservation?',
        message: 'Call the guest first if you have not already. Cancelled bookings stay in the list for the day.',
        danger: true,
        confirmText: 'Cancel booking',
      });
      if (!yes) return;
    }
    const targetRes = currentList.find((x) => x.id === btn.dataset.id);
    const res = await setReservationStatus(btn.dataset.id, status);
    if (res.error) return toast({ type: 'error', title: 'Could not update', message: res.error.message });
    if (status === 'confirmed' && targetRes) {
      const email = extractReservationEmail(targetRes);
      if (email) {
        const emailRes = await sendReservationConfirmation(targetRes);
        if (emailRes.method === 'emailjs' || emailRes.method === 'webhook') {
          toast({ type: 'success', title: 'Reservation confirmed', message: `Email sent to ${email}` });
        } else {
          toast({ type: 'success', title: 'Reservation confirmed', message: `Email confirmation ready for ${email}` });
        }
      } else {
        toast({ type: 'success', title: 'Reservation confirmed' });
      }
    } else {
      toast({ type: 'success', title: `Reservation ${status}` });
    }
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

  const btnEmailConfig = $('btnEmailConfig');
  if (btnEmailConfig) {
    btnEmailConfig.addEventListener('click', () => {
      const cfg = getEmailConfig();
      const modal = openModal({
        title: 'Automated Email Confirmation Setup',
        wide: true,
        content: `
          <div style="font-size:14px;color:var(--text);display:flex;flex-direction:column;gap:16px;">
            <p>Choose how confirmation emails are dispatched when you confirm a table reservation:</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="radio" name="email_provider" value="mailto" ${(!cfg.provider || cfg.provider === 'mailto') ? 'checked' : ''} />
                <b>1-Click Mail Client (Default)</b>
              </label>
              <p style="font-size:12px;color:var(--text-muted);margin-left:24px;">Automatically prepares a pre-composed confirmation email in your email app (Gmail, Outlook, etc.) with all reservation details ready to send. No setup required.</p>

              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
                <input type="radio" name="email_provider" value="emailjs" ${cfg.provider === 'emailjs' ? 'checked' : ''} />
                <b>EmailJS (Background Automated Sending)</b>
              </label>
              <p style="font-size:12px;color:var(--text-muted);margin-left:24px;">Sends emails directly and silently in the background using your free EmailJS account (200 free emails/month).</p>

              <div id="cfgEmailJs" style="display:${cfg.provider === 'emailjs' ? 'flex' : 'none'};flex-direction:column;gap:8px;margin-left:24px;">
                <div class="field">
                  <label>EmailJS Service ID</label>
                  <input id="cfgServiceId" type="text" placeholder="service_xxxx" value="${esc(cfg.serviceId || '')}" />
                </div>
                <div class="field">
                  <label>EmailJS Template ID</label>
                  <input id="cfgTemplateId" type="text" placeholder="template_xxxx" value="${esc(cfg.templateId || '')}" />
                </div>
                <div class="field">
                  <label>EmailJS Public Key</label>
                  <input id="cfgPublicKey" type="text" placeholder="public_xxxx" value="${esc(cfg.publicKey || '')}" />
                </div>
              </div>

              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
                <input type="radio" name="email_provider" value="webhook" ${cfg.provider === 'webhook' ? 'checked' : ''} />
                <b>Custom Webhook URL</b>
              </label>
              <div id="cfgWebhook" style="display:${cfg.provider === 'webhook' ? 'block' : 'none'};margin-left:24px;">
                <div class="field">
                  <label>Webhook URL (Zapier, Make, or custom API)</label>
                  <input id="cfgWebhookUrl" type="url" placeholder="https://..." value="${esc(cfg.webhookUrl || '')}" />
                </div>
              </div>
            </div>
          </div>
        `,
        actions: [
          { label: 'Cancel', className: 'btn-ghost', value: false },
          { label: 'Save Setup', className: 'btn-primary', value: true },
        ],
      });

      const root = modal.el;
      const rbs = root.querySelectorAll('input[name="email_provider"]');
      const boxJs = root.querySelector('#cfgEmailJs');
      const boxWh = root.querySelector('#cfgWebhook');
      rbs.forEach((rb) => {
        rb.addEventListener('change', () => {
          if (boxJs) boxJs.style.display = rb.value === 'emailjs' && rb.checked ? 'flex' : 'none';
          if (boxWh) boxWh.style.display = rb.value === 'webhook' && rb.checked ? 'block' : 'none';
        });
      });

      modal.result.then((save) => {
        if (!save) return;
        const selected = root.querySelector('input[name="email_provider"]:checked')?.value || 'mailto';
        const serviceId = root.querySelector('#cfgServiceId')?.value.trim() || '';
        const templateId = root.querySelector('#cfgTemplateId')?.value.trim() || '';
        const publicKey = root.querySelector('#cfgPublicKey')?.value.trim() || '';
        const webhookUrl = root.querySelector('#cfgWebhookUrl')?.value.trim() || '';

        saveEmailConfig({
          provider: selected,
          serviceId,
          templateId,
          publicKey,
          webhookUrl,
        });

        toast({ type: 'success', title: 'Settings saved', message: 'Email dispatch configuration updated.' });
      });
    });
  }

  await load();
  loadCounts();
}

init();
