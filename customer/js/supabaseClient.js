// js/supabaseClient.js
// Pages must NEVER import this file. Only js/api/* may use it.

import { CONFIG, isMock } from './config.js';

let clientPromise = null;

export function supabase() {
  if (isMock()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(
      (mod) => {
        const { createClient } = mod;
        return createClient(CONFIG.SUPABASE_URL, CONFIG.ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
      }
    );
  }
  return clientPromise;
}
