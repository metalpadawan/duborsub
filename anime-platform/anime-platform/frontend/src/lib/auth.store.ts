// src/lib/auth.store.ts
// Zustand auth store — persists user info in memory,
// access token in memory, refresh token in httpOnly cookie

import { create } from 'zustand';
import { authApi, tokenStore, User } from './api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    tokenStore.set(data.accessToken);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (username, email, password) => {
    await authApi.register({ username, email, password });
  },

  logout: async () => {
    await authApi.logout().catch(() => null);
    tokenStore.clear();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      // Try to get a fresh access token via the refresh cookie
      const { data: refreshData } = await import('./api').then((m) =>
        m.api.post<{ accessToken: string }>('/auth/refresh'),
      );
      tokenStore.set(refreshData.accessToken);

      const { data: user } = await authApi.me();
      set({ user, isAuthenticated: true });
    } catch {
      tokenStore.clear();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
