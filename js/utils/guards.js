import { getSession } from "../api/auth.js"

export async function requireRole(allowedRoles) {
  const { data, error } = await getSession()

  if (error || !data) {
    window.location.href = "/html/login.html"
    return null
  }

  if (!allowedRoles.includes(data.role)) {
    window.location.href = "/html/login.html"
    return null
  }

  return data
}
