# Software Verification Run — 2026-07-09

**Researcher:** P. Shakiththiyan  
**Run date (UTC):** 2026-07-08T20:49:44Z – 2026-07-08T21:09:11Z (~19.4 min Playwright)  
**Local date:** 9 July 2026 (IST)

## Environment

| Item | Value |
|---|---|
| OS | Windows 10 (build 26200), x64 |
| Node.js | v22.17.1 |
| npm | 10.5.0 |
| TypeScript | 5.9.3 (client + server) |
| Vite | 7.3.1 |
| Playwright | 1.60.0 (`@playwright/test`) |
| Browser | Google Chrome (system channel, headless) |
| Prisma | 7.4.0 |
| Database | PostgreSQL (local `server/.env` `DATABASE_URL`) |
| Application mode | **Dev stack** — `npm run dev:server` (port 5000) + `npm run dev:client` (port 5173) |
| Production builds | `npm run build:server` (tsc) + `npm run build:client` (tsc + vite build) — **both succeeded** before E2E |
| Test account | `testaint@lecstu.edu` (seeded Y3 CS-AINT student) |
| Code coverage | **Not measured** (no Istanbul/c8 configuration in repository) |

## Suite summary

| Suite | Tests | Passed | Failed | Skipped | Duration |
|---|---:|---:|---:|---:|---|
| Playwright E2E (`tests/*.spec.ts`) | 26 | **4** | **22** | 0 | 1,166.7 s (~19.4 min) |
| Phase 12.6 API (`server/scripts/run-phase-12-6-tests.ts`) | 10 | **10** | 0 | 0 | ~27 s |
| ASR manifest validator | 1 | 1 | 0 | — | <1 s |
| Translation manifest validator | 1 | 1 | 0 | — | <1 s |
| Server ESLint | — | — | — | — | **Not run** (`eslint` not on PATH; static check via `tsc` build only) |

## Playwright — passed (4)

1. `student-timetable.spec.ts` — login succeeds and reaches dashboard  
2. `password-reset-flow.spec.ts` — forgot-password link on login page  
3. `password-reset-flow.spec.ts` — unknown email shows generic success copy  
4. `enrollment-timetable-sync.spec.ts` — profile current class group field updates after enrollment change  

## Playwright — failed (22) — primary causes

| Area | Count | Likely cause |
|---|---:|---|
| Timetable UI assertions | 17 | Tests expect subtitle text `in selected period` and group label `CS-Y3-AINT`; current UI renders `Student schedule: N slots · Class: Y3 AINT · …` (copy/format drift) |
| Enrollment sync | 3 | Same subtitle/navigation selectors; one test partially passed (profile field) |
| Floor-plan alignment | 2 | **Timeout** reaching indoor navigation UI (seed/building data or route mismatch) |
| Password-reset full UI flow | 1 | Post-reset login step failed (selector or dev-reset-code timing) |

## Artifacts

| File | Description |
|---|---|
| [playwright-results.json](./playwright-results.json) | Machine-readable Playwright report |
| [playwright-console.log](./playwright-console.log) | Full console output |
| [summary.txt](./summary.txt) | Per-test pass/fail list |
| [artifacts/](./artifacts/) | Screenshots, videos, traces on failure |

## Commands used

```bash
npm run build:server && npm run build:client
npm run dev:server   # background, port 5000
npm run dev:client   # background, port 5173
npx playwright install ffmpeg
npx playwright test --reporter=list --reporter=json --output=research/reports/software_verification_run_2026-07-09/artifacts
cd server && npm run test:phase-12-6
python research/datasets/asr/scripts/validate_manifest.py
python research/datasets/translation/scripts/validate_manifest.py
```

## Interpretation for thesis

This run provides **reproducible evidence** of the verification pipeline (build, manifest checks, API security tests, Playwright harness). The **low E2E pass rate (4/26)** reflects **test–UI drift** and environment preconditions, not necessarily total platform failure — login, generic forgot-password messaging, and profile enrollment updates still pass. Before claiming full regression coverage, update selectors to match current timetable copy and ensure Phase 11 indoor-navigation seed data is loaded for floor-plan specs.
