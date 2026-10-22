// js/utils/ui.js — shared interface helpers: toasts, modals, drawer, counters, stagger.

import { icon, hydrateIcons } from './icons.js';

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function layer(cls) {
  const el = document.createElement('div');
  el.className = cls;
  document.body.appendChild(el);
  hydrateIcons(el);
  return el;
}

/* ---------------- toast ---------------- */
let toastHost = null;
export function toast({ type = 'info', title = '', message = '', duration = 4200, action = null } = {}) {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toast-host';
    document.body.appendChild(toastHost);
  }
  const iconName = { success: 'check', error: 'alert', warning: 'alert', info: 'info' }[type] || 'info';
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span class="toast-ic" data-icon="${iconName}"></span>
    <span class="toast-body">
      ${title ? `<strong class="toast-title">${esc(title)}</strong>` : ''}
      ${message ? `<span class="toast-msg">${esc(message)}</span>` : ''}
    </span>
    ${action ? `<button class="toast-act">${esc(action.label)}</button>` : ''}
    <button class="toast-x" aria-label="Dismiss" data-icon="x"></button>`;
  toastHost.appendChild(el);
  hydrateIcons(el);
  const kill = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  };
  el.querySelector('.toast-x').addEventListener('click', kill);
  const actBtn = el.querySelector('.toast-act');
  if (actBtn) actBtn.addEventListener('click', () => {
    kill();
    if (action.href) location.href = action.href;
    else if (action.onClick) action.onClick();
  });
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(kill, duration);
  return kill;
}

/* ---------------- modal ---------------- */
export function openModal({ title = '', content = '', actions = [], wide = false }) {
  const overlay = layer('ui-overlay');
  overlay.innerHTML = `
    <div class="ui-modal ${wide ? 'is-wide' : ''}" role="dialog" aria-modal="true">
      <header class="ui-modal-head">
        <h3>${esc(title)}</h3>
        <button class="ui-x" data-close data-icon="x" aria-label="Close"></button>
      </header>
      <div class="ui-modal-body"></div>
      ${actions.length ? '<footer class="ui-modal-foot"></footer>' : ''}
    </div>`;
  const body = overlay.querySelector('.ui-modal-body');
  if (typeof content === 'string') body.innerHTML = content;
  else body.appendChild(content);
  hydrateIcons(overlay);

  let resolve; 
  let resolved = false;
  const close = (value = null) => {
    if (resolved) return;
    resolved = true;
    overlay.classList.add('out');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => overlay.remove(), 260);
    resolve(value);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close(null);
  };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) close(null);
  });
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close(null)));

  const promise = new Promise((res) => {
     resolve = res;
    const foot = overlay.querySelector('.ui-modal-foot');
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = `btn ${a.className || 'btn-ghost'}`;
      btn.innerHTML = `${a.icon ? `<span data-icon="${a.icon}"></span>` : ''}<span>${esc(a.label)}</span>`;
      if (foot) foot.appendChild(btn);
      btn.addEventListener('click', async () => {
        if (a.onClick) {
          const r = await a.onClick({ close, btn });
          if (r === false) return;
        }
        close(a.value ?? a.label);
      });
    });
    hydrateIcons(overlay);
    requestAnimationFrame(() => overlay.classList.add('in'));
  });

  return { el: overlay, close, result: promise };
}

export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  icon: ic = 'alert',
} = {}) {
  return openModal({
    title,
    content: `<div class="ui-confirm"><span class="ui-confirm-ic ${danger ? 'is-danger' : ''}" data-icon="${ic}"></span><p>${esc(message)}</p></div>`,
    actions: [
      { label: cancelText, className: 'btn-ghost', value: false },
      { label: confirmText, className: danger ? 'btn-danger' : 'btn-primary', value: true },
    ],
  }).result;
}

/* ---------------- drawer ---------------- */
export function openDrawer({ title = '', subtitle = '' }) {
  const overlay = layer('ui-overlay ui-overlay-drawer');
  overlay.innerHTML = `
    <aside class="ui-drawer" role="dialog" aria-modal="true">
      <header class="ui-drawer-head">
        <div>
          <h3>${esc(title)}</h3>
          ${subtitle ? `<span class="ui-drawer-sub">${esc(subtitle)}</span>` : ''}
        </div>
        <button class="ui-x" data-close data-icon="x" aria-label="Close"></button>
      </header>
      <div class="ui-drawer-body"></div>
      <footer class="ui-drawer-foot"></footer>
    </aside>`;
  hydrateIcons(overlay);
  const body = overlay.querySelector('.ui-drawer-body');
  const foot = overlay.querySelector('.ui-drawer-foot');
  const onKey = (e) => e.key === 'Escape' && api.close();
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) api.close();
  });
  overlay.querySelector('[data-close]').addEventListener('click', () => api.close());
  const api = {
    el: overlay,
    body,
    foot,
    close() {
      overlay.classList.add('out');
      document.removeEventListener('keydown', onKey);
      setTimeout(() => overlay.remove(), 300);
    },
  };
  requestAnimationFrame(() => overlay.classList.add('in'));
  return api;
}

/* ---------------- misc ---------------- */
export function buttonLoading(btn, on = true) {
  if (!btn) return;
  if (on) {
    btn.dataset.disabled = '1';
    btn.disabled = true;
    btn.classList.add('is-loading');
    if (!btn.querySelector('.btn-spin')) {
      btn.insertAdjacentHTML('afterbegin', '<span class="btn-spin"></span>');
    }
  } else {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.querySelector('.btn-spin')?.remove();
    delete btn.dataset.disabled;
  }
}

export function stagger(container, step = 55) {
  if (!container) return;
  const kids = [...container.children];
  kids.forEach((k, i) => {
    k.style.setProperty('--i', i);
    k.style.animationDelay = `${Math.min(i * step, 900)}ms`;
  });
  container.classList.add('staggered');
}

export function countUp(el, to, { duration = 1100, prefix = '', suffix = '', decimals = 0 } = {}) {
  if (!el) return;
  const start = performance.now();
  const target = Number(to) || 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    el.textContent = `${prefix}${target.toFixed(decimals)}${suffix}`;
    return;
  }
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const v = target * eased;
    el.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
    if (p < 1) requestAnimationFrame(tick);
    else el.textContent = `${prefix}${target.toLocaleString('en-US', { maximumFractionDigits: decimals })}${suffix}`;
  };
  requestAnimationFrame(tick);
}

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))),
  { threshold: 0.12 }
);

export function reveal(root = document) {
  root.querySelectorAll('.reveal:not(.in)').forEach((el) => io.observe(el));
}

export function emptyState({ icon: ic = 'inbox', title = 'Nothing here yet', hint = '' } = {}) {
  return `<div class="empty"><span class="empty-ic" data-icon="${ic}"></span>
    <h4>${esc(title)}</h4>${hint ? `<p>${esc(hint)}</p>` : ''}</div>`;
}

export function skeleton(rows = 6) {
  let out = '';
  for (let i = 0; i < rows; i++) out += '<div class="sk sk-row"></div>';
  return `<div class="sk-list">${out}</div>`;
}

/* ---------------- tilt micro-interaction ---------------- */
// Adds a subtle perspective tilt + moving glare to every `.tilt` element.
// Pointer coordinates are written to `--mx`/`--my` (glare) and `--rx`/`--ry`
// (rotation). rAF-throttled; disabled for reduced motion and coarse pointers.
export function setupTilt(root = document, { max = 7, zoom = 1.015, glare = true } = {}) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !fine) return () => {};

  const cleanups = [];
  root.querySelectorAll('.tilt:not([data-tilt-ready])').forEach((el) => {
    el.dataset.tiltReady = '1';

    let glareEl = el.querySelector(':scope > .tilt-glare');
    if (glare && !glareEl) {
      glareEl = document.createElement('span');
      glareEl.className = 'tilt-glare';
      glareEl.setAttribute('aria-hidden', 'true');
      el.appendChild(glareEl);
    }

    let raf = 0;
    const point = { x: 0, y: 0 };

    const paint = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = Math.min(1, Math.max(0, (point.x - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (point.y - r.top) / r.height));
      el.style.setProperty('--mx', `${(px * 100).toFixed(2)}%`);
      el.style.setProperty('--my', `${(py * 100).toFixed(2)}%`);
      el.style.setProperty('--rx', `${((0.5 - py) * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((px - 0.5) * max * 2).toFixed(2)}deg`);
      el.style.setProperty('--tilt-scale', String(zoom));
    };

    const onMove = (e) => {
      point.x = e.clientX;
      point.y = e.clientY;
      el.classList.add('is-tilting');
      if (!raf) raf = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--tilt-scale', '1');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      onLeave();
      delete el.dataset.tiltReady;
      glareEl?.remove();
    });
  });

  return () => cleanups.forEach((fn) => fn());
}

