import { defineConfig, devices } from '@playwright/test';

// Custom port to avoid colliding with other Expo dev servers running on 8081.
const PORT = 8091;
const BASE_URL = `http://localhost:${PORT}`;
// Defaults to a local Convex backend: global setup wipes the database, so it
// must never default to a shared deployment. Override with EXPO_PUBLIC_CONVEX_URL.
const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ??
  'http://127.0.0.1:3210';

const CROSS_BROWSER_SPECS = [
  /journeys\/.*\.spec\.ts/,
  /a11y\/.*\.spec\.ts/,
  /auth\/login-.*\.spec\.ts/,
];

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

  // The full suite runs on Chromium. The other browsers and devices run only
  // the specs that don't depend on state left by earlier specs (the database
  // is reset once per run).
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(
      [
        ['firefox', devices['Desktop Firefox']],
        ['webkit', devices['Desktop Safari']],
        ['mobile-android', devices['Pixel 7']],
        ['mobile-ios', devices['iPhone 14']],
      ] as const
    ).map(([name, device]) => ({
      name,
      use: { ...device },
      testMatch: CROSS_BROWSER_SPECS,
    })),
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
