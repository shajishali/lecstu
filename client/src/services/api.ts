import axios from 'axios';
import { showToast } from '@components/Toast';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  isAccessTokenExpired,
  setAccessToken,
  setRefreshToken,
} from '@services/authToken';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const SKIP_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/me',
  '/auth/registration/send-code',
  '/auth/registration/verify-code',
  '/auth/forgot-password',
  '/auth/verify-reset-code',
  '/auth/reset-password',
  '/settings/public',
];

let last403Toast = 0;
const TOAST_COOLDOWN_MS = 5000;

let refreshPromise: Promise<string | null> | null = null;
let refreshFailed = false;

async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = getRefreshToken();
  if (!storedRefresh) {
    clearAuthTokens();
    return null;
  }
  if (refreshFailed) {
    return null;
  }
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ success: boolean; data?: { accessToken?: string; refreshToken?: string } }>(
        '/auth/refresh',
        { refreshToken: storedRefresh },
        { validateStatus: (status) => status < 500 },
      )
      .then((res) => {
        if (res.status !== 200) {
          refreshFailed = true;
          clearAuthTokens();
          return null;
        }
        refreshFailed = false;
        const token = res.data?.data?.accessToken ?? null;
        const nextRefresh = res.data?.data?.refreshToken ?? null;
        if (token) setAccessToken(token);
        if (nextRefresh) setRefreshToken(nextRefresh);
        return token;
      })
      .catch(() => {
        refreshFailed = true;
        clearAuthTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Refresh tokens only when a refresh token exists. Returns true if access token is available after. */
export async function tryRefreshSession(): Promise<boolean> {
  if (getAccessToken() && !isAccessTokenExpired()) {
    return true;
  }
  if (!getRefreshToken()) {
    return false;
  }
  const token = await refreshAccessToken();
  return Boolean(token);
}

export function resetAuthRefreshState(): void {
  refreshFailed = false;
}

api.interceptors.request.use(async (config) => {
  const path = config.url || '';
  const isAuthRoute = SKIP_REFRESH.some((p) => path.includes(p));
  if (!isAuthRoute && isAccessTokenExpired()) {
    if (!getRefreshToken()) {
      clearAuthTokens();
    } else {
      await refreshAccessToken();
    }
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const access = response.data?.data?.accessToken;
    const refresh = response.data?.data?.refreshToken;
    if (access && typeof access === 'string') setAccessToken(access);
    if (refresh && typeof refresh === 'string') setRefreshToken(refresh);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestPath = originalRequest?.url || '';

    const shouldSkip =
      originalRequest._retry ||
      SKIP_REFRESH.some((p) => requestPath.includes(p));

    if (error.response?.status === 401 && !shouldSkip) {
      originalRequest._retry = true;
      const token = await refreshAccessToken();
      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }
      clearAuthTokens();
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/forgot-password') &&
          !window.location.pathname.startsWith('/reset-password')) {
        showToast('info', 'Your session expired. Please sign in again.');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      const now = Date.now();
      if (now - last403Toast > TOAST_COOLDOWN_MS) {
        last403Toast = now;
        showToast('error', "You don't have permission for this action.");
      }
      (error as { _403Handled?: boolean })._403Handled = true;
    }

    return Promise.reject(error);
  }
);

/** Use when showing API errors - skips toast for 403 (handled by interceptor) */
export function showApiErrorToast(err: unknown, fallback: string) {
  const e = err as {
    _403Handled?: boolean;
    code?: string;
    message?: string;
    response?: { status?: number; data?: { message?: string } };
  };
  if (e?._403Handled || e?.response?.status === 403) return;
  if (!e?.response && (e?.code === 'ECONNREFUSED' || e?.code === 'ERR_NETWORK')) {
    showToast('error', 'Could not reach the server. Check that the backend is running and try again.');
    return;
  }
  showToast('error', e?.response?.data?.message || fallback);
}

export default api;
