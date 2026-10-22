// js/utils/qr.js — table QR builder.
// QR images come from a public QR image API; every QR encodes <site>/order?table=N

import { CONFIG } from '../config.js';

export function tableLink(tableNumber) {
  const base = (CONFIG.SITE_URL || window.location.origin).replace(/\/$/, '');
  return `${base}/order?table=${encodeURIComponent(tableNumber)}`;
}

export function qrUrl(text, size = 320) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(text)}`;
}

export function qrImg(tableNumber, size = 320) {
  const link = tableLink(tableNumber);
  return `<img class="qr-img" src="${qrUrl(link, size)}" alt="QR code for table ${tableNumber}" width="${size}" height="${size}"
    onerror="this.classList.add('qr-failed');this.replaceWith(Object.assign(document.createElement('span'),{className:'qr-fallback',textContent:'${link}'}))">`;
}
