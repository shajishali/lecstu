import { create } from 'zustand';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '@services/authToken';
import api, { tryRefreshSession, resetAuthRefreshState } from '@services/api';
import type { User, LoginRequest, RegisterRequest, AuthResponse } from '../types/auth';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Pass `{ silent: true }` to refresh user without toggling global `isLoading` (avoids unmounting the whole app). */
  getMe: (opts?: { silent?: boolean }) => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
}

function getPrimaryGroupKey(user: User | null | undefined): string | undefined {
  const membership = user?.studentGroupMemberships?.[0];
  if (!membership?.group?.id) return undefined;
  return `${membership.group.id}:${membership.selectedBatchYearLabel ?? ''}`;
}

let bootstrapSessionPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    const res = await api.post<AuthResponse>('/auth/login', data, {
      validateStatus: (status) => status < 500,
    });
    if (res.status === 401 || !res.data?.data?.accessToken) {
      set({
        isLoading: false,
        error: res.data?.message || 'Invalid email or password',
      });
      return;
    }
    setAccessToken(res.data.data.accessToken);
    if (res.data.data.refreshToken) setRefreshToken(res.data.data.refreshToken);
    resetAuthRefreshState();
    set({
      user: res.data.data.user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/register', data);
      setAccessToken(res.data.data.accessToken);
      if (res.data.data.refreshToken) setRefreshToken(res.data.data.refreshToken);
      resetAuthRefreshState();
      set({
        user: res.data.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || 'Registration failed',
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // proceed with local cleanup even if request fails
    }
    clearAuthTokens();
    resetAuthRefreshState();
    set({ user: null, isAuthenticated: false, error: null });
  },

  getMe: async (opts) => {
    const silent = opts?.silent === true;
    const run = async () => {
      if (!silent) {
        set({ isLoading: true });
      }
      try {
        if (!getAccessToken() && !getRefreshToken()) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        if (!getAccessToken() && getRefreshToken()) {
          await tryRefreshSession();
        }

        const res = await api.get<{ success: boolean; data: { user: User | null } }>('/auth/me');
        const user = res.data.data.user;
        const prevGroupId = getPrimaryGroupKey(get().user);
        const nextGroupId = getPrimaryGroupKey(user);
        set({
          user: user ?? null,
          isAuthenticated: !!user,
          isLoading: false,
        });
        if (!user) clearAuthTokens();
        if (prevGroupId !== nextGroupId && nextGroupId) {
          window.dispatchEvent(new CustomEvent('timetable-updated'));
        }
      } catch {
        clearAuthTokens();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    };

    if (silent) {
      await run();
      return;
    }

    if (!bootstrapSessionPromise) {
      bootstrapSessionPromise = run().finally(() => {
        bootstrapSessionPromise = null;
      });
    }
    await bootstrapSessionPromise;
  },

  setUser: (user: User) => {
    const prevGroupId = getPrimaryGroupKey(get().user);
    const nextGroupId = getPrimaryGroupKey(user);
    set({ user, isAuthenticated: true });
    if (prevGroupId !== nextGroupId && nextGroupId) {
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  },
  clearError: () => set({ error: null }),
}));
