// This file centralizes frontend API access.
// It also owns access-token memory storage and automatic refresh retry behavior.
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  skipAuthRefresh?: boolean;
};

const AUTH_REFRESH_EXCLUDED_PATHS = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
]);

function normalizeRequestPath(url?: string) {
  if (!url) {
    return '';
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  return url.startsWith('/') ? url : `/${url}`;
}

function shouldSkipAuthRefresh(config?: RetryableConfig) {
  if (!config) {
    return true;
  }

  if (config.skipAuthRefresh) {
    return true;
  }

  return AUTH_REFRESH_EXCLUDED_PATHS.has(normalizeRequestPath(config.url));
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) {
    // Authorization is attached lazily so public requests stay clean.
    const headers = config.headers as any;
    headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    if (
      !original ||
      error.response?.status !== 401 ||
      original._retry ||
      shouldSkipAuthRefresh(original)
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    if (!refreshPromise) {
      // Concurrent 401s should wait on one refresh request instead of stampeding the API.
      refreshPromise = api
        .post<{ accessToken: string }>('/auth/refresh', undefined, {
          skipAuthRefresh: true,
        } as RetryableConfig)
        .then((response) => {
          tokenStore.set(response.data.accessToken);
          return response.data.accessToken;
        })
        .catch(() => {
          tokenStore.clear();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return null;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newToken = await refreshPromise;
    if (!newToken) {
      return Promise.reject(error);
    }

    const headers = original.headers as any;
    headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  },
);

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post('/auth/register', data, { skipAuthRefresh: true } as RetryableConfig),
  login: (data: LoginPayload) =>
    api.post<{ user: User; accessToken: string }>('/auth/login', data, {
      skipAuthRefresh: true,
    } as RetryableConfig),
  refresh: () =>
    api.post<{ accessToken: string }>('/auth/refresh', undefined, {
      skipAuthRefresh: true,
    } as RetryableConfig),
  logout: () => api.post('/auth/logout', undefined, { skipAuthRefresh: true } as RetryableConfig),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }, { skipAuthRefresh: true } as RetryableConfig),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }, { skipAuthRefresh: true } as RetryableConfig),
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
  mine: (animeId: string) => api.get('/anime/' + animeId + '/ratings/me'),
  remove: (animeId: string) => api.delete(`/anime/${animeId}/ratings`),
  distribution: (animeId: string) => api.get(`/anime/${animeId}/ratings/distribution`),
};

export const commentsApi = {
  list: (animeId: string, params?: { page?: number; limit?: number }) =>
    api.get<CommentListResponse>(`/anime/${animeId}/comments`, { params }),
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

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface Genre {
  id: number;
  name: string;
}

export interface Anime {
  id: string;
  title: string;
  coverImageUrl?: string | null;
  releaseYear?: number | null;
  status: string;
  hasDub: boolean;
  avgSubRating?: number | null;
  avgDubRating?: number | null;
  totalVotes: number;
  genres: Genre[];
}

export interface AnimeDetail extends Anime {
  description?: string;
}

export interface PaginatedAnime {
  items: Anime[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AnimeQuery {
  search?: string;
  status?: string;
  year?: number;
  genreId?: number;
  sortBy?: string;
  order?: string;
  page?: number;
  limit?: number;
}

export interface CreateAnimePayload {
  title: string;
  description?: string;
  coverImageUrl?: string;
  releaseYear?: number;
  hasDub?: boolean;
  status?: string;
  genreIds?: number[];
}

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; username: string } | null;
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    user: { id: string; username: string } | null;
  }>;
  _count: {
    likes: number;
  };
}

export interface CommentListResponse {
  items: CommentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
