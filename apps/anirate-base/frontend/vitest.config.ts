import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    pool: 'forks',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 10_000,
    // The browser tests in e2e/ run under Playwright (npm run test:e2e).
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
