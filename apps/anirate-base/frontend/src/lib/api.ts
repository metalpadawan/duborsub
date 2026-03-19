// src/lib/api.ts
// Axios instance with:
//   - auto-attach Authorization header
//   - silent token refresh on 401
//   - request deduplication during refresh

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

// ── Token store (in-memory only — never localStorage) ────────
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t: string | null) => { accessToken = t; },
  clear: () => { accessToken = null; },
};

// ── Axios instance ────────────────────────────────────────────
export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends httpOnly refresh cookie
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ── Request interceptor: attach access token ─────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle 401 with token refresh ──────
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;

    // Deduplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = api
        .post<{ accessToken: string }>('/auth/refresh')
        .then((r) => {
          tokenStore.set(r.data.accessToken);
          return r.data.accessToken;
        })
        .catch(() => {
          tokenStore.clear();
          // Redirect to login if refresh fails
          if (typeof window !== 'undefined') window.location.href = '/login';
          return null;
        })
        .finally(() => { refreshPromise = null; });
    }

    const newToken = await refreshPromise;
    if (!newToken) return Promise.reject(error);

    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  },
);

// ── Typed endpoint helpers ────────────────────────────────────
export const authApi = {
  register: (data: RegisterPayload) => api.post('/auth/register', data),
  login: (data: LoginPayload) =>
    api.post<{ user: User; accessToken: string }>('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

export const animeApi = {
  list: (params?: AnimeQuery) => api.get<PaginatedAnime>('/anime', { params }),
  get: (id: string) => api.get<AnimeDetail>(`/anime/${id}`),
  create: (data: CreateAnimePayload) => api.post<Anime>('/anime', data),
  update: (id: string, data: Partial<CreateAnimePayload>) => api.patch<Anime>(`/anime/${id}`, data),
  delete: (id: string) => api.delete(`/anime/${id}`),
};

export const ratingsApi = {
  upsert: (animeId: string, data: { subRating?: number; dubRating?: number }) =>
    api.post(`/anime/${animeId}/ratings`, data),
  mine: (animeId: string) => api.get(`/anime/${animeId}/ratings/me`),
  remove: (animeId: string) => api.delete(`/anime/${animeId}/ratings`),
  distribution: (animeId: string) => api.get(`/anime/${animeId}/ratings/distribution`),
};

export const commentsApi = {
  list: (animeId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/anime/${animeId}/comments`, { params }),
  create: (animeId: string, data: { content: string; parentId?: string }) =>
    api.post(`/anime/${animeId}/comments`, data),
  update: (animeId: string, commentId: string, content: string) =>
    api.patch(`/anime/${animeId}/comments/${commentId}`, { content }),
  delete: (animeId: string, commentId: string) =>
    api.delete(`/anime/${animeId}/comments/${commentId}`),
  like: (animeId: string, commentId: string, value: 1 | -1) =>
    api.post(`/anime/${animeId}/comments/${commentId}/like`, { value }),
  unlike: (animeId: string, commentId: string) =>
    api.delete(`/anime/${animeId}/comments/${commentId}/like`),
};

// ── Types ─────────────────────────────────────────────────────
export interface User {
  id: string; username: string; email: string; role: 'user' | 'admin';
}
export interface RegisterPayload { username: string; email: string; password: string; }
export interface LoginPayload { email: string; password: string; }
export interface Anime {
  id: string; title: string; coverImageUrl?: string; releaseYear?: number;
  status: string; hasDub: boolean; avgSubRating?: number; avgDubRating?: number;
  totalVotes: number; genres: { id: number; name: string }[];
}
export interface AnimeDetail extends Anime { description?: string; }
export interface PaginatedAnime {
  items: Anime[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
export interface AnimeQuery {
  search?: string; status?: string; year?: number; genreId?: number;
  sortBy?: string; order?: string; page?: number; limit?: number;
}
export interface CreateAnimePayload {
  title: string; description?: string; coverImageUrl?: string; releaseYear?: number;
  hasDub?: boolean; status?: string; genreIds?: number[];
}
