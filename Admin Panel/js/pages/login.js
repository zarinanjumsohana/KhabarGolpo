// js/pages/login.js — admin login page.

import { hydrateIcons, icon } from '../utils/icons.js';
import { login, localSession } from '../utils/guards.js';
import { toast, buttonLoading, esc } from '../utils/ui.js';
import { validate, rules, firstError } from '../utils/validate.js';
import { initTheme, toggleTheme, getTheme } from '../utils/theme.js';

const QUOTES = [
  ['“Every dish tells a story — your job is to keep the pages turning.”', 'Khabar Golpo'],
  ['“A busy night is a good night. Open the panel and breathe.”', 'The House Rule'],
  ['“Receipts, tables, feedback — one screen, zero chaos.”', 'Admin Motto'],
  ['“Serve the food, balance the books, close the kitchen.”', 'Night Routine'],
];

let qIndex = 0;

function rotateQuotes() {
  const el = document.getElementById('quote');
  if (!el) return;
  setInterval(() => {
    qIndex = (qIndex + 1) % QUOTES.length;
    const [text, by] = QUOTES[qIndex];
    el.style.animation = 'none';
    void el.offsetWidth;
    el.innerHTML = `${esc(text)}<cite>${esc(by)}</cite>`;
    el.style.animation = 'tickerUp 0.6s var(--ease) both';
  }, 5200);
}

function setError(fieldId, errId, message) {
  const field = document.getElementById(fieldId);
  const err = document.getElementById(errId);
  field.classList.toggle('has-error', !!message);
  err.textContent = message || '';
}

function clearErrors() {
  setError('fEmail', 'eEmail', '');
  setError('fPassword', 'ePassword', '');
}

function shakeForm() {
  const card = document.querySelector('.login-card');
  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

function fill(value) {
  const isEmail = value.includes('@');
  document.getElementById(isEmail ? 'email' : 'password').value = value;
}

function init() {
  initTheme();
  hydrateIcons();
  rotateQuotes();

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const sync = (t = getTheme()) => {
      const next = t === 'dark' ? 'light' : 'dark';
      themeBtn.title = `Switch to ${next} theme`;
      themeBtn.setAttribute('aria-label', `Switch to ${next} theme`);
    };
    sync();
    themeBtn.addEventListener('click', () => sync(toggleTheme()));
  }

  if (localSession()?.role === 'admin') {
    location.replace('./dashboard.html');
    return;
  }

  document.querySelectorAll('[data-fill]').forEach((el) => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => fill(el.dataset.fill));
  });

  const pw = document.getElementById('password');
  const pwToggle = document.getElementById('pwToggle');
  let shown = false;
  pwToggle.addEventListener('click', () => {
    shown = !shown;
    pw.type = shown ? 'text' : 'password';
    pwToggle.innerHTML = icon(shown ? 'eyeOff' : 'eye');
  });

  ['email', 'password'].forEach((id) =>
    document.getElementById(id).addEventListener('input', () => clearErrors())
  );

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { ok, errors } = validate(
      { email: [rules.required('Email'), rules.email()], password: [rules.required('Password')] },
      { email, password }
    );
    if (!ok) {
      setError('fEmail', 'eEmail', errors.email || '');
      setError('fPassword', 'ePassword', errors.password || '');
      shakeForm();
      return;
    }

    const btn = document.getElementById('btnSubmit');
    buttonLoading(btn, true);
    const res = await login({ email, password });
    buttonLoading(btn, false);

    if (res.error) {
      if (res.error.code === 'WRONG_ROLE') {
        setError('fEmail', 'eEmail', res.error.message);
      } else if (res.error.code === 'NO_ACCOUNT') {
        setError('fEmail', 'eEmail', res.error.message);
      } else {
        setError('fPassword', 'ePassword', res.error.message);
      }
      shakeForm();
      toast({ type: 'error', title: 'Sign in failed', message: res.error.message });
      return;
    }

    if (res.data.role !== 'admin') {
      const msg = 'This account belongs to the kitchen panel, not the admin panel.';
      setError('fEmail', 'eEmail', msg);
      shakeForm();
      return;
    }

    toast({ type: 'success', title: 'Welcome back', message: `Signed in as ${res.data.name}.` });
    location.href = './dashboard.html';
  });
}

init();
