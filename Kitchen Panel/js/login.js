/* KhabarGolpo kitchen — chef sign in.
   Real Supabase Auth: the password is checked by the database, and the
   account's profile role decides the panel (chef -> kitchen, admin -> admin). */

import { getClient, ADMIN_DASHBOARD } from './session.js';

const DASHBOARD = 'index.html';

const form = document.getElementById('loginForm');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const errorEl = document.getElementById('loginError');
const submitBtn = document.getElementById('loginSubmit');

/* only pages in this folder may be used as the post-login destination */
const nextUrl = (() => {
  const raw = new URLSearchParams(location.search).get('next');
  return raw && /^(index|completed)\.html(#[\w-]+)?$/.test(raw) ? raw : null;
})();

const show = (message) => {
  if (errorEl) errorEl.textContent = message || '';
};

const busy = (on) => {
  if (!submitBtn) return;
  submitBtn.disabled = on;
  submitBtn.textContent = on ? 'Signing in...' : 'Sign in';
};

function go(role) {
  if (role === 'chef') location.replace(nextUrl || DASHBOARD);
  else if (role === 'admin') location.replace(ADMIN_DASHBOARD);
  else {
    show('This account has no staff role yet. Ask the owner to finish setting it up.');
    busy(false);
  }
}

async function roleOf(sb, userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return data ? data.role : null;
}

async function boot() {
  const sb = await getClient();
  if (!sb) {
    show('The database is not configured.');
    return;
  }

  /* already signed in? go straight to the right panel */
  const { data } = await sb.auth.getSession();
  if (data && data.session) {
    const role = await roleOf(sb, data.session.user.id);
    if (role) {
      go(role);
      return;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    show('');

    const email = emailEl.value.trim();
    const password = passEl.value;

    if (!email || !password) {
      show('Enter your email and password.');
      return;
    }

    busy(true);
    const { data: auth, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      const message = /invalid login credentials/i.test(error.message || '')
        ? 'Wrong email or password.'
        : error.message || 'Sign in failed.';
      show(message);
      busy(false);
      passEl.value = '';
      passEl.focus();
      return;
    }

    const role = await roleOf(sb, auth.user.id);
    if (!role) {
      await sb.auth.signOut();
      show('This account has no staff profile yet. Ask the owner to finish setting it up.');
      busy(false);
      return;
    }

    go(role);
  });
}

boot();
