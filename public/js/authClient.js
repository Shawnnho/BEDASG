// authClient.js — shared helper for cookie-based auth.
// Include this BEFORE index.js / authNav.js / any page that needs to know
// who's logged in.

const AuthClient = (function () {
  async function apiFetch(url, options = {}) {
    // credentials: "include" ensures cookies are sent even if you ever move
    // the front-end to a different subdomain/port than the API.
    return fetch(url, { ...options, credentials: "include" });
  }

  // Returns the logged-in user object, or null if not logged in.
  // Automatically tries ONE silent refresh if the access token has expired,
  // so a page load a few minutes into a session doesn't just log the user out.
  async function getCurrentUser() {
    let res = await apiFetch("/api/auth/me");

    if (res.status === 401 || res.status === 403) {
      const refreshRes = await apiFetch("/api/auth/refresh", { method: "POST" });
      if (refreshRes.ok) {
        res = await apiFetch("/api/auth/me");
      }
    }

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data ? data.user : null;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
  }

  return { apiFetch, getCurrentUser, logout };
})();
