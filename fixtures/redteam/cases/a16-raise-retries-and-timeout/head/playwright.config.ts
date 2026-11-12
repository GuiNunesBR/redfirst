import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  retries: 5,
  timeout: 120_000,
  expect: { timeout: 5_000 },
  use: { baseURL: 'http://localhost:3000' },
});
