// Thin fetch-based client for the pgmanagement FastAPI backend.
// Handles: base URL resolution, Bearer token attachment, JSON parsing,
// normalized error shapes, and a single-flight refresh-on-401 retry.
//
// No axios / react-query here on purpose — the app is small enough that a
// plain fetch wrapper plus per-screen useState/useEffect (see hooks below
// and each screen) is easier to reason about than adding a caching layer.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = '@pgmanager/access_token';
const REFRESH_TOKEN_KEY = '@pgmanager/refresh_token';

function defaultBaseUrl() {
  // Production wins unconditionally — checked first and returns immediately,
  // so a stray/leaked EXPO_PUBLIC_API_URL (e.g. a local .env that shouldn't
  // have been committed) can never override this in a real production build
  // again. This exact ordering bug is what shipped localhost:8000 to prod.
  if (process.env.NODE_ENV === 'production') {
    return 'https://pgmanagement-production.up.railway.app';
  }

  // Local dev only: explicit override, then platform-specific fallback.
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
}

export const API_BASE_URL = defaultBaseUrl();

export class ApiError extends Error {
  constructor(status, message, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

let accessToken = null;
let refreshToken = null;
let refreshPromise = null;
let onSessionExpired = null;

// Called by the store once, so api.js can force a logout when a refresh
// attempt itself fails (refresh token expired/revoked) without importing
// the store here and creating a circular dependency.
export function setOnSessionExpired(fn) {
  onSessionExpired = fn;
}

export async function loadStoredTokens() {
  const [a, r] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  accessToken = a;
  refreshToken = r;
  return { accessToken: a, refreshToken: r };
}

async function setTokens(tokens) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

export function hasStoredSession() {
  return !!accessToken;
}

function buildQuery(params) {
  if (!params) return '';
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function rawRequest(path, { method = 'GET', body, auth = true, skipRefreshOn401 = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Could not reach the server at ${API_BASE_URL}. Check your connection and API URL.`, null);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && auth && !skipRefreshOn401) {
      const refreshed = await tryRefresh();
      if (refreshed) {
        return rawRequest(path, { method, body, auth, skipRefreshOn401: true });
      }
      if (onSessionExpired) onSessionExpired();
    }
    const detail = payload && (payload.detail ?? payload.error);
    const message = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : `Request failed (${response.status})`;
    throw new ApiError(response.status, message, payload);
  }

  return payload;
}

// Concurrent 401s must not each fire their own /auth/refresh call — that
// would race two rotations of the same refresh token against each other
// and fail all but one. Share a single in-flight promise instead.
async function tryRefresh() {
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = rawRequest('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
    })
      .then(async (tokens) => {
        await setTokens(tokens);
        return true;
      })
      .catch(async () => {
        await clearTokens();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  register: (email, password, fullName) =>
    rawRequest('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, full_name: fullName },
      auth: false,
    }),
  login: async (email, password) => {
    const tokens = await rawRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
    await setTokens(tokens);
    return tokens;
  },
  logout: async () => {
    if (refreshToken) {
      try {
        await rawRequest('/api/v1/auth/logout', {
          method: 'POST',
          body: { refresh_token: refreshToken },
          auth: false,
        });
      } catch {
        // Best-effort server-side revoke — always clear local tokens
        // regardless, so the user isn't stuck logged in on this device.
      }
    }
    await clearTokens();
  },
  me: () => rawRequest('/api/v1/auth/me'),
};

// ── Properties ────────────────────────────────────────────
export const propertiesApi = {
  list: () => rawRequest('/api/v1/properties'),
  create: (payload) => rawRequest('/api/v1/properties', { method: 'POST', body: payload }),
  update: (propertyId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}`, { method: 'PATCH', body: payload }),
};

// ── Rooms ─────────────────────────────────────────────────
export const roomsApi = {
  list: (propertyId) => rawRequest(`/api/v1/properties/${propertyId}/rooms`),
  get: (propertyId, roomId) => rawRequest(`/api/v1/properties/${propertyId}/rooms/${roomId}`),
  create: (propertyId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}/rooms`, { method: 'POST', body: payload }),
  update: (propertyId, roomId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}/rooms/${roomId}`, { method: 'PATCH', body: payload }),
  remove: (propertyId, roomId) =>
    rawRequest(`/api/v1/properties/${propertyId}/rooms/${roomId}`, { method: 'DELETE' }),
};

// ── Guests ────────────────────────────────────────────────
export const guestsApi = {
  list: (propertyId, filters) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests${buildQuery(filters)}`),
  get: (propertyId, guestId) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests/${guestId}`),
  create: (propertyId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests`, { method: 'POST', body: payload }),
  update: (propertyId, guestId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests/${guestId}`, { method: 'PATCH', body: payload }),
  moveOut: (propertyId, guestId) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests/${guestId}/move-out`, { method: 'POST' }),
  reactivate: (propertyId, guestId) =>
    rawRequest(`/api/v1/properties/${propertyId}/guests/${guestId}/reactivate`, { method: 'POST' }),
};

// ── Payments ──────────────────────────────────────────────
export const paymentsApi = {
  list: (propertyId, filters) =>
    rawRequest(`/api/v1/properties/${propertyId}/payments${buildQuery(filters)}`),
  create: (propertyId, payload) =>
    rawRequest(`/api/v1/properties/${propertyId}/payments`, { method: 'POST', body: payload }),
  remove: (propertyId, paymentId) =>
    rawRequest(`/api/v1/properties/${propertyId}/payments/${paymentId}`, { method: 'DELETE' }),
};

// ── Stats ─────────────────────────────────────────────────
export const statsApi = {
  dashboard: (propertyId, month) =>
    rawRequest(`/api/v1/properties/${propertyId}/stats/dashboard${buildQuery({ month })}`),
};
