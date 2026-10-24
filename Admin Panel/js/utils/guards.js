// js/utils/guards.js — page guards. Convenience only: real security is RLS + RPC role checks.

import { isMock } from '../config.js';
import { signIn as apiSignIn, signOut as apiSignOut, getSession as apiGetSession, getProfile } from '../api/auth.js';

const KEY = 'kg.admin.session';

export function localSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveLocalSession(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearLocalSession() {
  localStorage.removeItem(KEY);
}

export async function getSession() {
  if (isMock()) return localSession();
  const s = await apiGetSession();
  if (!s) return null;
  const profile = await getProfile();
  return {
    email: s.email,
    role: profile.data?.role || null,
    name: profile.data?.full_name || s.email,
  };
}

export async function requireAdmin(redirect = './login.html') {
  const s = await getSession();
  if (!s || s.role !== 'admin') {
    if (!isMock()) await apiSignOut();
    clearLocalSession();
    location.replace(redirect);
    return null;
  }
  return s;
}

export function currentUser() {
  return localSession();
}

export async function login({ email, password }) {
  const res = await apiSignIn({ email, password });
  if (res.error) return res;
  if (isMock()) saveLocalSession(res.data);
  return res;
}

export async function logout() {
  try {
    await apiSignOut();
  } catch (e) {
    /* even if the server sign-out fails, everything below still runs */
  }
  clearLocalSession();
  // forget every login this browser still remembers (Supabase keys start with "sb-"),
  // so no page can sign the user back in automatically
  Object.keys(localStorage)
    .filter((k) => k.startsWith('sb-') || k.startsWith('kg.'))
    .forEach((k) => localStorage.removeItem(k));
  sessionStorage.clear();
  // go to the hero page (a page with no auto-login), and replace history so Back cannot return to the dashboard
    location.replace('./login.html');
}