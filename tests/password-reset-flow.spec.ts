/**
 * Playwright E2E — forgot password → reset → login (Phase 12.6)
 *
 * Requires dev servers + non-production API (devResetCode when SMTP does not return code).
 * If forgot-password does not expose devResetCode, the test uses the API fallback via createResetToken
 * by calling forgot-password only when devResetCode is present; otherwise skips with a message.
 *
 * HOW TO RUN:
 *   npx playwright test tests/password-reset-flow.spec.ts --reporter=list
 *   npm run test:password-reset
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const TEST_EMAIL = process.env.PASSWORD_RESET_TEST_EMAIL || 'testaint@lecstu.edu';
const ORIGINAL_PASSWORD = process.env.PASSWORD_RESET_TEST_PASSWORD || 'Test1234!';
const NEW_PASSWORD = 'ResetE2E12!';

async function fetchDevResetCode(request: APIRequestContext, email: string): Promise<string | null> {
  const res = await request.post(`${API_BASE}/auth/forgot-password`, { data: { email } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return typeof body.devResetCode === 'string' ? body.devResetCode : null;
}

async function restorePasswordViaApi(request: APIRequestContext, email: string, password: string) {
  const code = await fetchDevResetCode(request, email);
  if (!code) return false;
  await request.post(`${API_BASE}/auth/verify-reset-code`, { data: { email, code } });
  const reset = await request.post(`${API_BASE}/auth/reset-password`, {
    data: { email, code, newPassword: password },
  });
  return reset.ok();
}

test.describe('Password reset UI flow', () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API_BASE.replace(/\/api$/, '')}/api/health`);
    test.skip(!health.ok(), 'API server not running on port 5000');
  });

  test('forgot-password link on login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  test('forgot → reset code → new password → login', async ({ page, request }) => {
    let code = await fetchDevResetCode(request, TEST_EMAIL);
    if (!code) {
      test.skip(
        true,
        'No devResetCode (SMTP delivered email). Use console mode or run API script instead.',
      );
      return;
    }

    await page.goto('/forgot-password');
    await page.locator('#forgotEmail').fill(TEST_EMAIL);
    await page.getByRole('button', { name: /send reset code/i }).click();
    await expect(page.getByText(/check your email|registered/i)).toBeVisible({ timeout: 15_000 });

    await page.goto(`/reset-password?email=${encodeURIComponent(TEST_EMAIL)}`);
    await page.locator('#resetCode').fill(code);
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page.getByLabel(/new password/i)).toBeVisible({ timeout: 10_000 });
    await page.locator('#newPassword').fill(NEW_PASSWORD);
    await page.locator('#confirmPassword').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: /update password/i }).click();

    await page.waitForURL(/\/login/, { timeout: 20_000 });

    await page.locator('#email').fill(TEST_EMAIL);
    await page.locator('#password').fill(NEW_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });

    const restored = await restorePasswordViaApi(request, TEST_EMAIL, ORIGINAL_PASSWORD);
    expect(restored).toBeTruthy();
  });

  test('unknown email shows generic success copy', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('#forgotEmail').fill('unknown-phase-12-6@test.invalid');
    await page.getByRole('button', { name: /send reset code/i }).click();
    await expect(page.getByText(/if that email is registered/i)).toBeVisible({ timeout: 15_000 });
  });
});
