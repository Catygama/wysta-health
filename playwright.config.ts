import { defineConfig, devices } from '@playwright/test';

// Custom port to avoid colliding with other Expo dev servers running on 8081.
const PORT = 8091;
const BASE_URL = `http://localhost:${PORT}`;
// Defaults to the project's dev Convex deployment defined in .env.local.
// Override with EXPO_PUBLIC_CONVEX_URL when pointing at a different backend.
const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ??
  'https://fiery-toucan-646.eu-west-1.convex.cloud';

export default defineConfig({
  testDir: './e2e/tests',
  globalSetup: './e2e/global-setup.ts',
  // Single worker to keep Convex state deterministic across specs.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Convex URL passed to helpers via process.env at test time.
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `bun run web -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      EXPO_PUBLIC_E2E: 'true',
      EXPO_PUBLIC_CONVEX_URL: CONVEX_URL,
      EXPO_PUBLIC_GUEST_AUTH: 'true',
    },
  },
});
