import { type Page, expect } from '@playwright/test';

declare global {
  interface Window {
    __E2E_AUTH__?: {
      signIn: (email: string, password: string) => Promise<void>;
      signUp: (email: string, password: string) => Promise<void>;
      signOut: () => Promise<void>;
    };
    __E2E_READY__?: boolean;
  }
}

async function waitForBridge(page: Page) {
  await page.waitForFunction(() => Boolean(window.__E2E_READY__), undefined, {
    timeout: 30_000,
  });
}

export async function gotoApp(page: Page, path: string = '/') {
  await page.goto(path);
  await waitForBridge(page);
}

export async function loginAs(
  page: Page,
  email: string,
  password = 'e2e-test-pw',
) {
  await gotoApp(page, '/');
  await page.evaluate(
    async ({ e, p }) => {
      await window.__E2E_AUTH__!.signIn(e, p);
    },
    { e: email, p: password },
  );
  // Auth state has changed but the auth screens don't react to it — they only
  // navigate after their own form submit. Re-visit `/` to let the role-based
  // redirect in app/index.tsx kick us out to the right home.
  await page.goto('/');
  await waitForBridge(page);
  await expect
    .poll(async () => page.url(), { timeout: 15_000 })
    .not.toMatch(/\(auth\)|\/login|\/register/);
}

export async function loginViaUI(
  page: Page,
  email: string,
  password = 'e2e-test-pw',
) {
  await page.goto('/(auth)/login');
  await waitForBridge(page);
  await page.getByTestId('auth-email-input').fill(email);
  await page.getByTestId('auth-password-input').fill(password);
  await page.getByTestId('auth-consent-checkbox').click();
  await page.getByTestId('auth-login-button').click();
}

export async function logoutViaBridge(page: Page) {
  await page.evaluate(async () => {
    await window.__E2E_AUTH__!.signOut();
  });
}
