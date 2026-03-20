// This store keeps the frontend's authentication state in one place.
// The access token only lives in memory, while the refresh token stays in
// the browser cookie managed by the backend.

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
    // Logout should clear local state even if the server cookie is already gone.
    await authApi.logout().catch(() => null);
    tokenStore.clear();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      // On a hard refresh we no longer have the in-memory access token, so we
      // first ask the backend to rotate the refresh cookie into a new token.
      const { data: refreshData } = await authApi.refresh();
      tokenStore.set(refreshData.accessToken);

      // Once a fresh token exists, we can safely ask for the current user.
      const { data: user } = await authApi.me();
      set({ user, isAuthenticated: true });
    } catch {
      // Any refresh or profile failure means we should treat the session as signed out.
      tokenStore.clear();
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
