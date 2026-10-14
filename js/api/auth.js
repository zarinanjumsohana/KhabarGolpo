
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

export async function login(email, password) {
  return mockLogin(email, password)
}

export async function logout() {
  return mockLogout()
}

export async function getSession() {
  return mockGetSession()
  
}