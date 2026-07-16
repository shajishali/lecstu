# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: enrollment-timetable-sync.spec.ts >> Enrollment change → timetable auto-update >> DIAGNOSTIC — show current class and slot count
- Location: tests\enrollment-timetable-sync.spec.ts:105:7

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - link "LECSTU" [ref=e6] [cursor=pointer]:
      - /url: /dashboard
      - img "LECSTU" [ref=e7]
    - navigation [ref=e8]:
      - link "Dashboard" [ref=e10] [cursor=pointer]:
        - /url: /dashboard
        - img [ref=e12]
        - generic [ref=e17]: Dashboard
      - link "19 My Timetable" [ref=e19] [cursor=pointer]:
        - /url: /timetable
        - generic [ref=e20]:
          - img [ref=e21]
          - generic [ref=e23]: "19"
        - generic [ref=e24]: My Timetable
      - link "Approvals" [ref=e26] [cursor=pointer]:
        - /url: /approvals
        - img [ref=e28]
        - generic [ref=e31]: Approvals
      - link "Hall Availability" [ref=e33] [cursor=pointer]:
        - /url: /halls/availability
        - img [ref=e35]
        - generic [ref=e37]: Hall Availability
      - link "Lecturers" [ref=e39] [cursor=pointer]:
        - /url: /lecturers
        - img [ref=e41]
        - generic [ref=e44]: Lecturers
      - link "Book Appointment" [ref=e46] [cursor=pointer]:
        - /url: /appointments
        - img [ref=e48]
        - generic [ref=e51]: Book Appointment
      - link "Find My Way" [ref=e53] [cursor=pointer]:
        - /url: /navigate
        - img [ref=e55]
        - generic [ref=e57]: Find My Way
      - link "19 Notifications" [ref=e59] [cursor=pointer]:
        - /url: /notifications
        - generic [ref=e60]:
          - img [ref=e61]
          - generic [ref=e64]: "19"
        - generic [ref=e65]: Notifications
      - link "My Profile" [ref=e67] [cursor=pointer]:
        - /url: /profile
        - img [ref=e69]
        - generic [ref=e72]: My Profile
    - generic [ref=e74]: STUDENT
  - generic [ref=e75]:
    - banner [ref=e76]:
      - generic [ref=e77]:
        - generic [ref=e78]:
          - img [ref=e79]
          - combobox "UI language" [ref=e82]:
            - option "English" [selected]
            - option "தமிழ்"
            - option "සිංහල"
        - button "19" [ref=e84]:
          - img [ref=e85]
          - generic [ref=e88]: "19"
        - generic [ref=e89]:
          - img [ref=e91]
          - generic [ref=e94]: Test Student
        - button "Logout" [ref=e95]:
          - img [ref=e96]
    - main [ref=e99]:
      - generic [ref=e100]:
        - heading "My Profile" [level=1] [ref=e101]
        - generic [ref=e102]:
          - img [ref=e103]
          - generic [ref=e106]: Enrollment updated to CS-Y3-AINT. Your profile and timetable are now in sync.
        - generic [ref=e107]:
          - generic [ref=e108]:
            - generic [ref=e109] [cursor=pointer]:
              - img [ref=e111]
              - img [ref=e115]
            - heading "Test Student" [level=3] [ref=e118]
            - generic [ref=e119]: STUDENT
            - paragraph [ref=e120]: testaint@lecstu.edu
            - paragraph [ref=e121]: "Group: CS-Y3-AINT (CS-AINT)"
          - generic [ref=e122]:
            - heading "Edit Profile" [level=2] [ref=e123]
            - generic [ref=e124]:
              - generic [ref=e125]:
                - generic [ref=e126]:
                  - generic [ref=e127]: First Name
                  - textbox "First Name" [ref=e128]: Test
                - generic [ref=e129]:
                  - generic [ref=e130]: Last Name
                  - textbox "Last Name" [ref=e131]: Student
              - generic [ref=e132]:
                - generic [ref=e133]: Email
                - textbox "Email" [ref=e134]: testaint@lecstu.edu
                - paragraph [ref=e135]: Used to sign in. Password reset codes are sent to your recovery email when set.
              - generic [ref=e136]:
                - generic [ref=e137]: Recovery email (password reset)
                - textbox "Recovery email (password reset)" [ref=e138]:
                  - /placeholder: your.personal@gmail.com
                - paragraph [ref=e139]:
                  - text: Password reset codes are sent here when set; otherwise they go to your login email above. Click
                  - strong [ref=e140]: Save Changes
                  - text: after editing, then request a code.
              - generic [ref=e141]:
                - generic [ref=e142]: Phone
                - textbox "Phone" [ref=e143]:
                  - /placeholder: e.g. +94 77 123 4567
              - generic [ref=e144]:
                - generic [ref=e145]: Role
                - textbox [disabled] [ref=e146]: STUDENT
              - button "Save Changes" [ref=e147]:
                - img [ref=e148]
                - text: Save Changes
            - generic [ref=e153]:
              - generic [ref=e154]:
                - img [ref=e155]
                - heading "Password" [level=3] [ref=e158]
              - generic [ref=e159]:
                - generic [ref=e160]:
                  - generic [ref=e161]: Current password
                  - textbox "Password is set" [disabled] [ref=e162]: ••••••••
                  - paragraph [ref=e163]: Your password is stored securely and cannot be displayed.
                - button "Change password" [ref=e164]:
                  - img [ref=e165]
                  - text: Change password
            - generic [ref=e168]:
              - generic [ref=e169]:
                - generic [ref=e170]: Current class group
                - textbox [ref=e171]: CS-Y3-AINT
              - generic [ref=e172]:
                - heading "Academic year enrollment" [level=3] [ref=e173]
                - generic [ref=e174]:
                  - paragraph [ref=e175]: Update each academic year when you advance (e.g. Y2 to Y3 and choose your pathway).
                  - generic [ref=e176]:
                    - generic [ref=e177]: Degree program
                    - combobox "Degree program" [ref=e178]:
                      - option "Select"
                      - option "CS - Computer Science" [selected]
                      - option "ET - Engineering Technology"
                      - option "CT - Computing Technology"
                      - option "BS - Biological System"
                  - generic [ref=e179]:
                    - generic [ref=e180]: Study year
                    - combobox "Study year" [ref=e181]:
                      - option "Select"
                      - option "Y1"
                      - option "Y2"
                      - option "Y3" [selected]
                      - option "Y4"
                  - generic [ref=e182]:
                    - generic [ref=e183]: Pathway (Y3 / Y4)
                    - combobox "Pathway (Y3 / Y4)" [ref=e184]:
                      - option "Select"
                      - option "AINT - Artificial Intelligence" [selected]
                      - option "DSCI - Data Science"
                      - option "CSEC - Cyber Security"
                      - option "SPCS - Special Pathway"
                  - generic [ref=e185]:
                    - generic [ref=e186]: Class batch
                    - textbox "Class batch" [ref=e187]: CS-Y3-AINT
                  - button "Update for new study year" [ref=e188]
  - button "Open chat" [ref=e189]:
    - img [ref=e190]
```

# Test source

```ts
  1   | /**
  2   |  * Playwright E2E test — profile enrollment change → timetable auto-update
  3   |  *
  4   |  * Verifies that when a student changes their degree program / study year /
  5   |  * pathway on the Profile page, the My Timetable page immediately reflects
  6   |  * the new class group after navigation — no manual refresh required.
  7   |  *
  8   |  * HOW TO RUN (dev servers must be up first):
  9   |  *   npx playwright test tests/enrollment-timetable-sync.spec.ts --reporter=list
  10  |  */
  11  | 
  12  | import { test, expect, type Page } from '@playwright/test';
  13  | 
  14  | const STUDENT_EMAIL    = 'testaint@lecstu.edu';
  15  | const STUDENT_PASSWORD = 'Test1234!';
  16  | 
  17  | // ── Login ─────────────────────────────────────────────────────────────────────
  18  | async function login(page: Page) {
  19  |   await page.goto('/login');
  20  |   await page.locator('#email').fill(STUDENT_EMAIL);
  21  |   await page.locator('#password').fill(STUDENT_PASSWORD);
  22  |   await page.locator('button[type="submit"]').click();
  23  |   await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
  24  | }
  25  | 
  26  | // ── Navigate to My Timetable and wait for subtitle to render ─────────────────
  27  | async function goToTimetable(page: Page) {
  28  |   await page.getByRole('link', { name: /^my timetable$/i }).click();
> 29  |   await page.waitForURL(/\/timetable$/, { timeout: 15_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  30  |   await page.waitForSelector('.tt-subtitle', { timeout: 20_000 });
  31  |   await page.waitForTimeout(800);
  32  | }
  33  | 
  34  | // ── Navigate to My Profile ────────────────────────────────────────────────────
  35  | async function goToProfile(page: Page) {
  36  |   await page.getByRole('link', { name: /^my profile$/i }).click();
  37  |   await page.waitForURL(/\/profile$/, { timeout: 10_000 });
  38  |   // Wait for the enrollment form to be loaded (programs fetched from server)
  39  |   await expect(page.locator('[data-testid="enroll-program"]')).toBeVisible({ timeout: 10_000 });
  40  |   await page.waitForTimeout(300);
  41  | }
  42  | 
  43  | // ── Read timetable subtitle text ──────────────────────────────────────────────
  44  | async function getTimetableSubtitle(page: Page): Promise<string> {
  45  |   return (await page.locator('.tt-subtitle').textContent()) ?? '';
  46  | }
  47  | 
  48  | // ── Change enrollment and wait for success ────────────────────────────────────
  49  | async function changeEnrollment(
  50  |   page: Page,
  51  |   programCode: string,
  52  |   studyYear: string,
  53  |   pathwayCode?: string,
  54  | ) {
  55  |   await expect(page.locator('[data-testid="enroll-program"]')).toBeEnabled({ timeout: 8_000 });
  56  | 
  57  |   // Select program
  58  |   await page.locator('[data-testid="enroll-program"]').selectOption(programCode);
  59  |   await page.waitForTimeout(400);
  60  | 
  61  |   // Select study year (enabled only after program selected)
  62  |   await expect(page.locator('[data-testid="enroll-year"]')).toBeEnabled({ timeout: 5_000 });
  63  |   await page.locator('[data-testid="enroll-year"]').selectOption(studyYear);
  64  |   await page.waitForTimeout(400);
  65  | 
  66  |   // Select pathway if required
  67  |   if (pathwayCode) {
  68  |     await expect(page.locator('[data-testid="enroll-pathway"]')).toBeVisible({ timeout: 5_000 });
  69  |     await page.locator('[data-testid="enroll-pathway"]').selectOption(pathwayCode);
  70  |     await page.waitForTimeout(400);
  71  |   }
  72  | 
  73  |   // Click Update
  74  |   const updateBtn = page.getByRole('button', { name: /update for new study year/i });
  75  |   await updateBtn.click();
  76  | 
  77  |   // Wait for success message
  78  |   await expect(
  79  |     page.locator('.border-emerald-200')
  80  |   ).toBeVisible({ timeout: 15_000 });
  81  | 
  82  |   console.log('  Enrollment changed to:', programCode, studyYear, pathwayCode ?? '');
  83  |   await page.waitForTimeout(500);
  84  | }
  85  | 
  86  | // ═══════════════════════════════════════════════════════════════════════════════
  87  | test.describe('Enrollment change → timetable auto-update', () => {
  88  | 
  89  |   test.beforeEach(async ({ page }) => {
  90  |     await login(page);
  91  |   });
  92  | 
  93  |   // Always reset after each test so the next test starts from a known state
  94  |   test.afterEach(async ({ page }) => {
  95  |     try {
  96  |       await goToProfile(page);
  97  |       await changeEnrollment(page, 'CS', 'Y3', 'AINT');
  98  |       console.log('  [afterEach] Reset to CS-Y3-AINT ✓');
  99  |     } catch {
  100 |       console.warn('  [afterEach] Reset failed — next test may start in unexpected state');
  101 |     }
  102 |   });
  103 | 
  104 |   // ── 1. DIAGNOSTIC ──────────────────────────────────────────────────────────
  105 |   test('DIAGNOSTIC — show current class and slot count', async ({ page }) => {
  106 |     await goToTimetable(page);
  107 |     const subtitle = await getTimetableSubtitle(page);
  108 |     console.log('\nSubtitle:', subtitle);
  109 |     expect(true).toBe(true);
  110 |   });
  111 | 
  112 |   // ── 2. CS-Y3-AINT → CS-Y2 (no pathway) ───────────────────────────────────
  113 |   test('timetable updates: CS-Y3-AINT (13 slots) → CS-Y2 (19 slots)', async ({ page }) => {
  114 |     // Verify starting state
  115 |     await goToTimetable(page);
  116 |     const before = await getTimetableSubtitle(page);
  117 |     console.log('\nBefore:', before);
  118 |     expect(before).toContain('CS-Y3-AINT');
  119 | 
  120 |     // Change enrollment
  121 |     await goToProfile(page);
  122 |     await changeEnrollment(page, 'CS', 'Y2');
  123 | 
  124 |     // Navigate to timetable — must show new class WITHOUT manual refresh
  125 |     await goToTimetable(page);
  126 |     const after = await getTimetableSubtitle(page);
  127 |     console.log('After :', after);
  128 | 
  129 |     expect(after).toContain('CS-Y2');
```