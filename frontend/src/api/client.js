const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function setAccessToken(token) {
  localStorage.setItem("access_token", token);
}

export function removeAccessToken() {
  localStorage.removeItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

export function setRefreshToken(token) {
  localStorage.setItem("refresh_token", token);
}

export function removeRefreshToken() {
  localStorage.removeItem("refresh_token");
}

// Endpoints where a 401 means "bad credentials", not "expired session" —
// never attempt a token refresh for these.
const NO_REFRESH_ENDPOINTS = [
  "/auth/login",
  "/auth/register",
  "/auth/token-refresh",
  "/auth/resend-otp",
  "/auth/forgot-password",
  "/auth/reset-password",
];

// Single-flight: concurrent 401s share one refresh request instead of each
// rotating the refresh token (rotation revokes the old one, so parallel
// refreshes would kill each other's sessions).
let refreshPromise = null;

function refreshTokens() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const response = await fetch(`${API_BASE_URL}/auth/token-refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!response.ok) return false;
        const data = await response.json();
        if (!data?.access_token) return false;
        setAccessToken(data.access_token);
        if (data.refresh_token) setRefreshToken(data.refresh_token);
        return true;
      } catch {
        return false;
      }
    })();
    refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function clearSession() {
  removeAccessToken();
  removeRefreshToken();
  // Let AuthContext reset user state so the app routes back to login.
  window.dispatchEvent(new Event("auth:session-expired"));
}

async function request(endpoint, options = {}, isRetry = false) {
  const token = getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = null;

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const rawBody = await response.text();
    data = rawBody ? JSON.parse(rawBody) : null;
  }

  if (!response.ok) {
    const canRefresh =
      response.status === 401 &&
      !isRetry &&
      !NO_REFRESH_ENDPOINTS.some((e) => endpoint.startsWith(e)) &&
      Boolean(getRefreshToken());

    if (canRefresh) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return request(endpoint, options, true);
      }
      clearSession();
    }

    // New backend format: { error: { code, message, timestamp } }
    // Old FastAPI fallback:  { detail: "..." }
    const message =
      data?.error?.message ||
      (typeof data?.detail === "string" ? data.detail : null) ||
      "Something went wrong.";
    throw new Error(message);
  }

  return data;
}

export const apiClient = {
  get(endpoint) {
    return request(endpoint, {
      method: "GET",
    });
  },

  post(endpoint, body) {
    return request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  put(endpoint, body) {
    return request(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return request(endpoint, {
      method: "DELETE",
    });
  },
};
