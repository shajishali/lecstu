# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: floor-plan-alignment.spec.ts >> SVG overlay must match image dimensions exactly
- Location: tests\floor-plan-alignment.spec.ts:126:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('input').first()

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
```

# Test source

```ts
  34  | test('floor plan image has no letterboxing (height:auto, no object-contain)', async ({ page }) => {
  35  |   // Use a fixed 1280×900 viewport so measurements are deterministic.
  36  |   await page.setViewportSize({ width: 1280, height: 900 });
  37  |   await loginStudent(page);
  38  | 
  39  |   // Navigate to Find My Way and wait for the page to settle.
  40  |   await page.goto('/navigate');
  41  |   await page.waitForLoadState('networkidle');
  42  | 
  43  |   // Trigger a search so a floor plan with route renders.
  44  |   // Try filling the search box with any room name and submitting.
  45  |   const searchInput = page.locator('input').first();
  46  |   await searchInput.fill('Seminar Room');
  47  |   await page.keyboard.press('Enter');
  48  |   await page.waitForTimeout(1500);
  49  | 
  50  |   // Press "Get directions" if it appears.
  51  |   const getDir = page.locator('button').filter({ hasText: /get directions/i }).first();
  52  |   if (await getDir.isVisible({ timeout: 2000 }).catch(() => false)) {
  53  |     await getDir.click();
  54  |     await page.waitForTimeout(2000);
  55  |   }
  56  | 
  57  |   // Wait for a floor plan canvas to render (with route).
  58  |   const imgLocator = page.locator('.fp-map-canvas img').first();
  59  |   const canvasVisible = await imgLocator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);
  60  | 
  61  |   if (!canvasVisible) {
  62  |     // No floor plan rendered — might be no route configured yet.
  63  |     console.log('No floor plan canvas visible — skipping letterbox check.');
  64  |     return;
  65  |   }
  66  | 
  67  |   // Screenshot for visual inspection.
  68  |   const dir = snapDir();
  69  |   await page.screenshot({ path: path.join(dir, 'student-find-my-way.png') });
  70  | 
  71  |   // ── Measure letterboxing ───────────────────────────────────────────────────
  72  |   const metrics = await page.evaluate(() => {
  73  |     const canvases = [...document.querySelectorAll('.fp-map-canvas')];
  74  |     return canvases.map((canvas) => {
  75  |       const img = canvas.querySelector('img') as HTMLImageElement | null;
  76  |       if (!img || !img.naturalWidth) return null;
  77  | 
  78  |       const iRect = img.getBoundingClientRect();
  79  |       const nW    = img.naturalWidth;
  80  |       const nH    = img.naturalHeight;
  81  | 
  82  |       // object-contain scale = min(iW/nW, iH/nH)
  83  |       const scaleByW = iRect.width  / nW;
  84  |       const scaleByH = iRect.height / nH;
  85  |       const scale    = Math.min(scaleByW, scaleByH);
  86  | 
  87  |       const contentW = nW * scale;
  88  |       const contentH = nH * scale;
  89  | 
  90  |       const letterboxX = (iRect.width  - contentW) / 2;
  91  |       const letterboxY = (iRect.height - contentH) / 2;
  92  | 
  93  |       const hasLetterboxX = letterboxX > 2; // >2px tolerance
  94  |       const hasLetterboxY = letterboxY > 2;
  95  | 
  96  |       return {
  97  |         imgW: Math.round(iRect.width),
  98  |         imgH: Math.round(iRect.height),
  99  |         naturalW: nW,
  100 |         naturalH: nH,
  101 |         letterboxX: Math.round(letterboxX),
  102 |         letterboxY: Math.round(letterboxY),
  103 |         hasLetterboxX,
  104 |         hasLetterboxY,
  105 |         // With height:auto and no object-contain:
  106 |         // imgW ≈ container width, imgH ≈ naturalH * (containerW / naturalW)
  107 |         expectedH: Math.round(iRect.width * nH / nW),
  108 |         heightMatchesNatural: Math.abs(iRect.height - (iRect.width * nH / nW)) < 3,
  109 |       };
  110 |     }).filter(Boolean);
  111 |   });
  112 | 
  113 |   console.log('Floor plan metrics:', JSON.stringify(metrics, null, 2));
  114 |   expect(metrics.length).toBeGreaterThan(0);
  115 | 
  116 |   for (const m of metrics) {
  117 |     if (!m) continue;
  118 |     // No horizontal letterboxing — this is the fix for coordinate alignment.
  119 |     expect(m.hasLetterboxX, `Horizontal letterbox detected: ${m.letterboxX}px. Admin and student canvases have different widths, causing coordinate shift.`).toBe(false);
  120 |     // Image height should match natural aspect ratio (height:auto behaviour).
  121 |     expect(m.heightMatchesNatural, `Image height ${m.imgH}px ≠ expected ${m.expectedH}px. object-contain may still be active.`).toBe(true);
  122 |   }
  123 | });
  124 | 
  125 | // ── Test: SVG overlay covers the exact image area ─────────────────────────────
  126 | test('SVG overlay must match image dimensions exactly', async ({ page }) => {
  127 |   await page.setViewportSize({ width: 1280, height: 900 });
  128 |   await loginStudent(page);
  129 | 
  130 |   await page.goto('/navigate');
  131 |   await page.waitForLoadState('networkidle');
  132 | 
  133 |   const searchInput = page.locator('input').first();
> 134 |   await searchInput.fill('Lecture Room');
      |                     ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  135 |   await page.keyboard.press('Enter');
  136 |   await page.waitForTimeout(1200);
  137 | 
  138 |   const getDir = page.locator('button').filter({ hasText: /get directions/i }).first();
  139 |   if (await getDir.isVisible({ timeout: 2000 }).catch(() => false)) {
  140 |     await getDir.click();
  141 |     await page.waitForTimeout(2000);
  142 |   }
  143 | 
  144 |   const imgLocator = page.locator('.fp-map-canvas img').first();
  145 |   const canvasVisible = await imgLocator.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => null);
  146 |   if (!canvasVisible) { console.log('No canvas — skipping SVG check'); return; }
  147 | 
  148 |   const svgCheck = await page.evaluate(() => {
  149 |     const canvases = [...document.querySelectorAll('.fp-map-canvas')];
  150 |     return canvases.map((canvas) => {
  151 |       const img = canvas.querySelector('img') as HTMLImageElement | null;
  152 |       const svg = canvas.querySelector('svg') as SVGElement | null;
  153 |       if (!img || !svg) return null;
  154 | 
  155 |       const iRect = img.getBoundingClientRect();
  156 |       const sRect = svg.getBoundingClientRect();
  157 | 
  158 |       return {
  159 |         imgW: Math.round(iRect.width),  imgH: Math.round(iRect.height),
  160 |         svgW: Math.round(sRect.width),  svgH: Math.round(sRect.height),
  161 |         wDiff: Math.round(Math.abs(iRect.width  - sRect.width)),
  162 |         hDiff: Math.round(Math.abs(iRect.height - sRect.height)),
  163 |       };
  164 |     }).filter(Boolean);
  165 |   });
  166 | 
  167 |   console.log('SVG vs img:', JSON.stringify(svgCheck, null, 2));
  168 | 
  169 |   for (const s of svgCheck) {
  170 |     if (!s) continue;
  171 |     expect(s.wDiff, `SVG width ${s.svgW} ≠ img width ${s.imgW}`).toBeLessThanOrEqual(2);
  172 |     expect(s.hDiff, `SVG height ${s.svgH} ≠ img height ${s.imgH}`).toBeLessThanOrEqual(2);
  173 |   }
  174 | });
  175 | 
```