// Khabar Golpo — Auth API layer
// All functions call Supabase RPC via the anon key
// Role information comes from profiles table (auth.jwt())

import { SUPABASE_URL, ANON_KEY, MOCK_MODE } from "../config.js"

const headers = {
  "apikey": ANON_KEY,
  "Authorization": `Bearer ${ANON_KEY}`,
  "Content-Type": "application/json",
}

// Mock mode returns fixed shapes for frontend development
const mockLogin = (email, password) => {
  // Simulate successful login for dev
  return Promise.resolve({
    data: { user: { id: "mock-user-id", email }, role: "admin" },
    error: null
  })
}

const mockLogout = () => {
  return Promise.resolve({
    data: true,
    error: null
  })
}

const mockGetSession = () => {
  return Promise.resolve({
    data: { user: { id: "mock-user-id", email: "admin@khabargolpo.test" }, role: "admin" },
    error: null
  })
}

// Real Supabase RPC calls (uncomment when ready)
// const supabase = window.supabase || createSupabaseClient(SUPABASE_URL, ANON_KEY)

// export async function login(email, password) {
//   if (MOCK_MODE) return mockLogin(email, password)
//   // const { data, error } = await supabase.auth.signInWithPassword({ email, password })
//   // return { data, error }
// }

// export async function logout() {
//   if (MOCK_MODE) return mockLogout()
//   // const { error } = await supabase.auth.signOut()
//   // return { error }
// }

// export async function getSession() {
//   if (MOCK_MODE) return mockGetSession()
//   // const { data: { user }, error } = await supabase.auth.getSession()
//   // return { data: { user, role: user?.user.metadata?.role }, error }
// }

// Mock implementations for immediate use
export async function login(email, password) {
  return mockLogin(email, password)
}

export async function logout() {
  return mockLogout()
}

export async function getSession() {
  return mockGetSession()
  // return mockGetSession()
}