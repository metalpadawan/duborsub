// This store keeps the frontend's authentication state in one place.
// The access token only lives in memory, while the refresh token stays in
// the browser cookie managed by the backend.

import { create } from 'zustand';
import { authApi, refreshAccessToken, tokenStore, User } from './api';

// The refresh cookie is httpOnly, so the page cannot see whether one exists. This
// flag remembers a sign-in, so a visitor who never signed in is not sent through a
// refresh request (and a 401) on every page.
const SESSION_HINT = 'anirate.session';

function hasSessionHint() {
  try {
    return window.localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    // Storage blocked: fall back to always checking.
    return true;
  }
}

function setSessionHint(signedIn: boolean) {
  try {
    if (signedIn) window.localStorage.setItem(SESSION_HINT, '1');
    else window.localStorage.removeItem(SESSION_HINT);
  } catch {
    // Storage blocked: nothing to remember.
  }
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  /** Re-reads the account, for example after the email address is confirmed. */
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await authApi.login({ email, password });
    tokenStore.set(data.accessToken);
    setSessionHint(true);
    set({ user: data.user, isAuthenticated: true });
  },

  register: async (username, email, password) => {
    await authApi.register({ username, email, password });
  },

  logout: async () => {
    // Logout should clear local state even if the server cookie is already gone.
    await authApi.logout().catch(() => null);
    tokenStore.clear();
    setSessionHint(false);
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    if (!hasSessionHint()) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      // On a hard refresh we no longer have the in-memory access token, so we
      // first ask the backend to rotate the refresh cookie into a new token.
      // This shares the API client's single-flight refresh so it never races the interceptor.
      await refreshAccessToken();

      // Once a fresh token exists, we can safely ask for the current user.
      const { data: user } = await authApi.me();
      set({ user, isAuthenticated: true });
    } catch {
      // Any refresh or profile failure means we should treat the session as signed out.
      tokenStore.clear();
      setSessionHint(false);
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  refreshUser: async () => {
    const { data: user } = await authApi.me();
    set({ user, isAuthenticated: true });
  },
}));
