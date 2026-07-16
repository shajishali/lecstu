# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-timetable.spec.ts >> Y3 CS-AINT student timetable >> shows course CSCI 32092 in timetable
- Location: tests\student-timetable.spec.ts:146:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=/in selected period/i')
Expected: visible
Timeout: 25000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 25000ms
  - waiting for locator('text=/in selected period/i')

```

```yaml
- complementary:
  - link "LECSTU":
    - /url: /dashboard
    - img "LECSTU"
  - navigation:
    - link "Dashboard":
      - /url: /dashboard
    - link "My Timetable":
      - /url: /timetable
    - link "Approvals":
      - /url: /approvals
    - link "Hall Availability":
      - /url: /halls/availability
    - link "Lecturers":
      - /url: /lecturers
    - link "Book Appointment":
      - /url: /appointments
    - link "Find My Way":
      - /url: /navigate
    - link "Notifications":
      - /url: /notifications
    - link "My Profile":
      - /url: /profile
  - text: STUDENT
- banner:
  - combobox "UI language":
    - option "English" [selected]
    - option "தமிழ்"
    - option "සිංහල"
  - button "Notifications"
  - text: Test Student
  - button "Logout"
- main:
  - heading "My Timetable" [level=1]
  - paragraph:
    - text: "Student schedule: 13 slots · Class:"
    - strong: Y3 AINT
    - text: "· Last updated:"
    - strong: Not updated yet
  - button "Refresh"
  - button "Print"
  - button "Export CSV"
  - heading "Personalize your timetable (Y3 / Y4)" [level=2]
  - paragraph: Compulsory modules always stay on your timetable. Tick the optional or elective subjects you are taking, then save to build your personal view.
  - heading "Compulsory modules" [level=3]
  - text: AINT 31012 — Natural Language Processing AINT 31022 — Deductive Reasoning and Logic Programming AINT 32012 AINT 32022 CSCI 31014 — Mathematics for Computer Science III CSCI 31022 — Machine Learning and Pattern Recognition CSCI 32012 CSCI 32022 CSCI 32032 CSCI 32042 — Social and Professional Issues CSCI 32052 — Distributed Systems & Cloud Computing CSCI 32062 — Computer Graphics CSCI 32073 — Introduction to Game Development CSCI 32083 — --- CSCI 32083 T CSCI 32092 CSEC 32012 — --- CSEC 32012 T DELT 33212 — English for Professional Purposes MGMT 31012 — Introduction to Entrepreneurship
  - heading "Optional / elective modules" [level=3]
  - checkbox "CSCI 31032 — Theory of Programming Languages2 credits"
  - text: CSCI 31032 — Theory of Programming Languages2 credits
  - checkbox "CSCI 31042 — Advanced Data Structures and Algorithms2 credits"
  - text: CSCI 31042 — Advanced Data Structures and Algorithms2 credits
  - checkbox "CSCI 31052 — Project Management2 credits"
  - text: CSCI 31052 — Project Management2 credits
  - checkbox "CSCI 31062 — Semantic Web and Ontological Modeling2 credits"
  - text: CSCI 31062 — Semantic Web and Ontological Modeling2 credits
  - checkbox "CSCI 31072 — Python Programming2 credits"
  - text: CSCI 31072 — Python Programming2 credits
  - checkbox "CSCI 31082 — Systems and Network Administration2 credits"
  - text: CSCI 31082 — Systems and Network Administration2 credits
  - checkbox "CSEC 31012 — Applied Cryptography2 credits"
  - text: CSEC 31012 — Applied Cryptography2 credits
  - checkbox "CSEC 31022 — Data and Systems Security2 credits"
  - text: CSEC 31022 — Data and Systems Security2 credits
  - checkbox "CSEC 32022 — Advanced Computer Communication and Networking2 credits"
  - text: CSEC 32022 — Advanced Computer Communication and Networking2 credits
  - checkbox "CSEC 32032"
  - text: CSEC 32032
  - checkbox "DSCI 32012 — Advanced Database Applications2 credits"
  - text: DSCI 32012 — Advanced Database Applications2 credits
  - checkbox "SCOM 32012 — Parallel Computing2 credits"
  - text: SCOM 32012 — Parallel Computing2 credits
  - button "Select all"
  - button "Clear optional"
  - button "Save personal timetable"
  - text: Y3 AINT(CS Y3 AINT)
  - table:
    - rowgroup:
      - row "Time Monday Tuesday Wednesday Thursday Friday Saturday Sunda y":
        - columnheader "Time"
        - columnheader "Monday"
        - columnheader "Tuesday"
        - columnheader "Wednesday"
        - columnheader "Thursday"
        - columnheader "Friday"
        - columnheader "Saturday"
        - columnheader "Sunda y"
    - rowgroup:
      - 'row "08:00 - 08:55 GANI 32024 Lecturer: Kasun Vithanage Room: AB-CMP-02-3 CSCI 32073 — Room: LB-CMP-10-1 --- --- CSCI 32092 Lecturer: VL_HS Room: AB-LCH-04-1 --- ---"':
        - cell "08:00 - 08:55"
        - 'cell "GANI 32024 Lecturer: Kasun Vithanage Room: AB-CMP-02-3"'
        - 'cell "CSCI 32073 — Room: LB-CMP-10-1"'
        - cell "---"
        - cell "---"
        - 'cell "CSCI 32092 Lecturer: VL_HS Room: AB-LCH-04-1"'
        - cell "---"
        - cell "---"
      - 'row "09:00 - 09.55 CSCI 32083 Lecturer: Manusha Lakmali Room: AB-LCH-07-2 --- --- ---"':
        - cell "09:00 - 09.55"
        - 'cell "CSCI 32083 Lecturer: Manusha Lakmali Room: AB-LCH-07-2"'
        - cell "---"
        - cell "---"
        - cell "---"
      - 'row "10:00 - 10:55 CSCI 32012 Lecturer: Nimal Dias Room: AB-LCH-05-2 AINT 32012 Lecturer: S. P. Kasthuri Arachchi Room: LB-LCH-01-1 DELT 33212 — Room: AB-LCH-09-2 CSCI 32042 Lecturer: VL_6 Room: AB-LCH-07-1 ---"':
        - cell "10:00 - 10:55"
        - 'cell "CSCI 32012 Lecturer: Nimal Dias Room: AB-LCH-05-2"'
        - 'cell "AINT 32012 Lecturer: S. P. Kasthuri Arachchi Room: LB-LCH-01-1"'
        - 'cell "DELT 33212 — Room: AB-LCH-09-2"'
        - 'cell "CSCI 32042 Lecturer: VL_6 Room: AB-LCH-07-1"'
        - cell "---"
      - row "11:00 - 11:55 ---":
        - cell "11:00 - 11:55"
        - cell "---"
      - row "12:00 - 12:55 -X- -X- -X- -X- -X- -X- ---":
        - cell "12:00 - 12:55"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "---"
      - 'row "13:00 - 13:55 --- --- CSCI 32032 Lecturer: Sidath Liyanage Room: AB-LCH-07-2 AINT 32022 — Room: AB-LCH-05-2 --- --- ---"':
        - cell "13:00 - 13:55"
        - cell "---"
        - cell "---"
        - 'cell "CSCI 32032 Lecturer: Sidath Liyanage Room: AB-LCH-07-2"'
        - 'cell "AINT 32022 — Room: AB-LCH-05-2"'
        - cell "---"
        - cell "---"
        - cell "---"
      - 'row "14:00 - 14:55 DSCI 32012 Lecturer: Kanthathasan Harish Room: AB-CMP-02-1 --- --- --- ---"':
        - cell "14:00 - 14:55"
        - 'cell "DSCI 32012 Lecturer: Kanthathasan Harish Room: AB-CMP-02-1"'
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
      - 'row "15:00 - 15:55 --- CSCI 32052 — Room: AB-CMP-07-1 CSCI 32022 Lecturer: S. K. M. S. Silva Room: AB-LCH-07-1 --- --- ---"':
        - cell "15:00 - 15:55"
        - cell "---"
        - 'cell "CSCI 32052 — Room: AB-CMP-07-1"'
        - 'cell "CSCI 32022 Lecturer: S. K. M. S. Silva Room: AB-LCH-07-1"'
        - cell "---"
        - cell "---"
        - cell "---"
      - row "16:00 - 16:55 --- --- --- ---":
        - cell "16:00 - 16:55"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
      - row "17:00 - 17:55 -X- -X- -X- -X- -X- -X- ---":
        - cell "17:00 - 17:55"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "-X-"
        - cell "---"
      - row "18:00 - 18:55 --- --- --- --- --- --- ---":
        - cell "18:00 - 18:55"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
      - row "19:00 - 19:55 --- --- --- --- --- --- ---":
        - cell "19:00 - 19:55"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
      - row "20:00 - 20:55 --- --- --- --- --- --- ---":
        - cell "20:00 - 20:55"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
        - cell "---"
- button "Open chat"
```

# Test source

```ts
  1   | /**
  2   |  * Playwright E2E test — Student timetable for Y3 CS-AINT
  3   |  *
  4   |  * Verifies that all expected subjects from the real Y3 AINT Excel timetable
  5   |  * appear on the student's "My Timetable" page.
  6   |  *
  7   |  * HOW TO RUN (dev servers must be up first):
  8   |  *   npx playwright test tests/student-timetable.spec.ts --reporter=list
  9   |  *   – or –
  10  |  *   npm run test:timetable
  11  |  */
  12  | 
  13  | import { test, expect, type Page } from '@playwright/test';
  14  | 
  15  | // ── Credentials (Y3 CS-AINT test student registered via API) ─────────────────
  16  | const STUDENT_EMAIL    = 'testaint@lecstu.edu';
  17  | const STUDENT_PASSWORD = 'Test1234!';
  18  | 
  19  | // ── Expected courses that MUST appear in the Y3 AINT timetable ───────────────
  20  | // Courses marked *fix* were silently dropped by the parser before the fix.
  21  | const REQUIRED_COURSES = [
  22  |   'CSCI 32012',
  23  |   'CSCI 32073',   // *fix* — shared "Y3 AINT, Y3 SPCS"
  24  |   'CSCI 32083',
  25  |   'CSCI 32032',
  26  |   'CSCI 32052',
  27  |   'CSCI 32022',
  28  |   'CSCI 32092',
  29  |   'CSCI 32042',
  30  |   'AINT 32012',   // *fix* — shared "Y3 AINT, Y3 SPCS"
  31  |   'AINT 32022',   // *fix* — shared "Y3 AINT, Y3 SPCS, Y3 DSCI"
  32  |   'DELT 33212',
  33  |   'DSCI 32012',   // *fix* — shared "Y3 CS, Y3 SWST"
  34  | ];
  35  | 
  36  | // ── Login helper ──────────────────────────────────────────────────────────────
  37  | async function login(page: Page) {
  38  |   await page.goto('/login');
  39  |   await page.locator('#email').fill(STUDENT_EMAIL);
  40  |   await page.locator('#password').fill(STUDENT_PASSWORD);
  41  |   await page.locator('button[type="submit"]').click();
  42  |   // Wait until we leave /login
  43  |   await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
  44  | }
  45  | 
  46  | // ── Navigate to My Timetable and wait for timetable data to render ─────────────
  47  | async function goToTimetable(page: Page) {
  48  |   // SPA navigation: click the sidebar nav link to keep auth state in memory
  49  |   const navLink = page.getByRole('link', { name: /^my timetable$/i });
  50  |   await navLink.click();
  51  | 
  52  |   // Wait for URL to settle on /timetable
  53  |   await page.waitForURL(/\/timetable$/, { timeout: 15_000 });
  54  | 
  55  |   // Wait until the subtitle that contains "in selected period" is visible.
  56  |   // This text is rendered by MyTimetable ONLY after the API call returns data.
  57  |   // The subtitle: "{n} slots in selected period · Class: CS-Y3-AINT (CS Y3 AINT)"
  58  |   await expect(
  59  |     page.locator('text=/in selected period/i')
> 60  |   ).toBeVisible({ timeout: 25_000 });
      |     ^ Error: expect(locator).toBeVisible() failed
  61  | 
  62  |   // Small extra pause for calendar events + legend to finish rendering
  63  |   await page.waitForTimeout(1500);
  64  | }
  65  | 
  66  | // ── Collect all course labels from the DOM ───────────────────────────────────
  67  | // Uses CSS selectors targeting the exact elements that render course codes.
  68  | async function getVisibleCourseCodes(page: Page): Promise<string[]> {
  69  |   return page.evaluate(() => {
  70  |     const texts = new Set<string>();
  71  |     // Legend items (shown below the calendar)
  72  |     document.querySelectorAll<HTMLElement>('.tt-legend-item').forEach((el) => {
  73  |       const t = el.textContent?.trim();
  74  |       if (t) texts.add(t);
  75  |     });
  76  |     // Slot code spans (inside each calendar event card)
  77  |     document.querySelectorAll<HTMLElement>('.tt-slot-code').forEach((el) => {
  78  |       const t = el.textContent?.trim();
  79  |       if (t) texts.add(t);
  80  |     });
  81  |     // Mobile slot course spans
  82  |     document.querySelectorAll<HTMLElement>('.tt-mobile-slot-course').forEach((el) => {
  83  |       const t = el.textContent?.trim();
  84  |       if (t) texts.add(t);
  85  |     });
  86  |     return Array.from(texts);
  87  |   });
  88  | }
  89  | 
  90  | // ── Check if a required code appears in the list (handles spaces/dashes) ──────
  91  | function codeFound(visibleCodes: string[], required: string): boolean {
  92  |   const variants = [
  93  |     required,                          // "CSCI 32012"
  94  |     required.replace(' ', ''),         // "CSCI32012"
  95  |     required.replace(' ', '-'),        // "CSCI-32012"
  96  |   ];
  97  |   return visibleCodes.some((visible) =>
  98  |     variants.some((v) => visible.includes(v))
  99  |   );
  100 | }
  101 | 
  102 | // ════════════════════════════════════════════════════════════════════════════
  103 | // Tests
  104 | // ════════════════════════════════════════════════════════════════════════════
  105 | test.describe('Y3 CS-AINT student timetable', () => {
  106 |   test.beforeEach(async ({ page }) => {
  107 |     await login(page);
  108 |   });
  109 | 
  110 |   // ── Sanity checks ──────────────────────────────────────────────────────────
  111 |   test('login succeeds and reaches dashboard', async ({ page }) => {
  112 |     await expect(page).not.toHaveURL(/login/);
  113 |     await expect(page.locator('body')).toContainText(/welcome/i, { timeout: 10_000 });
  114 |   });
  115 | 
  116 |   test('My Timetable page loads with CS-Y3-AINT group', async ({ page }) => {
  117 |     await goToTimetable(page);
  118 |     // The subtitle shows "· Class: CS-Y3-AINT (CS Y3 AINT)" once enrollment is loaded
  119 |     await expect(page.locator('body')).toContainText('CS-Y3-AINT', { timeout: 10_000 });
  120 |   });
  121 | 
  122 |   test('timetable shows at least 1 slot in the selected period', async ({ page }) => {
  123 |     await goToTimetable(page);
  124 |     const txt = await page.locator('body').innerText();
  125 |     // The subtitle says "10 slots in selected period" — extract the number
  126 |     const match = txt.match(/(\d+)\s+slots?\s+in\s+selected\s+period/i);
  127 |     const count = match ? parseInt(match[1], 10) : 0;
  128 |     expect(count, 'Expected ≥1 slot to be visible in the selected period').toBeGreaterThan(0);
  129 |   });
  130 | 
  131 |   // ── Diagnostic (always passes — prints what's visible) ────────────────────
  132 |   test('DIAGNOSTIC — list visible course codes', async ({ page }) => {
  133 |     await goToTimetable(page);
  134 |     const codes = await getVisibleCourseCodes(page);
  135 |     console.log('\n=== Visible course codes on My Timetable ===');
  136 |     console.log(codes.join(', ') || '(none found)');
  137 |     console.log('\n=== Required courses status ===');
  138 |     for (const req of REQUIRED_COURSES) {
  139 |       console.log(`  ${codeFound(codes, req) ? '✓' : '✗'} ${req}`);
  140 |     }
  141 |     expect(true).toBe(true); // always passes
  142 |   });
  143 | 
  144 |   // ── Per-course regression tests ────────────────────────────────────────────
  145 |   for (const code of REQUIRED_COURSES) {
  146 |     test(`shows course ${code} in timetable`, async ({ page }) => {
  147 |       await goToTimetable(page);
  148 |       const codes = await getVisibleCourseCodes(page);
  149 |       const found = codeFound(codes, code);
  150 | 
  151 |       if (!found) {
  152 |         await page.screenshot({
  153 |           path: `test-results/${code.replace(' ', '-')}-missing.png`,
  154 |           fullPage: true,
  155 |         });
  156 |       }
  157 | 
  158 |       expect(
  159 |         found,
  160 |         [
```