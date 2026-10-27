// js/api/auth.js — login / logout / session / role.

import { isMock } from '../config.js';
import { supabase } from '../supabaseClient.js';
import { Mock } from '../mock/index.js';
import { ok, fail, fromSupabase, friendly, withMock } from './shared.js';

export async function signIn({ email, password }) {
  return withMock(
    () => Mock.auth.signIn({ email, password }),
    async () => {
      const sb = await supabase();
      const res = await sb.auth.signInWithPassword({ email, password });
      if (res.error) return fail('INVALID_CREDENTIALS', friendly(res.error.message));
      const profile = await getProfile();
      if (profile.error) return fail('NO_PROFILE', 'Your account is not set up yet. Ask the owner to create your profile.');
      // The account's role decides which panel opens next (admin panel or kitchen panel),
      // so both kinds of staff can sign in from this page.
      return ok({
        email: res.data.user.email,
        role: profile.data.role,
        name: profile.data.full_name || res.data.user.email,
      });
    }
  );
}

export async function signOut() {
  return withMock(
    () => Mock.auth.signOut(),
    async () => {
      const sb = await supabase();
      return fromSupabase(await sb.auth.signOut(), { code: 'SIGNOUT_FAILED' });
    }
  );
}

export async function getSession() {
  if (isMock()) return null;
  const sb = await supabase();
  const { data } = await sb.auth.getSession();
  const s = data?.session;
  return s ? { email: s.user.email } : null;
}

export async function getProfile() {
  return withMock(
    () => Mock.auth.getProfile(),
    async () => {
      const sb = await supabase();
      const { data: auth } = await sb.auth.getUser();
      if (!auth?.user) return fail('NO_SESSION', 'Not logged in.');
      const res = await sb.from('profiles').select('role, full_name').eq('id', auth.user.id).single();
      if (res.error) return fail('NO_PROFILE', friendly(res.error.message));
      return ok(res.data);
    }
  );
}
