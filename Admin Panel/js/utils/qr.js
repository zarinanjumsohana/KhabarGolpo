// js/utils/qr.js — table QR builder.
// QR images come from a public QR image API; every QR encodes
// <site>/customer/index.html?table=N

import { CONFIG } from '../config.js';

let QR_BASE = '';

const isLoopback = (host) =>
  !host || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(host);

/* Work out which address a phone should open.
   - deployed site  -> the site's own origin
   - local server   -> the PC's Wi-Fi address (from serve.mjs /__kg-host),
                       because a phone cannot open "localhost". */
export async function resolveQrBase() {
  if (QR_BASE) return QR_BASE;

  if (!isLoopback(location.hostname)) {
    QR_BASE = location.origin;
    return QR_BASE;
  }

  try {
    const res = await fetch('/__kg-host', { cache: 'no-store' });
    if (res.ok) {
      const info = await res.json();
      if (info && info.origin) {
        QR_BASE = info.origin;
        return QR_BASE;
      }
    }
  } catch (e) {
    /* static server without the helper */
  }

  QR_BASE = location.origin || CONFIG.SITE_URL || '';
  return QR_BASE;
}

/* True when the link still points at this machine only (phone cannot open it). */
export function qrBaseIsLocal() {
  return !QR_BASE || isLoopback(new URL(QR_BASE, location.href).hostname);
}

export function tableLink(tableNumber) {
  const base = (QR_BASE || location.origin || CONFIG.SITE_URL || '').replace(/\/$/, '');
  return `${base}/dining/dine.html?table=${encodeURIComponent(tableNumber)}`;
}

export function qrUrl(text, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
}

export function qrImg(tableNumber, size = 320) {
  const link = tableLink(tableNumber);
  return `<img class="qr-img" src="${qrUrl(link, size)}" alt="QR code for table ${tableNumber}" width="${size}" height="${size}"
    onerror="this.classList.add('qr-failed');this.replaceWith(Object.assign(document.createElement('span'),{className:'qr-fallback',textContent:'${link}'}))">`;
}
