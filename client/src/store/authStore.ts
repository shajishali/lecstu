import { create } from 'zustand';
import api from '@services/api';
import {
  clearAuthTokens,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
} from '@services/authToken';
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

function getPrimaryGroupId(user: User | null | undefined): string | undefined {
  return user?.studentGroupMemberships?.[0]?.group?.id;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/login', data);
      setAccessToken(res.data.data.accessToken);
      if (res.data.data.refreshToken) setRefreshToken(res.data.data.refreshToken);
      set({
        user: res.data.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.response?.data?.message || 'Login failed',
      });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post<AuthResponse>('/auth/register', data);
      setAccessToken(res.data.data.accessToken);
      if (res.data.data.refreshToken) setRefreshToken(res.data.data.refreshToken);
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
    set({ user: null, isAuthenticated: false, error: null });
  },

  getMe: async (opts) => {
    const silent = opts?.silent === true;
    if (!silent) {
      set({ isLoading: true });
    }
    try {
      if (!getAccessToken()) {
        await api.post('/auth/refresh').catch(() => {});
      }
      let res = await api.get<{ success: boolean; data: { user: User | null } }>('/auth/me');
      let user = res.data.data.user;
      if (!user) {
        try {
          await api.post('/auth/refresh');
          res = await api.get('/auth/me');
          user = res.data.data.user;
        } catch {
          /* no valid session */
        }
      }
      const prevGroupId = getPrimaryGroupId(get().user);
      const nextGroupId = getPrimaryGroupId(user);
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
  },

  setUser: (user: User) => {
    const prevGroupId = getPrimaryGroupId(get().user);
    const nextGroupId = getPrimaryGroupId(user);
    set({ user, isAuthenticated: true });
    if (prevGroupId !== nextGroupId && nextGroupId) {
      window.dispatchEvent(new CustomEvent('timetable-updated'));
    }
  },
  clearError: () => set({ error: null }),
}));
