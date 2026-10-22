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
