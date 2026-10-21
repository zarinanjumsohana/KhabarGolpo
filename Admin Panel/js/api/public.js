// js/api/public.js — read-only endpoints shared by admin pages.

import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { fromSupabase, withMock } from './shared.js';

export async function getSettings() {
  return withMock(
    () => Mock.public.getSettings(),
    async () => {
      const sb = await supabase();
      return fromSupabase(await sb.from('settings').select('*').limit(1).maybeSingle(), { code: 'SETTINGS_FAILED' });
    }
  );
}
