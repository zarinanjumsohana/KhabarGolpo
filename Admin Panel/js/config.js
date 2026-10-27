// js/config.js — single place for environment switches.
// Only the PUBLIC anon key may ever live here. Never the service_role key.

export const CONFIG = {
  SUPABASE_URL: 'https://ewsvwxgoyfbsnhsrxnoo.supabase.co',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c3Z3eGdveWZic25oc3J4bm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3NzA1MzAsImV4cCI6MjEwNzM0NjUzMH0.cayec-Xi35TDqfGvjgGhWtuJO_VRd2jcHnHo-5d5AwY',
  SITE_URL: 'https://khabar-golpo.vercel.app',
  APP_NAME: 'Khabar Golpo',
  CURRENCY: '৳',
  TIMEZONE: 'Asia/Dhaka',
  MOCK_MODE: false,
  ORDER_REALTIME_MS: 45000,
};

export const SUPABASE_URL = CONFIG.SUPABASE_URL;
export const ANON_KEY = CONFIG.ANON_KEY;
export const SITE_URL = CONFIG.SITE_URL;
export const MOCK_MODE = CONFIG.MOCK_MODE;

export const isMock = () => CONFIG.MOCK_MODE === true;
