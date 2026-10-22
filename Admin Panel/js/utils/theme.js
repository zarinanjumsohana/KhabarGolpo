// js/utils/theme.js — light / dark theme with localStorage persistence.

export const THEME_KEY = 'kg.admin.theme';

const listeners = new Set();

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function systemTheme() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

export function storedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.setAttribute('data-theme', t);
  root.style.colorScheme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#080b14' : '#f4f1ea');
  listeners.forEach((fn) => {
    try {
      fn(t);
    } catch (e) {
      /* listener errors must never break theming */
    }
  });
  return t;
}

export function setTheme(theme, { persist = true } = {}) {
  const t = theme === 'dark' ? 'dark' : 'light';
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) {
      /* private mode — theme stays for this session only */
    }
  }
  return applyTheme(t);
}

export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function initTheme() {
  applyTheme(storedTheme() || systemTheme());
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (!storedTheme()) applyTheme(systemTheme());
    });
  } catch (e) {
    /* older browsers: no live system tracking */
  }
  return getTheme();
}
