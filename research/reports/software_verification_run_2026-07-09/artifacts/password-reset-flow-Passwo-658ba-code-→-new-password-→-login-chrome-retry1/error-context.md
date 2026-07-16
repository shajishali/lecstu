# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: password-reset-flow.spec.ts >> Password reset UI flow >> forgot → reset code → new password → login
- Location: tests\password-reset-flow.spec.ts:51:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/check your email|registered/i)
Expected: visible
Error: strict mode violation: getByText(/check your email|registered/i) resolved to 2 elements:
    1) <p class="mt-2 text-sm text-slate-800">Enter the email you registered with. We'll send a…</p> aka getByText('Enter the email you')
    2) <label for="forgotEmail" class="text-sm font-bold text-slate-900 drop-shadow-sm">Registered email</label> aka getByText('Registered email')

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for getByText(/check your email|registered/i)

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - img "Campus" [ref=e4]
  - generic [ref=e7]:
    - generic [ref=e8]:
      - img "LECSTU" [ref=e9]
      - paragraph [ref=e10]: Forgot your password?
      - paragraph [ref=e11]: Enter the email you registered with. We'll send a 6-digit reset code to your recovery email if you set one in Profile.
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Registered email
        - textbox "Registered email" [ref=e15]:
          - /placeholder: your@email.com
          - text: testaint@lecstu.edu
      - button [disabled] [ref=e16]
    - paragraph [ref=e18]:
      - text: Remember your password?
      - link "Sign in" [ref=e19] [cursor=pointer]:
        - /url: /login
```

# Test source

```ts
  1  | /**
  2  |  * Playwright E2E — forgot password → reset → login (Phase 12.6)
  3  |  *
  4  |  * Requires dev servers + non-production API (devResetCode when SMTP does not return code).
  5  |  * If forgot-password does not expose devResetCode, the test uses the API fallback via createResetToken
  6  |  * by calling forgot-password only when devResetCode is present; otherwise skips with a message.
  7  |  *
  8  |  * HOW TO RUN:
  9  |  *   npx playwright test tests/password-reset-flow.spec.ts --reporter=list
  10 |  *   npm run test:password-reset
  11 |  */
  12 | 
  13 | import { test, expect, type APIRequestContext } from '@playwright/test';
  14 | 
  15 | const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
  16 | const TEST_EMAIL = process.env.PASSWORD_RESET_TEST_EMAIL || 'testaint@lecstu.edu';
  17 | const ORIGINAL_PASSWORD = process.env.PASSWORD_RESET_TEST_PASSWORD || 'Test1234!';
  18 | const NEW_PASSWORD = 'ResetE2E12!';
  19 | 
  20 | async function fetchDevResetCode(request: APIRequestContext, email: string): Promise<string | null> {
  21 |   const res = await request.post(`${API_BASE}/auth/forgot-password`, { data: { email } });
  22 |   expect(res.ok()).toBeTruthy();
  23 |   const body = await res.json();
  24 |   return typeof body.devResetCode === 'string' ? body.devResetCode : null;
  25 | }
  26 | 
  27 | async function restorePasswordViaApi(request: APIRequestContext, email: string, password: string) {
  28 |   const code = await fetchDevResetCode(request, email);
  29 |   if (!code) return false;
  30 |   await request.post(`${API_BASE}/auth/verify-reset-code`, { data: { email, code } });
  31 |   const reset = await request.post(`${API_BASE}/auth/reset-password`, {
  32 |     data: { email, code, newPassword: password },
  33 |   });
  34 |   return reset.ok();
  35 | }
  36 | 
  37 | test.describe('Password reset UI flow', () => {
  38 |   test.beforeAll(async ({ request }) => {
  39 |     const health = await request.get(`${API_BASE.replace(/\/api$/, '')}/api/health`);
  40 |     test.skip(!health.ok(), 'API server not running on port 5000');
  41 |   });
  42 | 
  43 |   test('forgot-password link on login page', async ({ page }) => {
  44 |     await page.goto('/login');
  45 |     await expect(page.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
  46 |       'href',
  47 |       '/forgot-password',
  48 |     );
  49 |   });
  50 | 
  51 |   test('forgot → reset code → new password → login', async ({ page, request }) => {
  52 |     let code = await fetchDevResetCode(request, TEST_EMAIL);
  53 |     if (!code) {
  54 |       test.skip(
  55 |         true,
  56 |         'No devResetCode (SMTP delivered email). Use console mode or run API script instead.',
  57 |       );
  58 |       return;
  59 |     }
  60 | 
  61 |     await page.goto('/forgot-password');
  62 |     await page.locator('#forgotEmail').fill(TEST_EMAIL);
  63 |     await page.getByRole('button', { name: /send reset code/i }).click();
> 64 |     await expect(page.getByText(/check your email|registered/i)).toBeVisible({ timeout: 15_000 });
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  65 | 
  66 |     await page.goto(`/reset-password?email=${encodeURIComponent(TEST_EMAIL)}`);
  67 |     await page.locator('#resetCode').fill(code);
  68 |     await page.getByRole('button', { name: /continue/i }).click();
  69 | 
  70 |     await expect(page.getByLabel(/new password/i)).toBeVisible({ timeout: 10_000 });
  71 |     await page.locator('#newPassword').fill(NEW_PASSWORD);
  72 |     await page.locator('#confirmPassword').fill(NEW_PASSWORD);
  73 |     await page.getByRole('button', { name: /update password/i }).click();
  74 | 
  75 |     await page.waitForURL(/\/login/, { timeout: 20_000 });
  76 | 
  77 |     await page.locator('#email').fill(TEST_EMAIL);
  78 |     await page.locator('#password').fill(NEW_PASSWORD);
  79 |     await page.locator('button[type="submit"]').click();
  80 |     await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
  81 | 
  82 |     const restored = await restorePasswordViaApi(request, TEST_EMAIL, ORIGINAL_PASSWORD);
  83 |     expect(restored).toBeTruthy();
  84 |   });
  85 | 
  86 |   test('unknown email shows generic success copy', async ({ page }) => {
  87 |     await page.goto('/forgot-password');
  88 |     await page.locator('#forgotEmail').fill('unknown-phase-12-6@test.invalid');
  89 |     await page.getByRole('button', { name: /send reset code/i }).click();
  90 |     await expect(page.getByText(/if that email is registered/i)).toBeVisible({ timeout: 15_000 });
  91 |   });
  92 | });
  93 | 
```