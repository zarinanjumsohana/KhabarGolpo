// js/pages/feedback.js — reviews, queries and suggestions.

import { requireAdmin } from '../utils/guards.js';
import { initShell } from './shell.js';
import { listFeedback, setFeedbackRead, approveFeedback, deleteFeedback } from '../api/adminContent.js';
import { hydrateIcons, icon } from '../utils/icons.js';
import { toast, emptyState, esc, confirmDialog, stagger, reveal, skeleton } from '../utils/ui.js';
import { relTime, titleCase } from '../utils/format.js';

const $ = (id) => document.getElementById(id);

const state = { type: '', unread: false };
let rows = [];

function stars(n) {
  return `<span class="stars">${[1, 2, 3, 4, 5]
    .map((i) => icon('star', i <= n ? '' : 'off'))
    .join('')}</span>`;
}

function card(f, i) {
  return `
  <article class="fb-card ${f.is_read ? '' : 'unread'}" style="--i:${i}" data-id="${f.id}">
    <div class="fb-top">
      <div class="fb-who">
        <span class="avatar avatar-ink">${esc((f.name || 'G').slice(0, 1).toUpperCase())}</span>
        <div>
          <div class="fb-name">${esc(f.name)}</div>
          <div class="fb-when">${esc(relTime(f.created_at))} · ${esc(titleCase(f.type))}${f.is_approved ? ' · approved' : ''}</div>
        </div>
      </div>
      <span class="badge st-${f.type} plain">${esc(titleCase(f.type))}</span>
    </div>

    ${f.rating ? `<div>${stars(f.rating)}</div>` : ''}
    <p class="fb-msg">${esc(f.message)}</p>

    <div class="fb-actions">
      ${f.type === 'review' && !f.is_approved ? `<button class="btn btn-success btn-xs" data-act="approve">${icon('check')} Approve for site</button>` : ''}
      ${f.type === 'review' && f.is_approved ? `<span class="badge st-ready plain">${icon('check')} Live on website</span>` : ''}
      <button class="btn btn-soft btn-xs" data-act="read">${icon(f.is_read ? 'eyeOff' : 'eye')} ${f.is_read ? 'Mark unread' : 'Mark read'}</button>
      <button class="btn btn-danger btn-xs" data-act="delete">${icon('trash')} Delete</button>
    </div>
  </article>`;
}

async function load() {
  const host = $('fbGrid');
  host.innerHTML = skeleton(6);
  const res = await listFeedback({ type: state.type, unread: state.unread });
  if (res.error) {
    toast({ type: 'error', title: 'Could not load feedback', message: res.error.message });
    return;
  }
  rows = res.data;
  if (!rows.length) {
    host.innerHTML = emptyState({ icon: 'message', title: 'Inbox zero', hint: 'Nothing matches this filter. Try another tab.' });
    hydrateIcons(host);
    return;
  }
  host.innerHTML = rows.map(card).join('');
  hydrateIcons(host);
  stagger(host, 55);
}

function moveSeg() {
  const seg = $('typeSeg');
  const active = seg.querySelector('button.on');
  const ind = $('segInd');
  if (!active) return;
  ind.style.width = `${active.offsetWidth}px`;
  ind.style.transform = `translateX(${active.offsetLeft - 4}px)`;
}

async function init() {
  const session = await requireAdmin();
  if (!session) return;
  initShell('feedback', session);
  hydrateIcons($('page'));
  reveal();
  moveSeg();
  window.addEventListener('resize', moveSeg);

  document.querySelectorAll('[data-type]').forEach((b) =>
    b.addEventListener('click', () => {
      state.type = b.dataset.type;
      document.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === b));
      moveSeg();
      load();
    })
  );
  $('chipUnread').addEventListener('click', () => {
    state.unread = !state.unread;
    $('chipUnread').classList.toggle('on', state.unread);
    load();
  });

  $('fbGrid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const cardEl = btn.closest('[data-id]');
    const id = cardEl.dataset.id;
    const f = rows.find((x) => x.id === id);
    const act = btn.dataset.act;

    if (act === 'approve') {
      const res = await approveFeedback(id);
      res.error
        ? toast({ type: 'error', title: 'Could not approve', message: res.error.message })
        : toast({ type: 'success', title: 'Review approved', message: 'It is now visible in the website slider.' });
      load();
      return;
    }
    if (act === 'read') {
      await setFeedbackRead(id, !f.is_read);
      load();
      return;
    }
    if (act === 'delete') {
      const yes = await confirmDialog({
        title: 'Delete this message?',
        message: 'This cannot be undone.',
        danger: true,
        confirmText: 'Delete',
      });
      if (!yes) return;
      const res = await deleteFeedback(id);
      res.error
        ? toast({ type: 'error', title: 'Could not delete', message: res.error.message })
        : toast({ type: 'success', title: 'Message deleted' });
      load();
    }
  });

  await load();
}

init();
