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
  await apiSignOut();
  clearLocalSession();
  location.href = './login.html';
}
