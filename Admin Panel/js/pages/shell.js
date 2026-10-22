// js/pages/shell.js — shared sidebar + topbar for every /admin/* page.

import { icon, hydrateIcons } from '../utils/icons.js';
import { logout } from '../utils/guards.js';
import { confirmDialog, toast } from '../utils/ui.js';
import { initials, fmtDate, money, titleCase } from '../utils/format.js';
import { listOrders, subscribeOrders } from '../api/adminOrders.js';
import { listReservations, listFeedback } from '../api/adminContent.js';
import { initTheme, toggleTheme, getTheme } from '../utils/theme.js';

export const NAV = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: './dashboard.html' },
      { id: 'orders', label: 'Orders', icon: 'orders', href: './orders.html', badge: true },
    ],
  },
  {
    group: 'Service',
    items: [
      { id: 'receipt', label: 'Receipts & Bills', icon: 'receipt', href: './receipt.html' },
      { id: 'reservations', label: 'Reservations', icon: 'calendar', href: './reservations.html' },
    ],
  },
  {
    group: 'Content',
    items: [
      { id: 'menu', label: 'Menu', icon: 'kitchen', href: './menu.html' },
      { id: 'tables', label: 'Tables & QR', icon: 'qr', href: './tables.html' },
      { id: 'feedback', label: 'Feedback', icon: 'message', href: './feedback.html' },
      { id: 'gallery', label: 'Gallery', icon: 'image', href: './gallery.html' },
    ],
  },
  {
    group: 'Insight',
    items: [
      { id: 'reports', label: 'Reports', icon: 'chart', href: './reports.html' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: './settings.html' },
    ],
  },
];

const META = {
  dashboard: ['Dashboard', 'Live pulse of the restaurant'],
  orders: ['Orders', 'Every order, every status, one screen'],
  receipt: ['Receipts & Bills', 'Print receipts and combined table bills'],
  reservations: ['Reservations', 'Bookings waiting for a phone call'],
  menu: ['Menu', 'Categories, dishes, prices and availability'],
  tables: ['Tables & QR', 'Table list and printable QR codes'],
  feedback: ['Feedback', 'Reviews, queries and suggestions'],
  gallery: ['Gallery', 'Photos shown on the customer website'],
  reports: ['Reports', 'Sales, best sellers and CSV export'],
  settings: ['Settings', 'Restaurant details, tax, delivery and hours'],
};

let badgeEl = null;

export function initShell(pageId, session = {}) {
  initTheme();
  const [title, sub] = META[pageId] || ['Admin', ''];
  const name = session.name || 'Khabar Golpo Admin';
  const role = session.role || 'admin';
  const root = document.getElementById('shell-root');

  const navHtml = NAV.map(
    (g) => `
    <div class="nav-group">${g.group}</div>
    ${g.items
      .map(
        (it) => `<a class="nav-item ${it.id === pageId ? 'active' : ''}" data-nav="${it.id}" href="${it.href}">
          <span data-icon="${it.icon}"></span>
          <span>${it.label}</span>
          ${it.badge ? '<span class="nav-badge" data-nav-badge style="display:none">0</span>' : ''}
        </a>`
      )
      .join('')}`
  ).join('');

  root.innerHTML = `
    <div class="bg-decor" aria-hidden="true">
      <span class="orb o1"></span>
      <span class="orb o2"></span>
      <span class="orb o3"></span>
      <span class="orb o4"></span>
      <span class="orb o5"></span>
    </div>
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="brand-mark">K</div>
        <div>
          <div class="brand-name">Khabar Golpo</div>
          <div class="brand-sub">Admin Panel</div>
        </div>
      </div>
      <nav class="nav" id="nav">
        <span class="nav-ind" id="navInd"></span>
        ${navHtml}
      </nav>
      <div class="side-foot">
        <div class="side-user">
          <span class="avatar">${initials(name)}</span>
          <span class="side-user-info">
            <span class="side-user-name truncate">Admin</span>
            <span class="side-user-role">Signed in</span>
          </span>
          <button class="side-logout" id="btnLogout" title="Sign out" data-icon="logout"></button>
        </div>
        <div class="side-version">Version 1.0</div>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <header class="topbar">
      <button class="burger" id="burger" aria-label="Open menu" data-icon="hamburger"></button>
      <div class="tb-titles">
        <div class="tb-title">${escapeHtml(title)}</div>
        <div class="tb-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="tb-right">
        <button class="tt-btn" id="themeToggle" type="button" aria-label="Toggle light and dark theme" title="Toggle theme">
          <span class="tt-sun" data-icon="sun"></span>
          <span class="tt-moon" data-icon="moon"></span>
        </button>
        <span class="pill pill-live" title="Orders update live"><span class="dot-live"></span> Live</span>
        <span class="pill tb-clock" id="tbClock" data-icon="clock"></span>
        <button class="tb-avatar" id="tbAvatar" title="Signed in">
          <span class="avatar">${initials(name)}</span>
        </button>
        <div class="notif-wrap">
          <button class="tt-btn" id="bell" type="button" aria-label="Notifications" title="Notifications"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0-6 6v3.5c0 .8-.3 1.5-.8 2.1L4 16.2a1 1 0 0 0 .8 1.6h14.4a1 1 0 0 0 .8-1.6l-1.2-1.6a3.4 3.4 0 0 1-.8-2.1V9a6 6 0 0 0-6-6z"/><path d="M9.8 20.5a2.4 2.4 0 0 0 4.4 0"/></svg><span class="bell-badge" id="bellBadge" hidden>0</span></button>
          <div class="notif-panel glass" id="notifPanel" hidden></div>
        </div>
      </div>
    </header>`;

  document.body.classList.add('app');
  hydrateIcons(root);
  badgeEl = root.querySelector('[data-nav-badge]');
  initNotifications();

  moveIndicator();
  window.addEventListener('resize', moveIndicator);

  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const closeNav = () => {
    sidebar.classList.remove('open');
    scrim.classList.remove('on');
  };
  document.getElementById('burger').addEventListener('click', () => {
    sidebar.classList.toggle('open');
    scrim.classList.toggle('on');
  });
  scrim.addEventListener('click', closeNav);
  root.querySelectorAll('.nav-item').forEach((a) => a.addEventListener('click', closeNav));

  document.getElementById('btnLogout').addEventListener('click', async () => {
    const yes = await confirmDialog({
      title: 'Sign out?',
      message: 'You will return to the login screen.',
      confirmText: 'Sign out',
      icon: 'logout',
    });
    if (yes) logout();
  });

  document.getElementById('tbAvatar').addEventListener('click', () => {
    toast({ type: 'info', title: 'Hi, Admin!', message: `Signed in as ${role}. Manage your profile in Settings.` });
  });

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const syncThemeBtn = (t = getTheme()) => {
      const next = t === 'dark' ? 'light' : 'dark';
      themeBtn.title = `Switch to ${next} theme`;
      themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
      themeBtn.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    };
    syncThemeBtn();
    themeBtn.addEventListener('click', () => {
      syncThemeBtn(toggleTheme());
      toast({
        type: 'info',
        title: `${getTheme() === 'dark' ? 'Dark' : 'Light'} theme on`,
        message: 'Your choice is saved for next time.',
        duration: 2200,
      });
    });
  }

  tickClock();
  setInterval(tickClock, 1000);

  return { title, sub };
}

function tickClock() {
  const el = document.getElementById('tbClock');
  if (!el) return;
  const now = new Date();
  const t = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  el.innerHTML = `${icon('clock')}<span class="tb-time">${t}</span><span class="tb-date">${fmtDate(now.toISOString(), { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' })}</span>`;
}

function moveIndicator() {
  const nav = document.getElementById('nav');
  const ind = document.getElementById('navInd');
  if (!nav || !ind) return;
  const active = nav.querySelector('.nav-item.active');
  if (!active) {
    ind.style.opacity = '0';
    return;
  }
  ind.style.opacity = '1';
  ind.style.height = `${active.offsetHeight}px`;
  ind.style.transform = `translateY(${active.offsetTop}px)`;
}

export function setNavBadge(id, value) {
  const item = document.querySelector(`.nav-item[data-nav="${id}"]`);
  if (!item) return;
  const b = item.querySelector('[data-nav-badge]');
  if (!b) return;
  if (!value) {
    b.style.display = 'none';
  } else {
    b.style.display = '';
    b.textContent = value > 99 ? '99+' : String(value);
    b.classList.remove('pop-in');
    void b.offsetWidth;
    b.classList.add('pop-in');
  }
}

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}


/* ---------------- notification bell: new orders, pending bookings, unread feedback ---------------- */
function initNotifications() {
  const btn = document.getElementById('bell');
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('bellBadge');
  if (!btn || !panel) return;
  let last = 0;
  const group = (title, items) => items.length
    ? `<div class="notif-h">${title}</div>` + items.map((i) => `<a class="notif-item" href="${i.href}"><b>${escapeHtml(i.title)}</b><span>${escapeHtml(i.meta)}</span></a>`).join('')
    : '';
  async function refresh() {
    const [o, r, f] = await Promise.all([listOrders({ status: 'new', page: 1, perPage: 5 }), listReservations({ status: 'pending' }), listFeedback({ unread_only: true })]);
    const orders = o.data && o.data.rows ? o.data.rows : [];
    const bookings = r.data || [];
    const notes = (f.data || []).filter((x) => x.is_read !== true);
    const total = (o.data && o.data.total !== undefined ? o.data.total : orders.length) + bookings.length + notes.length;
    badge.textContent = total > 99 ? '99+' : total;
    badge.hidden = total === 0;
    btn.classList.toggle('has', total > 0);
    if (total > last) { btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring'); }
    last = total;
    const feed = [
      ...orders.map((x) => ({ href: `./orders.html?receipt=${encodeURIComponent(x.receipt)}`, title: `New order ${x.receipt}`, meta: `${titleCase(x.order_type)} · ${money(x.total)}`, at: x.created_at })),
      ...bookings.slice(0, 6).map((x) => ({ href: './reservations.html', title: `Booking: ${x.name}`, meta: `${x.guests} guests · ${x.date} at ${x.time}`, at: x.created_at })),
      ...notes.slice(0, 6).map((x) => ({ href: './feedback.html', title: `${titleCase(x.type || 'feedback')} from ${x.name || 'a guest'}`, meta: String(x.message || '').slice(0, 60), at: x.created_at })),
    ].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    panel.innerHTML = feed.length
      ? feed.map((i) => `<a class="notif-item" href="${i.href}"><div><b>${escapeHtml(i.title)}</b><span>${escapeHtml(i.meta)}</span></div><time>${i.at ? clockAgo(i.at) : ''}</time></a>`).join('')
      : '<div class="notif-empty">You are all caught up.</div>';
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); panel.hidden = !panel.hidden; });
  document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target)) panel.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.hidden = true; });
  refresh();
  setInterval(refresh, 60000);
  subscribeOrders(() => refresh());
}

function clockAgo(iso) {
  const d = new Date(iso);
  const m = Math.max(0, Math.round((Date.now() - d) / 60000));
  const rel = m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} d ago`;
  return `<b>${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</b><i>${rel}</i>`;
}
