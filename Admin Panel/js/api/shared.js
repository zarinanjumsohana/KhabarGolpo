// js/api/shared.js — helpers for the API layer (not used by pages).

import { isMock } from '../config.js';

export const ok = (data) => ({ data, error: null });
export const fail = (code, message) => ({ data: null, error: { code, message } });

export function friendly(message = '') {
  const m = String(message).toLowerCase();
  if (m.includes('failed to fetch') || m.includes('network')) return 'Network problem. Check your connection and try again.';
  if (m.includes('row-level security')) return 'You do not have permission to do that.';
  if (m.includes('duplicate')) return 'That value already exists.';
  if (m.includes('violates check') || m.includes('violates constraint')) return 'Some values are not allowed. Check the form and retry.';
  if (m.includes('invalid login')) return 'That email or password is not correct.';
  return message || 'Something went wrong. Please try again.';
}

/** Normalises a supabase-js response into the standard shape. */
export function fromSupabase(res, { code = 'ERROR', message = 'Request failed.' } = {}) {
  if (res?.error) return fail(code, friendly(res.error.message || message));
  return ok(res?.data ?? null);
}

export async function withMock(mockFn, liveFn) {
  if (isMock()) return mockFn();
  try {
    return await liveFn();
  } catch (e) {
    return fail('EXCEPTION', friendly(e?.message));
  }
}

/**
 * Normalises settings row from either Supabase or mock store so all front-end
 * conventions (name vs restaurant_name, tax_rate vs tax_percent, etc.) exist simultaneously.
 */
export function normalizeSettings(raw) {
  if (!raw) return raw;
  const s = { ...raw };

  const name = s.restaurant_name ?? s.name ?? '';
  s.name = name;
  s.restaurant_name = name;

  const logo = s.logo_url ?? s.logo ?? null;
  s.logo = logo;
  s.logo_url = logo;

  const tax = s.tax_percent != null ? Number(s.tax_percent) : (s.tax_rate != null ? Number(s.tax_rate) : 0);
  s.tax_percent = tax;
  s.tax_rate = tax;

  const minOrder = s.min_delivery_amount != null ? Number(s.min_delivery_amount) : (s.min_delivery_order != null ? Number(s.min_delivery_order) : 0);
  s.min_delivery_amount = minOrder;
  s.min_delivery_order = minOrder;

  const note = s.delivery_area_note ?? s.delivery_note ?? '';
  s.delivery_area_note = note;
  s.delivery_note = note;

  let hoursWeek = s.hours_week || '';
  let hoursWeekend = s.hours_weekend || '';
  if ((!hoursWeek || !hoursWeekend) && s.hours) {
    if (s.hours.includes('·')) {
      const parts = s.hours.split('·').map((p) => p.trim());
      hoursWeek = parts[0]?.replace(/^Weekdays?:?\s*/i, '') || '';
      hoursWeekend = parts[1]?.replace(/^Weekends?:?\s*/i, '') || '';
    } else {
      hoursWeek = s.hours;
      hoursWeekend = s.hours;
    }
  }
  s.hours_week = hoursWeek;
  s.hours_weekend = hoursWeekend;
  if (!s.hours && (hoursWeek || hoursWeekend)) {
    s.hours = [hoursWeek && `Weekdays ${hoursWeek}`, hoursWeekend && `Weekend ${hoursWeekend}`].filter(Boolean).join(' · ');
  }

  s.delivery_fee = s.delivery_fee != null ? Number(s.delivery_fee) : 0;
  s.prep_time_minutes = s.prep_time_minutes != null ? Number(s.prep_time_minutes) : 25;
  s.pickup_enabled = s.pickup_enabled !== false;
  s.delivery_enabled = s.delivery_enabled !== false;
  s.pickup_hours = s.pickup_hours || '';
  s.timezone = s.timezone || 'Asia/Dhaka';
  s.tagline = s.tagline || '';
  s.phone = s.phone || '';
  s.email = s.email || '';
  s.address = s.address || '';

  return s;
}

/**
 * Filters and transforms a settings patch to match EXACT columns of the Supabase settings table.
 * Strips any virtual or front-end alias properties that do not exist in the database schema cache.
 */
export function toDatabaseSettings(patch = {}) {
  const dbPatch = {};

  if ('restaurant_name' in patch || 'name' in patch) {
    dbPatch.restaurant_name = String(patch.restaurant_name ?? patch.name ?? '').trim();
  }
  if ('tagline' in patch) dbPatch.tagline = String(patch.tagline ?? '').trim();
  if ('address' in patch) dbPatch.address = String(patch.address ?? '').trim();
  if ('phone' in patch) dbPatch.phone = String(patch.phone ?? '').trim();
  if ('email' in patch) dbPatch.email = String(patch.email ?? '').trim();

  if ('hours' in patch && patch.hours) {
    dbPatch.hours = String(patch.hours).trim();
  } else if ('hours_week' in patch || 'hours_weekend' in patch) {
    const hw = String(patch.hours_week || '').trim();
    const hwe = String(patch.hours_weekend || '').trim();
    if (hw && hwe && hw !== hwe) {
      dbPatch.hours = `Weekdays: ${hw} · Weekends: ${hwe}`;
    } else {
      dbPatch.hours = hw || hwe || '';
    }
  }

  if ('logo_url' in patch || 'logo' in patch) {
    dbPatch.logo_url = patch.logo_url ?? patch.logo ?? null;
  }

  if ('tax_percent' in patch || 'tax_rate' in patch) {
    const val = patch.tax_percent ?? patch.tax_rate;
    dbPatch.tax_percent = Math.max(0, Math.min(50, Number(val) || 0));
  }

  if ('timezone' in patch) dbPatch.timezone = patch.timezone || 'Asia/Dhaka';
  if ('pickup_enabled' in patch) dbPatch.pickup_enabled = Boolean(patch.pickup_enabled);
  if ('delivery_enabled' in patch) dbPatch.delivery_enabled = Boolean(patch.delivery_enabled);

  if ('delivery_fee' in patch) {
    dbPatch.delivery_fee = Math.max(0, Number(patch.delivery_fee) || 0);
  }

  if ('min_delivery_amount' in patch || 'min_delivery_order' in patch) {
    const val = patch.min_delivery_amount ?? patch.min_delivery_order;
    dbPatch.min_delivery_amount = Math.max(0, Number(val) || 0);
  }

  if ('delivery_area_note' in patch || 'delivery_note' in patch) {
    dbPatch.delivery_area_note = String(patch.delivery_area_note ?? patch.delivery_note ?? '').trim();
  }

  if ('prep_time_minutes' in patch) {
    dbPatch.prep_time_minutes = Math.max(0, Number(patch.prep_time_minutes) || 25);
  }

  if ('pickup_hours' in patch) {
    dbPatch.pickup_hours = String(patch.pickup_hours ?? '').trim();
  }

  return dbPatch;
}
