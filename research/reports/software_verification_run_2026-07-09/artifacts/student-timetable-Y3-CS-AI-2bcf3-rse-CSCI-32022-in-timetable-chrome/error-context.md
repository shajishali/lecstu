# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-timetable.spec.ts >> Y3 CS-AINT student timetable >> shows course CSCI 32022 in timetable
- Location: tests\student-timetable.spec.ts:146:9

# Error details

```
TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
        - link "My Timetable" [active] [ref=e19] [cursor=pointer]:
          - /url: /timetable
          - img [ref=e21]
          - generic [ref=e23]: My Timetable
        - link "Approvals" [ref=e25] [cursor=pointer]:
          - /url: /approvals
          - img [ref=e27]
          - generic [ref=e30]: Approvals
        - link "Hall Availability" [ref=e32] [cursor=pointer]:
          - /url: /halls/availability
          - img [ref=e34]
          - generic [ref=e36]: Hall Availability
        - link "Lecturers" [ref=e38] [cursor=pointer]:
          - /url: /lecturers
          - img [ref=e40]
          - generic [ref=e43]: Lecturers
        - link "Book Appointment" [ref=e45] [cursor=pointer]:
          - /url: /appointments
          - img [ref=e47]
          - generic [ref=e50]: Book Appointment
        - link "Find My Way" [ref=e52] [cursor=pointer]:
          - /url: /navigate
          - img [ref=e54]
          - generic [ref=e56]: Find My Way
        - link "Notifications" [ref=e58] [cursor=pointer]:
          - /url: /notifications
          - img [ref=e60]
          - generic [ref=e63]: Notifications
        - link "My Profile" [ref=e65] [cursor=pointer]:
          - /url: /profile
          - img [ref=e67]
          - generic [ref=e70]: My Profile
      - generic [ref=e72]: STUDENT
    - generic [ref=e73]:
      - banner [ref=e74]:
        - generic [ref=e75]:
          - generic [ref=e76]:
            - img [ref=e77]
            - combobox "UI language" [ref=e80]:
              - option "English" [selected]
              - option "தமிழ்"
              - option "සිංහල"
          - button "Notifications" [ref=e82]:
            - img [ref=e83]
          - generic [ref=e86]:
            - img [ref=e88]
            - generic [ref=e91]: Test Student
          - button "Logout" [ref=e92]:
            - img [ref=e93]
      - main [ref=e96]:
        - generic [ref=e97]:
          - generic [ref=e98]:
            - heading "Welcome back, Test!" [level=1] [ref=e99]
            - paragraph [ref=e100]: Here's what's happening today
          - generic [ref=e101]:
            - link "Next Lecture No classes scheduled" [ref=e102] [cursor=pointer]:
              - /url: /timetable
              - img [ref=e104]
              - generic [ref=e107]:
                - heading "Next Lecture" [level=3] [ref=e108]
                - paragraph [ref=e109]: No classes scheduled
            - link "My Schedule 0 classes today" [ref=e110] [cursor=pointer]:
              - /url: /timetable
              - img [ref=e112]
              - generic [ref=e114]:
                - heading "My Schedule" [level=3] [ref=e115]
                - paragraph [ref=e116]: 0 classes today
            - link "My Courses No classes scheduled" [ref=e117] [cursor=pointer]:
              - /url: /timetable
              - img [ref=e119]
              - generic [ref=e121]:
                - heading "My Courses" [level=3] [ref=e122]
                - paragraph [ref=e123]: No classes scheduled
          - generic [ref=e124]:
            - generic [ref=e125]:
              - generic [ref=e126]:
                - generic [ref=e127]:
                  - heading "Today's schedule" [level=3] [ref=e128]
                  - paragraph [ref=e129]: Thursday · 2026-07-09
                - button "Refresh" [ref=e131]:
                  - img [ref=e132]
              - paragraph [ref=e137]: No classes scheduled for today.
            - generic [ref=e138]:
              - generic [ref=e139]:
                - img [ref=e140]
                - generic [ref=e142]:
                  - heading "Indoor Navigation" [level=2] [ref=e143]
                  - paragraph [ref=e144]: Clear walking directions inside the building
              - generic [ref=e145]:
                - generic [ref=e146]:
                  - generic [ref=e147]: Building
                  - combobox "Building" [ref=e148]:
                    - option "Academic Building" [selected]
                    - option "Administration Building"
                    - option "Laboratory Building"
                - generic [ref=e149]:
                  - generic [ref=e150]: Floor
                  - combobox "Floor" [ref=e151]:
                    - option "Ground floor" [selected]
                    - option "Floor 1"
                    - option "Floor 2"
                    - option "Floor 3"
                    - option "Floor 4"
                    - option "Floor 5"
                    - option "Floor 6"
                    - option "Floor 7"
                    - option "Floor 8"
                    - option "Floor 9"
              - generic [ref=e152]:
                - generic [ref=e153]: Where do you want to go?
                - generic [ref=e154]:
                  - combobox "Where do you want to go? Go" [ref=e155]:
                    - option "Select a place" [selected]
                    - option "CAFETERIA"
                    - option "CAREER GUIDANCE UNIT"
                    - option "DIRECTOR'S ROOM"
                    - option "ENTRANCE FOR ENTRANCE OF THE FACULTY"
                    - option "ENTRANCE FOR THE STAIRCASE & LIFT 1"
                    - option "ENTRANCE FOR THE STAIRCASE & LIFT 2"
                    - option "ENTRANCE LOBBY"
                    - option "GENERAL COMPUTER LAB 1"
                    - option "IT LAB REPAIR ROOM"
                    - option "IT LAB STORE"
                    - option "STAIRCASE & LIFT 1"
                    - option "STAIRCASE & LIFT 2"
                    - option "WASH ROOM"
                  - button "Go" [disabled] [ref=e156]:
                    - img [ref=e157]
                    - text: Go
              - paragraph [ref=e160]: Starts from the ground-floor entrance of the Administration Building. 13 places on Ground floor (140 total in building).
              - link "Open full guide →" [ref=e161] [cursor=pointer]:
                - /url: /navigate
          - generic [ref=e163]:
            - heading "Your Profile" [level=3] [ref=e164]
            - table [ref=e165]:
              - rowgroup [ref=e166]:
                - row "Name Test Student" [ref=e167]:
                  - cell "Name" [ref=e168]
                  - cell "Test Student" [ref=e169]
                - row "Email testaint@lecstu.edu" [ref=e170]:
                  - cell "Email" [ref=e171]
                  - cell "testaint@lecstu.edu" [ref=e172]
                - row "Role STUDENT" [ref=e173]:
                  - cell "Role" [ref=e174]
                  - cell "STUDENT" [ref=e175]
                - row "Group CS-Y3-AINT" [ref=e176]:
                  - cell "Group" [ref=e177]
                  - cell "CS-Y3-AINT" [ref=e178]
                - row "Department Computer Science" [ref=e179]:
                  - cell "Department" [ref=e180]
                  - cell "Computer Science" [ref=e181]
    - button "Open chat" [ref=e182]:
      - img [ref=e183]
  - generic [ref=e185]:
    - heading "Timetable updates" [level=3] [ref=e187]
    - generic [ref=e188]:
      - generic [ref=e189] [cursor=pointer]:
        - generic [ref=e191]: Class in 30 minutes
        - generic [ref=e192]: "----CSCI-32083-T --- CSCI 32083 T Lecturer: VL_BK Room: AB-LCH-07-2 Time: 13:00-13:55"
        - generic [ref=e193]: 7/7/2026
      - generic [ref=e194] [cursor=pointer]:
        - generic [ref=e196]: Class in 30 minutes
        - generic [ref=e197]: "CSCI-32062 Computer Graphics Lecturer: SCALE_UP VL_IG Room: AB-SCALE-08-02 Time: 11:00-11:55"
        - generic [ref=e198]: 7/7/2026
      - generic [ref=e199] [cursor=pointer]:
        - generic [ref=e201]: Class in 30 minutes
        - generic [ref=e202]: "CSCI-32092-T CSCI 32092 T Lecturer: TBD Room: AB-LCH-03-2 Time: 15:00–15:55"
        - generic [ref=e203]: 7/6/2026
      - generic [ref=e204] [cursor=pointer]:
        - generic [ref=e206]: Class in 30 minutes
        - generic [ref=e207]: "AINT-32012-T AINT 32012 T Lecturer: SK Room: AB-LCH-04-1 Time: 14:00–14:55"
        - generic [ref=e208]: 7/6/2026
      - generic [ref=e209] [cursor=pointer]:
        - generic [ref=e211]: Class in 30 minutes
        - generic [ref=e212]: "CSCI-32012-T CSCI 32012 T Lecturer: ND Room: AB-LCH-03-1 Time: 13:00–13:55"
        - generic [ref=e213]: 7/6/2026
    - button "View timetable" [ref=e215]
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
> 53  |   await page.waitForURL(/\/timetable$/, { timeout: 15_000 });
      |              ^ TimeoutError: page.waitForURL: Timeout 15000ms exceeded.
  54  | 
  55  |   // Wait until the subtitle that contains "in selected period" is visible.
  56  |   // This text is rendered by MyTimetable ONLY after the API call returns data.
  57  |   // The subtitle: "{n} slots in selected period · Class: CS-Y3-AINT (CS Y3 AINT)"
  58  |   await expect(
  59  |     page.locator('text=/in selected period/i')
  60  |   ).toBeVisible({ timeout: 25_000 });
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
```