const ACCESS_KEY = 'lecstu_access_token';
const REFRESH_KEY = 'lecstu_refresh_token';

let accessToken: string | null = null;
let refreshToken: string | null = null;

/** In-memory + sessionStorage so API auth works when httpOnly cookies are missing (common in Vite dev). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) sessionStorage.setItem(ACCESS_KEY, token);
    else sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    /* private mode / storage blocked */
  }
}

export function setRefreshToken(token: string | null): void {
  refreshToken = token;
  try {
    if (token) sessionStorage.setItem(REFRESH_KEY, token);
    else sessionStorage.removeItem(REFRESH_KEY);
  } catch {
    /* private mode / storage blocked */
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    accessToken = sessionStorage.getItem(ACCESS_KEY);
  } catch {
    accessToken = null;
  }
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  try {
    refreshToken = sessionStorage.getItem(REFRESH_KEY);
  } catch {
    refreshToken = null;
  }
  return refreshToken;
}

export function clearAuthTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

/** True when missing, malformed, or within `bufferSec` of expiry. */
export function isAccessTokenExpired(bufferSec = 30): boolean {
  const token = getAccessToken();
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now() + bufferSec * 1000;
  } catch {
    return true;
  }
}
