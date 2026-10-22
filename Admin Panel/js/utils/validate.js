// js/utils/validate.js — form validation used by admin forms and the API layer.

export const LIMITS = {
  note: 200,
  address: 240,
  caption: 120,
  qtyMin: 1,
  qtyMax: 20,
  linesMax: 30,
};

export function isEmail(v = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
}

export function isPhone(v = '') {
  const s = String(v).replace(/[\s-()]/g, '');
  return /^(\+?880|0)1[3-9]\d{8}$/.test(s);
}

export function isPrice(v) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100000;
}

export function isInt(v) {
  return /^\d+$/.test(String(v).trim());
}

export function required(v) {
  return String(v == null ? '' : v).trim().length > 0;
}

export function maxLen(v, n) {
  return String(v == null ? '' : v).length <= n;
}

export function withinQty(qty) {
  const n = Number(qty);
  return Number.isInteger(n) && n >= LIMITS.qtyMin && n <= LIMITS.qtyMax;
}

export function validate(rules, values) {
  const errors = {};
  for (const [field, tests] of Object.entries(rules)) {
    for (const t of tests) {
      const err = t(values[field], values, field);
      if (err) {
        errors[field] = err;
        break;
      }
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export const rules = {
  required: (label = 'This field') => (v) => (required(v) ? null : `${label} is required.`),
  email: () => (v) => (isEmail(v) ? null : 'Enter a valid email address.'),
  phone: () => (v) => (isPhone(v) ? null : 'Enter a valid phone number (e.g. 01712345678).'),
  price: () => (v) => (isPrice(v) ? null : 'Enter a valid price.'),
  max:
    (n, label = 'This field') =>
    (v) =>
      maxLen(v, n) ? null : `${label} must be ${n} characters or fewer.`,
};

export function firstError(errors) {
  const k = Object.keys(errors)[0];
  return k ? errors[k] : null;
}
