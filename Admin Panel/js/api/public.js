// js/api/public.js — read-only endpoints shared by admin pages.

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock, normalizeSettings, ok } from './shared.js';

export async function getSettings() {
  return withMock(
    async () => {
      const res = await Mock.public.getSettings();
      return res.error ? res : ok(normalizeSettings(res.data));
    },
    async () => {
      const sb = await supabase();
      const res = fromSupabase(await sb.from('settings').select('*').limit(1).maybeSingle(), { code: 'SETTINGS_FAILED' });
      if (res.error) return res;
      return ok(normalizeSettings(res.data));
    }
  );
}
