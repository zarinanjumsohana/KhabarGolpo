// Khabar Golpo — Config
// SUPABASE_URL and ANON_KEY from your Supabase project dashboard
// SITE_URL is the deployed site URL (or localhost for dev)
// MOCK_MODE: true = return mock data (frontend can build before DB is ready)
// MOCK_MODE: false = call real Supabase RPCs

// Farjana: import mock data from './js/mock/api.js' in your page scripts
// when MOCK_MODE=true. The API layer (js/api/*.js) auto-switches based on
// this flag — no need to manually import in each page.

export const SUPABASE_URL = "https://<your-project>.supabase.co"
export const ANON_KEY = "your-anon-key-here"
export const SITE_URL = "https://khabargolpo.vercel.app" // change to your domain
export const MOCK_MODE = true // set to false when ready for real data