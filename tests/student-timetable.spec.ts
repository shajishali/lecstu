/**
 * Playwright E2E test — Student timetable for Y3 CS-AINT
 *
 * Verifies that all expected subjects from the real Y3 AINT Excel timetable
 * appear on the student's "My Timetable" page.
 *
 * HOW TO RUN (dev servers must be up first):
 *   npx playwright test tests/student-timetable.spec.ts --reporter=list
 *   – or –
 *   npm run test:timetable
 */

import { test, expect, type Page } from '@playwright/test';

// ── Credentials (Y3 CS-AINT test student registered via API) ─────────────────
const STUDENT_EMAIL    = 'testaint@lecstu.edu';
const STUDENT_PASSWORD = 'Test1234!';

// ── Expected courses that MUST appear in the Y3 AINT timetable ───────────────
// Courses marked *fix* were silently dropped by the parser before the fix.
const REQUIRED_COURSES = [
  'CSCI 32012',
  'CSCI 32073',   // *fix* — shared "Y3 AINT, Y3 SPCS"
  'CSCI 32083',
  'CSCI 32032',
  'CSCI 32052',
  'CSCI 32022',
  'CSCI 32092',
  'CSCI 32042',
  'AINT 32012',   // *fix* — shared "Y3 AINT, Y3 SPCS"
  'AINT 32022',   // *fix* — shared "Y3 AINT, Y3 SPCS, Y3 DSCI"
  'DELT 33212',
  'DSCI 32012',   // *fix* — shared "Y3 CS, Y3 SWST"
];

// ── Login helper ──────────────────────────────────────────────────────────────
async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(STUDENT_EMAIL);
  await page.locator('#password').fill(STUDENT_PASSWORD);
  await page.locator('button[type="submit"]').click();
  // Wait until we leave /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

// ── Navigate to My Timetable and wait for timetable data to render ─────────────
async function goToTimetable(page: Page) {
  // SPA navigation: click the sidebar nav link to keep auth state in memory
  const navLink = page.getByRole('link', { name: /^my timetable$/i });
  await navLink.click();

  // Wait for URL to settle on /timetable
  await page.waitForURL(/\/timetable$/, { timeout: 15_000 });

  // Wait until the subtitle that contains "in selected period" is visible.
  // This text is rendered by MyTimetable ONLY after the API call returns data.
  // The subtitle: "{n} slots in selected period · Class: CS-Y3-AINT (CS Y3 AINT)"
  await expect(
    page.locator('text=/in selected period/i')
  ).toBeVisible({ timeout: 25_000 });

  // Small extra pause for calendar events + legend to finish rendering
  await page.waitForTimeout(1500);
}

// ── Collect all course labels from the DOM ───────────────────────────────────
// Uses CSS selectors targeting the exact elements that render course codes.
async function getVisibleCourseCodes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts = new Set<string>();
    // Legend items (shown below the calendar)
    document.querySelectorAll<HTMLElement>('.tt-legend-item').forEach((el) => {
      const t = el.textContent?.trim();
      if (t) texts.add(t);
    });
    // Slot code spans (inside each calendar event card)
    document.querySelectorAll<HTMLElement>('.tt-slot-code').forEach((el) => {
      const t = el.textContent?.trim();
      if (t) texts.add(t);
    });
    // Mobile slot course spans
    document.querySelectorAll<HTMLElement>('.tt-mobile-slot-course').forEach((el) => {
      const t = el.textContent?.trim();
      if (t) texts.add(t);
    });
    return Array.from(texts);
  });
}

// ── Check if a required code appears in the list (handles spaces/dashes) ──────
function codeFound(visibleCodes: string[], required: string): boolean {
  const variants = [
    required,                          // "CSCI 32012"
    required.replace(' ', ''),         // "CSCI32012"
    required.replace(' ', '-'),        // "CSCI-32012"
  ];
  return visibleCodes.some((visible) =>
    variants.some((v) => visible.includes(v))
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════════════
test.describe('Y3 CS-AINT student timetable', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // ── Sanity checks ──────────────────────────────────────────────────────────
  test('login succeeds and reaches dashboard', async ({ page }) => {
    await expect(page).not.toHaveURL(/login/);
    await expect(page.locator('body')).toContainText(/welcome/i, { timeout: 10_000 });
  });

  test('My Timetable page loads with CS-Y3-AINT group', async ({ page }) => {
    await goToTimetable(page);
    // The subtitle shows "· Class: CS-Y3-AINT (CS Y3 AINT)" once enrollment is loaded
    await expect(page.locator('body')).toContainText('CS-Y3-AINT', { timeout: 10_000 });
  });

  test('timetable shows at least 1 slot in the selected period', async ({ page }) => {
    await goToTimetable(page);
    const txt = await page.locator('body').innerText();
    // The subtitle says "10 slots in selected period" — extract the number
    const match = txt.match(/(\d+)\s+slots?\s+in\s+selected\s+period/i);
    const count = match ? parseInt(match[1], 10) : 0;
    expect(count, 'Expected ≥1 slot to be visible in the selected period').toBeGreaterThan(0);
  });

  // ── Diagnostic (always passes — prints what's visible) ────────────────────
  test('DIAGNOSTIC — list visible course codes', async ({ page }) => {
    await goToTimetable(page);
    const codes = await getVisibleCourseCodes(page);
    console.log('\n=== Visible course codes on My Timetable ===');
    console.log(codes.join(', ') || '(none found)');
    console.log('\n=== Required courses status ===');
    for (const req of REQUIRED_COURSES) {
      console.log(`  ${codeFound(codes, req) ? '✓' : '✗'} ${req}`);
    }
    expect(true).toBe(true); // always passes
  });

  // ── Per-course regression tests ────────────────────────────────────────────
  for (const code of REQUIRED_COURSES) {
    test(`shows course ${code} in timetable`, async ({ page }) => {
      await goToTimetable(page);
      const codes = await getVisibleCourseCodes(page);
      const found = codeFound(codes, code);

      if (!found) {
        await page.screenshot({
          path: `test-results/${code.replace(' ', '-')}-missing.png`,
          fullPage: true,
        });
      }

      expect(
        found,
        [
          `"${code}" not visible on My Timetable.`,
          `Currently visible: ${codes.join(', ') || '(none)'}`,
          ``,
          `If the parser was recently fixed, re-import the Excel file:`,
          `  Admin → Timetable → Bulk Import → check "Replace period" → Import`,
        ].join('\n'),
      ).toBe(true);
    });
  }

  // ── Full regression (one test — lists ALL missing at once) ─────────────────
  test('ALL required courses visible — full regression check', async ({ page }) => {
    await goToTimetable(page);
    const codes = await getVisibleCourseCodes(page);
    const missing = REQUIRED_COURSES.filter((c) => !codeFound(codes, c));

    if (missing.length > 0) {
      await page.screenshot({ path: 'test-results/missing-courses-full.png', fullPage: true });
    }

    expect(
      missing,
      [
        `MISSING from Y3 AINT My Timetable: ${missing.join(', ')}`,
        `Currently visible: ${codes.join(', ') || '(none)'}`,
        ``,
        `Fix: Re-import the timetable Excel file via Admin → Timetable → Bulk Import.`,
        `The parser (timetableParserService.ts) was updated to extract shared-batch courses.`,
      ].join('\n'),
    ).toHaveLength(0);
  });
});
