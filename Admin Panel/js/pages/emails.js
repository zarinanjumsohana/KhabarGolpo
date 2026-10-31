// js/pages/emails.js — guest emails collected from pickup / delivery orders.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listOrders } from '../api/adminOrders.js';
import { sendOrderConfirmation } from '../utils/emailService.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, emptyState, esc, stagger, reveal, skeleton } from '../utils/ui.js';
import { relTime, titleCase } from '../utils/format.js';
import { money } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

const state = { rows: [] };

function card(o, i) {
  return `
  <article class="fb-card" style="--i:${i}" data-id="${o.id}">
    <div class="fb-top">
      <div class="fb-who">
        <span class="avatar avatar-ink">${esc((o.customer_name || o.email || '?').slice(0, 1).toUpperCase())}</span>
        <div>
          <div class="fb-name">${esc(o.customer_name || 'Guest')}</div>
          <div class="fb-when">${esc(o.email)}${o.phone ? ` · ${esc(o.phone)}` : ''}</div>
        </div>
      </div>
      <span class="badge st-${o.status} plain">${esc(titleCase(o.status))}</span>
    </div>

    <div class="fb-msg">${esc(o.receipt)} · ${esc(titleCase(o.order_type))} — ${money(o.total)}</div>

    <div class="fb-actions">
      <button class="btn btn-soft btn-xs" data-act="send">${icon('mail')} Send confirmation</button>
    </div>
  </article>`;
}

async function load() {
  const host = $('emailGrid');
  host.innerHTML = skeleton(6);
  const res = await listOrders({ page: 1, perPage: 200 });
  if (res.error) {
    toast({ type: 'error', title: 'Could not load emails', message: res.error.message });
    return;
  }
  state.rows = (res.data?.rows || []).filter((o) => o.email);
  const count = $('chipCountNum');
  if (count) count.textContent = String(state.rows.length);
  if (!state.rows.length) {
    host.innerHTML = emptyState({ icon: 'mail', title: 'Inbox zero', hint: 'No guest emails yet. They appear here after a pickup or delivery order.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = state.rows.map(card).join('');
  hydrateIcons(host);
  stagger(host, 55);
}

async function send(o) {
  const res = await sendOrderConfirmation(o);
  if (res.error) {
    toast({ type: 'error', title: 'Could not send', message: res.error.message });
    return;
  }
  toast({ type: 'success', title: 'Confirmation sent', message: `To ${res.email}` });
  load();
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('emails', session);
  hydrateIcons($('page'));
  reveal();
  $('emailGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const cardEl = btn.closest('[data-id]');
    if (!cardEl) return;
    const o = state.rows.find((x) => x.id === cardEl.dataset.id);
    if (!o) return;
    if (btn.dataset.act === 'send') return send(o);
  });
  await load();
}

init();
