import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000/api/v1';

// Seeded by the backend in development and test databases.
export const DEMO = { email: 'demo@example.com', password: 'Password123!' };
export const ADMIN = { email: 'admin@example.com', password: 'Password123!' };

// The auth routes only accept requests from the website's own origin. With the
// backend's INTERNAL_API_KEY (E2E_INTERNAL_KEY), the tests' own API calls skip the
// rate limits, as the website's server does; what the browser does stays limited.
const internal: Record<string, string> = process.env.E2E_INTERNAL_KEY ? { 'X-Internal-Key': process.env.E2E_INTERNAL_KEY } : {};
const fromSite = { Origin: BASE_URL, ...internal };
const tokens = new Map<string, string>();

export async function apiToken(request: APIRequestContext, account: { email: string; password: string }) {
  // Access tokens last ten minutes, longer than a run, so each account signs in once.
  const cached = tokens.get(account.email);
  if (cached) return cached;

  const response = await request.post(`${API_URL}/auth/login`, { headers: fromSite, data: account });
  expect(response.ok(), `login as ${account.email}: ${response.status()}`).toBeTruthy();
  const { accessToken } = (await response.json()) as { accessToken: string };
  tokens.set(account.email, accessToken);
  return accessToken;
}

/** A title made for one test, with a unique name, removed by deleteTitle. */
export async function createTitle(request: APIRequestContext, title: string, extra: Record<string, unknown> = {}) {
  const token = await apiToken(request, ADMIN);
  const response = await request.post(`${API_URL}/anime`, {
    headers: { Authorization: `Bearer ${token}`, ...internal },
    data: { title, format: 'TV', hasDub: false, status: 'completed', releaseYear: 2020, ...extra },
  });
  expect(response.ok(), `create title: ${response.status()} ${await response.text()}`).toBeTruthy();
  return ((await response.json()) as { id: string }).id;
}

export async function deleteTitle(request: APIRequestContext, id: string) {
  const token = await apiToken(request, ADMIN);
  await request.delete(`${API_URL}/anime/${id}`, { headers: { Authorization: `Bearer ${token}`, ...internal } });
}

export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/login');
  await page.fill('#email', account.email);
  await page.fill('#password', account.password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export function uniqueName(label: string) {
  return `E2E ${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
