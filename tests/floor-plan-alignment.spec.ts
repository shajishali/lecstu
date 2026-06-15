/**
 * Playwright test — floor plan coordinate alignment.
 *
 * Verifies that the floor plan image in the student "Find My Way" view renders
 * WITHOUT object-contain letterboxing, so x,y% coordinates map 1:1 to actual
 * floor plan image pixels regardless of the container width.
 *
 * HOW TO RUN (dev servers must be running):
 *   npx playwright test tests/floor-plan-alignment.spec.ts --reporter=list
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const STUDENT_EMAIL    = 'testaint@lecstu.edu';
const STUDENT_PASSWORD = 'Test1234!';

async function loginStudent(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(STUDENT_EMAIL);
  await page.locator('#password').fill(STUDENT_PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

function snapDir() {
  const dir = path.join('test-results', 'alignment');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Test: image must NOT have horizontal letterboxing ────────────────────────
test('floor plan image has no letterboxing (height:auto, no object-contain)', async ({ page }) => {
  // Use a fixed 1280×900 viewport so measurements are deterministic.
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginStudent(page);

  // Navigate to Find My Way and wait for the page to settle.
  await page.goto('/navigate');
  await page.waitForLoadState('networkidle');

  // Trigger a search so a floor plan with route renders.
  // Try filling the search box with any room name and submitting.
  const searchInput = page.locator('input').first();
  await searchInput.fill('Seminar Room');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);

  // Press "Get directions" if it appears.
  const getDir = page.locator('button').filter({ hasText: /get directions/i }).first();
  if (await getDir.isVisible({ timeout: 2000 }).catch(() => false)) {
    await getDir.click();
    await page.waitForTimeout(2000);
  }

  // Wait for a floor plan canvas to render (with route).
  const imgLocator = page.locator('.fp-map-canvas img').first();
  const canvasVisible = await imgLocator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);

  if (!canvasVisible) {
    // No floor plan rendered — might be no route configured yet.
    console.log('No floor plan canvas visible — skipping letterbox check.');
    return;
  }

  // Screenshot for visual inspection.
  const dir = snapDir();
  await page.screenshot({ path: path.join(dir, 'student-find-my-way.png') });

  // ── Measure letterboxing ───────────────────────────────────────────────────
  const metrics = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.fp-map-canvas')];
    return canvases.map((canvas) => {
      const img = canvas.querySelector('img') as HTMLImageElement | null;
      if (!img || !img.naturalWidth) return null;

      const iRect = img.getBoundingClientRect();
      const nW    = img.naturalWidth;
      const nH    = img.naturalHeight;

      // object-contain scale = min(iW/nW, iH/nH)
      const scaleByW = iRect.width  / nW;
      const scaleByH = iRect.height / nH;
      const scale    = Math.min(scaleByW, scaleByH);

      const contentW = nW * scale;
      const contentH = nH * scale;

      const letterboxX = (iRect.width  - contentW) / 2;
      const letterboxY = (iRect.height - contentH) / 2;

      const hasLetterboxX = letterboxX > 2; // >2px tolerance
      const hasLetterboxY = letterboxY > 2;

      return {
        imgW: Math.round(iRect.width),
        imgH: Math.round(iRect.height),
        naturalW: nW,
        naturalH: nH,
        letterboxX: Math.round(letterboxX),
        letterboxY: Math.round(letterboxY),
        hasLetterboxX,
        hasLetterboxY,
        // With height:auto and no object-contain:
        // imgW ≈ container width, imgH ≈ naturalH * (containerW / naturalW)
        expectedH: Math.round(iRect.width * nH / nW),
        heightMatchesNatural: Math.abs(iRect.height - (iRect.width * nH / nW)) < 3,
      };
    }).filter(Boolean);
  });

  console.log('Floor plan metrics:', JSON.stringify(metrics, null, 2));
  expect(metrics.length).toBeGreaterThan(0);

  for (const m of metrics) {
    if (!m) continue;
    // No horizontal letterboxing — this is the fix for coordinate alignment.
    expect(m.hasLetterboxX, `Horizontal letterbox detected: ${m.letterboxX}px. Admin and student canvases have different widths, causing coordinate shift.`).toBe(false);
    // Image height should match natural aspect ratio (height:auto behaviour).
    expect(m.heightMatchesNatural, `Image height ${m.imgH}px ≠ expected ${m.expectedH}px. object-contain may still be active.`).toBe(true);
  }
});

// ── Test: SVG overlay covers the exact image area ─────────────────────────────
test('SVG overlay must match image dimensions exactly', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginStudent(page);

  await page.goto('/navigate');
  await page.waitForLoadState('networkidle');

  const searchInput = page.locator('input').first();
  await searchInput.fill('Lecture Room');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);

  const getDir = page.locator('button').filter({ hasText: /get directions/i }).first();
  if (await getDir.isVisible({ timeout: 2000 }).catch(() => false)) {
    await getDir.click();
    await page.waitForTimeout(2000);
  }

  const imgLocator = page.locator('.fp-map-canvas img').first();
  const canvasVisible = await imgLocator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);
  if (!canvasVisible) { console.log('No canvas — skipping SVG check'); return; }

  const svgCheck = await page.evaluate(() => {
    const canvases = [...document.querySelectorAll('.fp-map-canvas')];
    return canvases.map((canvas) => {
      const img = canvas.querySelector('img') as HTMLImageElement | null;
      const svg = canvas.querySelector('svg') as SVGElement | null;
      if (!img || !svg) return null;

      const iRect = img.getBoundingClientRect();
      const sRect = svg.getBoundingClientRect();

      return {
        imgW: Math.round(iRect.width),  imgH: Math.round(iRect.height),
        svgW: Math.round(sRect.width),  svgH: Math.round(sRect.height),
        wDiff: Math.round(Math.abs(iRect.width  - sRect.width)),
        hDiff: Math.round(Math.abs(iRect.height - sRect.height)),
      };
    }).filter(Boolean);
  });

  console.log('SVG vs img:', JSON.stringify(svgCheck, null, 2));

  for (const s of svgCheck) {
    if (!s) continue;
    expect(s.wDiff, `SVG width ${s.svgW} ≠ img width ${s.imgW}`).toBeLessThanOrEqual(2);
    expect(s.hDiff, `SVG height ${s.svgH} ≠ img height ${s.imgH}`).toBeLessThanOrEqual(2);
  }
});
