const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// ── Token storage ─────────────────────────────────────────────────────────────

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

export function clearTokens() {
  removeAccessToken();
  removeRefreshToken();
}

// ── Error message extraction ──────────────────────────────────────────────────

function extractErrorMessage(data) {
  // New backend format: { error: { code, message, timestamp } }
  if (data?.error?.message) return data.error.message;
  // Old FastAPI default format: { detail: "string" }
  if (typeof data?.detail === "string") return data.detail;
  if (data?.detail?.message) return data.detail.message;
  return "Something went wrong.";
}

// ── Token refresh with request deduplication ──────────────────────────────────

let _isRefreshing = false;
let _pendingRequests = [];

function _notifyPending(newToken) {
  _pendingRequests.forEach((cb) => cb(newToken));
  _pendingRequests = [];
}

async function _doTokenRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/token-refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      return null;
    }

    const data = await response.json();
    setAccessToken(data.access_token);
    setRefreshToken(data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

// ── Core request ──────────────────────────────────────────────────────────────

async function request(endpoint, options = {}, _isRetry = false) {
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

  // On 401, attempt a silent token refresh once then retry the original request.
  if (response.status === 401 && !_isRetry) {
    if (_isRefreshing) {
      // Another refresh is already in-flight — queue this request until it resolves.
      return new Promise((resolve, reject) => {
        _pendingRequests.push((newToken) => {
          if (newToken) {
            resolve(request(endpoint, options, true));
          } else {
            reject(new Error("Session expired. Please log in again."));
          }
        });
      });
    }

    _isRefreshing = true;
    try {
      const newToken = await _doTokenRefresh();
      _isRefreshing = false;

      if (newToken) {
        _notifyPending(newToken);
        return request(endpoint, options, true);
      }

      _notifyPending(null);
      throw new Error("Session expired. Please log in again.");
    } catch (err) {
      _isRefreshing = false;
      _notifyPending(null);
      throw err instanceof Error ? err : new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data));
  }

  return data;
}

// ── Public API client ─────────────────────────────────────────────────────────

export const apiClient = {
  get(endpoint) {
    return request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return request(endpoint, { method: "POST", body: JSON.stringify(body) });
  },

  patch(endpoint, body) {
    return request(endpoint, { method: "PATCH", body: JSON.stringify(body) });
  },

  put(endpoint, body) {
    return request(endpoint, { method: "PUT", body: JSON.stringify(body) });
  },

  delete(endpoint) {
    return request(endpoint, { method: "DELETE" });
  },
};
