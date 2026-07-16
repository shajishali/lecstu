/**
 * One-off capture of thesis Figures 4.11–4.20 into photos-for-thesis/ch4-ui/
 *
 * Usage:
 *   npx playwright test tests/capture-thesis-ui.spec.ts --reporter=list
 *   THESIS_CAPTURE_URL=https://lecstu.com npx playwright test tests/capture-thesis-ui.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join('photos-for-thesis', 'ch4-ui');
const BASE = process.env.THESIS_CAPTURE_URL || 'https://lecstu.com';
const EMAIL = process.env.THESIS_CAPTURE_EMAIL || 'testaint@lecstu.edu';
const PASSWORD = process.env.THESIS_CAPTURE_PASSWORD || 'Test1234!';

function shot(page: Page, name: string) {
  return page.screenshot({
    path: path.join(OUT_DIR, name),
    fullPage: false,
    animations: 'disabled',
  });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('#email').fill(EMAIL);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
}

test.describe.configure({ mode: 'serial' });

test('capture thesis UI figures 4.11–4.20', async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });

  // 4.11 — login (register link visible on same flow)
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await shot(page, 'fig-4-11-login-register.png');

  await login(page);

  // 4.12 — dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'fig-4-12-student-dashboard.png');

  // 4.13 — timetable
  await page.getByRole('link', { name: /^my timetable$/i }).click();
  await page.waitForURL(/\/timetable/, { timeout: 20_000 });
  await page.waitForTimeout(2000);
  await shot(page, 'fig-4-13-timetable.png');

  // 4.14 — hall availability
  await page.goto(`${BASE}/halls/availability`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'fig-4-14-hall-availability.png');

  // 4.15 — lecturer directory
  await page.goto(`${BASE}/lecturers`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'fig-4-15-lecturer-directory.png');

  // 4.16 — appointments (notification bell area)
  await page.goto(`${BASE}/appointments`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const notifBtn = page.getByRole('button', { name: /notification/i }).first();
  if (await notifBtn.isVisible().catch(() => false)) {
    await notifBtn.click();
    await page.waitForTimeout(500);
  }
  await shot(page, 'fig-4-16-appointment-notification.png');

  // 4.17 — campus / navigate entry (outdoor building context)
  await page.goto(`${BASE}/navigate`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await shot(page, 'fig-4-17-campus-map.png');

  // 4.18 — indoor guided route (try to start a route if UI allows)
  await page.goto(`${BASE}/navigate`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const buildingSelect = page.locator('select').first();
  if (await buildingSelect.isVisible().catch(() => false)) {
    const options = await buildingSelect.locator('option').all();
    if (options.length > 1) {
      await buildingSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1500);
    }
  }
  const placeBtn = page.getByRole('button', { name: /room|hall|place|destination/i }).first();
  if (await placeBtn.isVisible().catch(() => false)) {
    await placeBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  const goBtn = page.getByRole('button', { name: /route|guide|navigate|start/i }).first();
  if (await goBtn.isVisible().catch(() => false)) {
    await goBtn.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  await shot(page, 'fig-4-18-indoor-guided-route.png');

  // 4.19 — chatbot with live query
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const chatToggle = page.getByRole('button', { name: /chat|message|assistant/i }).first();
  if (await chatToggle.isVisible().catch(() => false)) {
    await chatToggle.click();
    await page.waitForTimeout(800);
    const input = page.locator('textarea, input[type="text"]').filter({ hasNot: page.locator('#email') }).last();
    if (await input.isVisible().catch(() => false)) {
      await input.fill('What is my timetable for tomorrow?');
      await page.getByRole('button', { name: /send/i }).first().click().catch(() => {});
      await page.waitForTimeout(6000);
    }
  }
  await shot(page, 'fig-4-19-chatbot-live.png');

  // 4.20 — voice + language switcher
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  const langBtn = page.getByRole('button', { name: /language|ui language/i }).first();
  if (await langBtn.isVisible().catch(() => false)) {
    await langBtn.click();
    await page.waitForTimeout(500);
  }
  const chatOpen = page.getByRole('button', { name: /chat|message|assistant/i }).first();
  if (await chatOpen.isVisible().catch(() => false)) {
    await chatOpen.click();
    await page.waitForTimeout(800);
  }
  await shot(page, 'fig-4-20-voice-translation.png');

  // Verify all files exist
  const expected = [
    'fig-4-11-login-register.png',
    'fig-4-12-student-dashboard.png',
    'fig-4-13-timetable.png',
    'fig-4-14-hall-availability.png',
    'fig-4-15-lecturer-directory.png',
    'fig-4-16-appointment-notification.png',
    'fig-4-17-campus-map.png',
    'fig-4-18-indoor-guided-route.png',
    'fig-4-19-chatbot-live.png',
    'fig-4-20-voice-translation.png',
  ];
  for (const f of expected) {
    expect(fs.existsSync(path.join(OUT_DIR, f)), `missing ${f}`).toBeTruthy();
  }
});
