/* KhabarGolpo kitchen — shared session helper.
   The kitchen pages are staff-only: login happens on login.html (or on the
   admin login page, which sends chefs here). This file keeps the guard and
   the logout link in one place. */

import { supabase } from '../../kitchen/js/supabaseClient.js';

export const ADMIN_DASHBOARD = '../../Admin%20Panel/admin/dashboard.html';
export const KITCHEN_LOGIN = 'login.html';

let clientPromise = null;

export function getClient() {
  if (!clientPromise) clientPromise = supabase();
  return clientPromise;
}

/* Returns { sb, session, role, name } or null when redirecting to the login page. */
export async function requireStaff() {
  const sb = await getClient();
  const { data } = await sb.auth.getSession();

  if (!data || !data.session) {
    const here = encodeURIComponent(location.pathname.split('/').pop() + location.hash);
    location.replace(KITCHEN_LOGIN + '?next=' + here);
    return null;
  }

  let role = null;
  let name = data.session.user.email || 'Staff';

  try {
    const { data: profile } = await sb
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.session.user.id)
      .maybeSingle();
    if (profile) {
      role = profile.role || null;
      name = profile.full_name || name;
    }
  } catch (e) {
    /* keep going: the database policies still protect every write */
  }

  return { sb, session: data.session, role, name };
}

export async function signOutNow() {
  const sb = await getClient();
  try {
    await sb.auth.signOut();
  } catch (e) {
    /* even if the server call fails, clear the local copy below */
  }
  Object.keys(localStorage)
    .filter((k) => k.startsWith('sb-') || k.startsWith('kg.'))
    .forEach((k) => localStorage.removeItem(k));
  location.replace(KITCHEN_LOGIN);
}

/* any link/button marked data-logout signs out instead of just navigating */
document.addEventListener('click', (event) => {
  const el = event.target.closest ? event.target.closest('[data-logout]') : null;
  if (!el) return;
  event.preventDefault();
  signOutNow();
});
