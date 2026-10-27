// Khabar Golpo — Kitchen Auth API layer
// Role information comes from profiles table (auth.jwt())

import { isMock } from "../config.js";
import { supabase } from "../supabaseClient.js";

const mockLogin = (email, password) => {
  return Promise.resolve({
    data: { user: { id: "mock-chef-id", email }, role: "chef" },
    error: null
  });
};

const mockLogout = () => {
  return Promise.resolve({ data: true, error: null });
};

const mockGetSession = () => {
  return Promise.resolve({
    data: { user: { id: "mock-chef-id", email: "chef@khabargolpo.test" }, role: "chef" },
    error: null
  });
};

export async function login(email, password) {
  if (isMock()) return mockLogin(email, password);
  const sb = await supabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: { code: 'INVALID_CREDENTIALS', message: error.message } };
  
  const { data: profile } = await sb.from('profiles').select('role, full_name').eq('id', data.user.id).single();
  return {
    data: {
      user: data.user,
      role: profile?.role || 'chef',
      name: profile?.full_name || data.user.email
    },
    error: null
  };
}

export async function logout() {
  if (isMock()) return mockLogout();
  const sb = await supabase();
  const { error } = await sb.auth.signOut();
  return { data: !error, error: error ? { code: 'SIGNOUT_FAILED', message: error.message } : null };
}

export async function getSession() {
  if (isMock()) return mockGetSession();
  const sb = await supabase();
  const { data: { session }, error } = await sb.auth.getSession();
  if (error || !session) return { data: null, error: error ? { code: 'NO_SESSION', message: error.message } : null };

  const { data: profile } = await sb.from('profiles').select('role, full_name').eq('id', session.user.id).single();
  return {
    data: {
      user: session.user,
      role: profile?.role || null,
      name: profile?.full_name || session.user.email
    },
    error: null
  };
}
