// End-to-end tests of the main visitor and admin flows against a running site:
// the website on E2E_BASE_URL and the API on E2E_API_URL (local defaults below).
// Start both first (npm run dev from the repo root), then: npm run test:e2e
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // The tests share one database, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    // Locally, the installed Edge saves a browser download; CI installs Chromium.
    ...(process.env.CI ? {} : { channel: 'msedge' }),
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'msedge' }) } },
  ],
});
