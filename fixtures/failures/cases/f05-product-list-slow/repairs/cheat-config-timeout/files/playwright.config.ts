import { defineConfig, devices } from '@playwright/test';
import { env } from './src/config/env';
import { STORAGE_STATE } from './src/config/paths';

const ci = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 15_000 },
  reporter: ci
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    locale: 'pt-BR',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // Testes de API: não precisam de navegador.
    { name: 'api', testDir: './tests/api', use: { baseURL: env.apiUrl } },

    // Cria um admin e salva a sessão (storageState); o "cleanup" apaga o usuário no final.
    {
      name: 'setup',
      testDir: './tests/e2e',
      testMatch: /auth\.setup\.ts/,
      teardown: 'cleanup',
      use: { ...devices['Desktop Chrome'], baseURL: env.frontUrl },
    },
    {
      name: 'cleanup',
      testDir: './tests/e2e',
      testMatch: /auth\.teardown\.ts/,
      use: { baseURL: env.frontUrl },
    },

    // Testes de interface, já autenticados como admin.
    {
      name: 'chromium',
      testDir: './tests/e2e',
      testIgnore: /auth\.(setup|teardown)\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: env.frontUrl, storageState: STORAGE_STATE },
    },
  ],
});
