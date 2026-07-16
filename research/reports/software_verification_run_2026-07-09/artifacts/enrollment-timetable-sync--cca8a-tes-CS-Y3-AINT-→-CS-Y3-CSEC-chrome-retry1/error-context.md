# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: enrollment-timetable-sync.spec.ts >> Enrollment change → timetable auto-update >> timetable updates: CS-Y3-AINT → CS-Y3-CSEC
- Location: tests\enrollment-timetable-sync.spec.ts:135:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected substring: "CS-Y3-AINT"
Received string:    "Student schedule: 13 slots · Class: Y3 AINT · Last updated: Not updated yet"
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
      - link "My Timetable" [ref=e19] [cursor=pointer]:
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
        - heading "My Profile" [level=1] [ref=e98]
        - generic [ref=e99]:
          - img [ref=e100]
          - generic [ref=e103]: Enrollment updated to CS-Y3-AINT. Your profile and timetable are now in sync.
        - generic [ref=e104]:
          - generic [ref=e105]:
            - generic [ref=e106] [cursor=pointer]:
              - img [ref=e108]
              - img [ref=e112]
            - heading "Test Student" [level=3] [ref=e115]
            - generic [ref=e116]: STUDENT
            - paragraph [ref=e117]: testaint@lecstu.edu
            - paragraph [ref=e118]: "Group: CS-Y3-AINT (CS-AINT)"
          - generic [ref=e119]:
            - heading "Edit Profile" [level=2] [ref=e120]
            - generic [ref=e121]:
              - generic [ref=e122]:
                - generic [ref=e123]:
                  - generic [ref=e124]: First Name
                  - textbox "First Name" [ref=e125]: Test
                - generic [ref=e126]:
                  - generic [ref=e127]: Last Name
                  - textbox "Last Name" [ref=e128]: Student
              - generic [ref=e129]:
                - generic [ref=e130]: Email
                - textbox "Email" [ref=e131]: testaint@lecstu.edu
                - paragraph [ref=e132]: Used to sign in. Password reset codes are sent to your recovery email when set.
              - generic [ref=e133]:
                - generic [ref=e134]: Recovery email (password reset)
                - textbox "Recovery email (password reset)" [ref=e135]:
                  - /placeholder: your.personal@gmail.com
                - paragraph [ref=e136]:
                  - text: Password reset codes are sent here when set; otherwise they go to your login email above. Click
                  - strong [ref=e137]: Save Changes
                  - text: after editing, then request a code.
              - generic [ref=e138]:
                - generic [ref=e139]: Phone
                - textbox "Phone" [ref=e140]:
                  - /placeholder: e.g. +94 77 123 4567
              - generic [ref=e141]:
                - generic [ref=e142]: Role
                - textbox [disabled] [ref=e143]: STUDENT
              - button "Save Changes" [ref=e144]:
                - img [ref=e145]
                - text: Save Changes
            - generic [ref=e150]:
              - generic [ref=e151]:
                - img [ref=e152]
                - heading "Password" [level=3] [ref=e155]
              - generic [ref=e156]:
                - generic [ref=e157]:
                  - generic [ref=e158]: Current password
                  - textbox "Password is set" [disabled] [ref=e159]: ••••••••
                  - paragraph [ref=e160]: Your password is stored securely and cannot be displayed.
                - button "Change password" [ref=e161]:
                  - img [ref=e162]
                  - text: Change password
            - generic [ref=e165]:
              - generic [ref=e166]:
                - generic [ref=e167]: Current class group
                - textbox [ref=e168]: CS-Y3-AINT
              - generic [ref=e169]:
                - heading "Academic year enrollment" [level=3] [ref=e170]
                - generic [ref=e171]:
                  - paragraph [ref=e172]: Update each academic year when you advance (e.g. Y2 to Y3 and choose your pathway).
                  - generic [ref=e173]:
                    - generic [ref=e174]: Degree program
                    - combobox "Degree program" [ref=e175]:
                      - option "Select"
                      - option "CS - Computer Science" [selected]
                      - option "ET - Engineering Technology"
                      - option "CT - Computing Technology"
                      - option "BS - Biological System"
                  - generic [ref=e176]:
                    - generic [ref=e177]: Study year
                    - combobox "Study year" [ref=e178]:
                      - option "Select"
                      - option "Y1"
                      - option "Y2"
                      - option "Y3" [selected]
                      - option "Y4"
                  - generic [ref=e179]:
                    - generic [ref=e180]: Pathway (Y3 / Y4)
                    - combobox "Pathway (Y3 / Y4)" [ref=e181]:
                      - option "Select"
                      - option "AINT - Artificial Intelligence" [selected]
                      - option "DSCI - Data Science"
                      - option "CSEC - Cyber Security"
                      - option "SPCS - Special Pathway"
                  - generic [ref=e182]:
                    - generic [ref=e183]: Class batch
                    - textbox "Class batch" [ref=e184]: CS-Y3-AINT
                  - button "Update for new study year" [ref=e185]
  - button "Open chat" [ref=e186]:
    - img [ref=e187]
```

# Test source

```ts
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
  130 |     // CS-Y2 has 19 slots; subtitle says "19 slots in selected period"
  131 |     expect(after).toContain('19');
  132 |   });
  133 | 
  134 |   // ── 3. CS-Y3-AINT → CS-Y3-CSEC (same year, different pathway) ────────────
  135 |   test('timetable updates: CS-Y3-AINT → CS-Y3-CSEC', async ({ page }) => {
  136 |     await goToTimetable(page);
  137 |     const before = await getTimetableSubtitle(page);
  138 |     console.log('\nBefore:', before);
> 139 |     expect(before).toContain('CS-Y3-AINT');
      |                    ^ Error: expect(received).toContain(expected) // indexOf
  140 | 
  141 |     await goToProfile(page);
  142 |     await changeEnrollment(page, 'CS', 'Y3', 'CSEC');
  143 | 
  144 |     await goToTimetable(page);
  145 |     const after = await getTimetableSubtitle(page);
  146 |     console.log('After :', after);
  147 | 
  148 |     expect(after).toContain('CS-Y3-CSEC');
  149 |     // CS-Y3-CSEC has 17 slots
  150 |     expect(after).toContain('17');
  151 |   });
  152 | 
  153 |   // ── 4. Current class group field on profile updates immediately ───────────
  154 |   test('profile current class group field updates after enrollment change', async ({ page }) => {
  155 |     await goToProfile(page);
  156 | 
  157 |     // Read starting group
  158 |     const groupBefore = await page.locator('input[readonly]').first().inputValue();
  159 |     console.log('\nGroup before:', groupBefore);
  160 |     expect(groupBefore).toBe('CS-Y3-AINT');
  161 | 
  162 |     // Change to CS-Y2
  163 |     await changeEnrollment(page, 'CS', 'Y2');
  164 | 
  165 |     // The "Current class group" readonly field must reflect the new group right away
  166 |     await expect(page.locator('input[readonly]').first()).toHaveValue('CS-Y2', { timeout: 8_000 });
  167 |     console.log('Group after:', await page.locator('input[readonly]').first().inputValue());
  168 |   });
  169 | });
  170 | 
```