/**
 * Playwright E2E test — profile enrollment change → timetable auto-update
 *
 * Verifies that when a student changes their degree program / study year /
 * pathway on the Profile page, the My Timetable page immediately reflects
 * the new class group after navigation — no manual refresh required.
 *
 * HOW TO RUN (dev servers must be up first):
 *   npx playwright test tests/enrollment-timetable-sync.spec.ts --reporter=list
 */

import { test, expect, type Page } from '@playwright/test';

const STUDENT_EMAIL    = 'testaint@lecstu.edu';
const STUDENT_PASSWORD = 'Test1234!';

// ── Login ─────────────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(STUDENT_EMAIL);
  await page.locator('#password').fill(STUDENT_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

// ── Navigate to My Timetable and wait for subtitle to render ─────────────────
async function goToTimetable(page: Page) {
  await page.getByRole('link', { name: /^my timetable$/i }).click();
  await page.waitForURL(/\/timetable$/, { timeout: 15_000 });
  await page.waitForSelector('.tt-subtitle', { timeout: 20_000 });
  await page.waitForTimeout(800);
}

// ── Navigate to My Profile ────────────────────────────────────────────────────
async function goToProfile(page: Page) {
  await page.getByRole('link', { name: /^my profile$/i }).click();
  await page.waitForURL(/\/profile$/, { timeout: 10_000 });
  // Wait for the enrollment form to be loaded (programs fetched from server)
  await expect(page.locator('[data-testid="enroll-program"]')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(300);
}

// ── Read timetable subtitle text ──────────────────────────────────────────────
async function getTimetableSubtitle(page: Page): Promise<string> {
  return (await page.locator('.tt-subtitle').textContent()) ?? '';
}

// ── Change enrollment and wait for success ────────────────────────────────────
async function changeEnrollment(
  page: Page,
  programCode: string,
  studyYear: string,
  pathwayCode?: string,
) {
  await expect(page.locator('[data-testid="enroll-program"]')).toBeEnabled({ timeout: 8_000 });

  // Select program
  await page.locator('[data-testid="enroll-program"]').selectOption(programCode);
  await page.waitForTimeout(400);

  // Select study year (enabled only after program selected)
  await expect(page.locator('[data-testid="enroll-year"]')).toBeEnabled({ timeout: 5_000 });
  await page.locator('[data-testid="enroll-year"]').selectOption(studyYear);
  await page.waitForTimeout(400);

  // Select pathway if required
  if (pathwayCode) {
    await expect(page.locator('[data-testid="enroll-pathway"]')).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="enroll-pathway"]').selectOption(pathwayCode);
    await page.waitForTimeout(400);
  }

  // Click Update
  const updateBtn = page.getByRole('button', { name: /update for new study year/i });
  await updateBtn.click();

  // Wait for success message
  await expect(
    page.locator('.border-emerald-200')
  ).toBeVisible({ timeout: 15_000 });

  console.log('  Enrollment changed to:', programCode, studyYear, pathwayCode ?? '');
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════════════
test.describe('Enrollment change → timetable auto-update', () => {

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // Always reset after each test so the next test starts from a known state
  test.afterEach(async ({ page }) => {
    try {
      await goToProfile(page);
      await changeEnrollment(page, 'CS', 'Y3', 'AINT');
      console.log('  [afterEach] Reset to CS-Y3-AINT ✓');
    } catch {
      console.warn('  [afterEach] Reset failed — next test may start in unexpected state');
    }
  });

  // ── 1. DIAGNOSTIC ──────────────────────────────────────────────────────────
  test('DIAGNOSTIC — show current class and slot count', async ({ page }) => {
    await goToTimetable(page);
    const subtitle = await getTimetableSubtitle(page);
    console.log('\nSubtitle:', subtitle);
    expect(true).toBe(true);
  });

  // ── 2. CS-Y3-AINT → CS-Y2 (no pathway) ───────────────────────────────────
  test('timetable updates: CS-Y3-AINT (13 slots) → CS-Y2 (19 slots)', async ({ page }) => {
    // Verify starting state
    await goToTimetable(page);
    const before = await getTimetableSubtitle(page);
    console.log('\nBefore:', before);
    expect(before).toContain('CS-Y3-AINT');

    // Change enrollment
    await goToProfile(page);
    await changeEnrollment(page, 'CS', 'Y2');

    // Navigate to timetable — must show new class WITHOUT manual refresh
    await goToTimetable(page);
    const after = await getTimetableSubtitle(page);
    console.log('After :', after);

    expect(after).toContain('CS-Y2');
    // CS-Y2 has 19 slots; subtitle says "19 slots in selected period"
    expect(after).toContain('19');
  });

  // ── 3. CS-Y3-AINT → CS-Y3-CSEC (same year, different pathway) ────────────
  test('timetable updates: CS-Y3-AINT → CS-Y3-CSEC', async ({ page }) => {
    await goToTimetable(page);
    const before = await getTimetableSubtitle(page);
    console.log('\nBefore:', before);
    expect(before).toContain('CS-Y3-AINT');

    await goToProfile(page);
    await changeEnrollment(page, 'CS', 'Y3', 'CSEC');

    await goToTimetable(page);
    const after = await getTimetableSubtitle(page);
    console.log('After :', after);

    expect(after).toContain('CS-Y3-CSEC');
    // CS-Y3-CSEC has 17 slots
    expect(after).toContain('17');
  });

  // ── 4. Current class group field on profile updates immediately ───────────
  test('profile current class group field updates after enrollment change', async ({ page }) => {
    await goToProfile(page);

    // Read starting group
    const groupBefore = await page.locator('input[readonly]').first().inputValue();
    console.log('\nGroup before:', groupBefore);
    expect(groupBefore).toBe('CS-Y3-AINT');

    // Change to CS-Y2
    await changeEnrollment(page, 'CS', 'Y2');

    // The "Current class group" readonly field must reflect the new group right away
    await expect(page.locator('input[readonly]').first()).toHaveValue('CS-Y2', { timeout: 8_000 });
    console.log('Group after:', await page.locator('input[readonly]').first().inputValue());
  });
});
