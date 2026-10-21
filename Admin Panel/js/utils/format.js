// js/utils/format.js — display formatting helpers.

import { CONFIG } from '../config.js';

const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const currency = CONFIG.CURRENCY || '৳';

export function money(n, { decimals = false } = {}) {
  const v = Number(n || 0);
  return `${currency} ${decimals ? nf2.format(v) : nf0.format(Math.round(v))}`;
}

export function num(n) {
  return nf0.format(Number(n || 0));
}

function tz() {
  return CONFIG.TIMEZONE || 'Asia/Dhaka';
}

export function fmtDate(iso, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz() }).format(d);
}

export function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: tz(),
  }).format(d);
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  return `${fmtDate(iso)} · ${fmtTime(iso)}`;
}

export function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  let label;
  if (mins < 1) label = 'just now';
  else if (mins < 60) label = `${mins} min`;
  else {
    const hrs = Math.round(mins / 60);
    if (hrs < 24) label = `${hrs} hr`;
    else label = `${Math.round(hrs / 24)} d`;
  }
  return diff >= 0 ? `${label} ago` : `in ${label}`;
}

export function minsSince(iso) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayKey() {
  return dayKey(new Date());
}

export function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'AD'
  );
}

export function titleCase(s = '') {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function shortName(full = '') {
  const parts = String(full).trim().split(/\s+/);
  return parts[0] || 'Customer';
}
