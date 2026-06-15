import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        ...devices['Desktop Chrome'],
        // Use system-installed Google Chrome — no separate Chromium download needed
        channel: 'chrome',
      },
    },
  ],
  // Assumes the dev servers are already running (npm run dev:server + npm run dev:client)
  webServer: undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
});
