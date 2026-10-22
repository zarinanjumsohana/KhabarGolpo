// js/config.js — single place for environment switches.
// Only the PUBLIC anon key may ever live here. Never the service_role key.

export const CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  ANON_KEY: 'YOUR_ANON_KEY',
  SITE_URL: 'https://khabar-golpo.vercel.app',
  APP_NAME: 'Khabar Golpo',
  CURRENCY: '৳',
  TIMEZONE: 'Asia/Dhaka',
  MOCK_MODE: true,
  ORDER_REALTIME_MS: 45000,
};

export const isMock = () => CONFIG.MOCK_MODE === true;
