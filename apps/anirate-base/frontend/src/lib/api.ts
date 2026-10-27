// This file centralizes frontend API access.
// It also owns access-token memory storage and automatic refresh retry behavior.
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const LOCAL_API_FALLBACK = 'http://localhost:4000/api/v1';

function resolveBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const candidate = configuredUrl || (process.env.NODE_ENV !== 'production' ? LOCAL_API_FALLBACK : '');

  if (!candidate) {
    throw new Error('NEXT_PUBLIC_API_URL must be configured');
  }

  let parsed: URL;

  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be a valid absolute URL');
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLocal)) {
    throw new Error('NEXT_PUBLIC_API_URL must use HTTPS outside local development');
  }

  return parsed.toString().replace(/\/$/, '');
}

const BASE_URL = resolveBaseUrl();

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
let refreshPromise: Promise<string> | null = null;

const CONCURRENT_REFRESH_RETRY_MS = 300;

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

    let newToken: string;
    try {
      newToken = await refreshAccessToken();
    } catch {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const headers = original.headers as any;
    headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  },
);

function postRefresh() {
  return api.post<{ accessToken: string }>('/auth/refresh', undefined, {
    skipAuthRefresh: true,
  } as RetryableConfig);
}

// Every refresh in this tab goes through one in-flight request. If another tab
// rotated the cookie at the same moment, the server rejects our now-stale token
// with a 401 without ending the session; by then the browser holds the new
// cookie, so one short retry picks it up.
export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = postRefresh()
      .catch(async (error) => {
        if (error?.response?.status !== 401) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, CONCURRENT_REFRESH_RETRY_MS));
        return postRefresh();
      })
      .then((response) => {
        tokenStore.set(response.data.accessToken);
        return response.data.accessToken;
      })
      .catch((error) => {
        tokenStore.clear();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export const authApi = {
  register: (data: RegisterPayload) =>
    api.post('/auth/register', data, { skipAuthRefresh: true } as RetryableConfig),
  login: (data: LoginPayload) =>
    api.post<{ user: User; accessToken: string }>('/auth/login', data, {
      skipAuthRefresh: true,
    } as RetryableConfig),
  logout: () => api.post('/auth/logout', undefined, { skipAuthRefresh: true } as RetryableConfig),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }, { skipAuthRefresh: true } as RetryableConfig),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }, { skipAuthRefresh: true } as RetryableConfig),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }, { skipAuthRefresh: true } as RetryableConfig),
  resendVerification: () => api.post('/auth/resend-verification'),
  deleteAccount: (password: string) => api.delete('/auth/me', { data: { password } }),
};

export const titleRequestsApi = {
  create: (data: { title: string; details?: string; link?: string; website?: string }) =>
    api.post<TitleRequestResult>('/title-requests', data, { skipAuthRefresh: true } as RetryableConfig),
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

export const dubApi = {
  state: (animeId: string) => api.get<DubState>(`/anime/${animeId}/dub`),
  mine: (animeId: string) => api.get<DubState>(`/anime/${animeId}/dub/me`),
  report: (animeId: string) => api.post<DubState>(`/anime/${animeId}/dub/reports`),
  withdraw: (animeId: string) => api.delete<DubState>(`/anime/${animeId}/dub/reports`),
};

export const myRatingsApi = {
  list: (page = 1) => api.get<Paginated<MyRatingItem>>('/me/ratings', { params: { page, limit: 20 } }),
};

export const adminApi = {
  dashboard: () => api.get<AdminDashboard>('/admin/dashboard'),
  dubReports: () => api.get<{ items: DubReportItem[]; threshold: number }>('/admin/dub-reports'),
  confirmDub: (animeId: string) => api.post(`/admin/dub-reports/${animeId}/confirm`),
  dismissDub: (animeId: string) => api.post(`/admin/dub-reports/${animeId}/dismiss`),
  users: (params: { search?: string; page?: number }) => api.get<Paginated<AdminUser>>('/admin/users', { params }),
  ban: (userId: string, data: { reason?: string; durationDays?: number }) => api.post(`/admin/users/${userId}/ban`, data),
  unban: (userId: string) => api.post(`/admin/users/${userId}/unban`),
  logs: (page = 1) => api.get<Paginated<AdminLogItem>>('/admin/logs', { params: { page } }),
  titleRequests: (status: 'pending' | 'added' | 'rejected' = 'pending', page = 1) =>
    api.get<Paginated<AdminTitleRequest>>('/admin/title-requests', { params: { status, page } }),
  resolveTitleRequest: (id: string, data: { status: 'added' | 'rejected'; animeId?: string; note?: string }) =>
    api.post(`/admin/title-requests/${id}/resolve`, data),
  commentReports: () => api.get<{ items: AdminCommentReport[] }>('/admin/comment-reports'),
  dismissCommentReports: (commentId: string) => api.post(`/admin/comment-reports/${commentId}/dismiss`),
  recentComments: (page = 1) => api.get<Paginated<AdminComment>>('/admin/comments', { params: { page } }),
  removeComment: (commentId: string) => api.delete(`/admin/comments/${commentId}`),
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
  report: (animeId: string, commentId: string, reason?: string) =>
    api.post(`/anime/${animeId}/comments/${commentId}/report`, reason ? { reason } : {}),
};

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
}

export interface TitleRequestResult {
  status: 'received' | 'already-requested';
  possibleMatches: Array<Pick<Anime, 'id' | 'title' | 'releaseYear' | 'format'>>;
}

export interface AdminTitleRequest {
  id: string;
  title: string;
  details: string;
  link: string | null;
  requestCount: number;
  status: 'pending' | 'added' | 'rejected';
  adminNote: string | null;
  animeId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { username: string } | null;
}

export interface AdminComment {
  id: string;
  content: string;
  isDeleted: boolean;
  createdAt: string;
  user: { id: string; username: string } | null;
  anime: { id: string; title: string };
  reports: number;
}

export interface AdminCommentReport extends AdminComment {
  reasons: string[];
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
  description?: string | null;
  format?: 'TV' | 'MOVIE' | 'OVA' | 'ONA' | 'SPECIAL' | null;
  episodes?: number | null;
}

export interface AnimeDetail extends Anime {
  alternativeTitles?: string[];
  externalIds?: { anilist?: number; mal?: number; kitsu?: number; anidb?: number };
  dubReports?: number;
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

export interface Paginated<T> {
  items: T[];
  pagination: PaginatedAnime['pagination'];
}

export interface DubState {
  hasDub: boolean;
  reports: number;
  reportedByMe: boolean;
  threshold: number;
}

export interface MyRatingItem {
  subRating: number | null;
  dubRating: number | null;
  updatedAt: string;
  anime: Pick<Anime, 'id' | 'title' | 'coverImageUrl' | 'releaseYear' | 'format' | 'hasDub'>;
}

export interface AdminDashboard {
  counts: {
    totalUsers: number;
    totalAnime: number;
    totalRatings: number;
    totalComments: number;
    pendingDubReports: number;
    pendingTitleRequests: number;
    reportedComments: number;
  };
  topRatedAnime: Array<{ id: string; title: string }>;
  recentActivity: AdminLogItem[];
}

export interface DubReportItem {
  anime: Pick<Anime, 'id' | 'title' | 'releaseYear' | 'format'>;
  reports: number;
  latestAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  isBanned: boolean;
  createdAt: string;
}

export interface AdminLogItem {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  admin?: { username?: string } | null;
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
  alternativeTitles?: string[];
  format?: string;
  episodes?: number;
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
