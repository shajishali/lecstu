# Problems faced when hosting LECSTU

Log of issues encountered during Oracle Cloud hosting and how they were resolved.

**Guide:** [hostingSteps.md](./hostingSteps.md)  
**Started:** 20 June 2026

---

## How to use this file

When something goes wrong during hosting:

1. Add an entry under the relevant phase/subphase.
2. Write **Problem** (what happened / error message).
3. Write **Solution** (what fixed it).
4. Mark **Status:** Resolved / Workaround / Still open.

If a phase completed with no issues, note **No problems** so we know it was verified.

---

## Phase 1 — Prepare on Windows PC

### 1.1 — Confirm local app works

**Status:** OK — no problems

- API (`npm run dev:server`, port 5000) and client (`npm run dev:client`, port 5173) ran locally.
- Login and core features worked as expected.

---

### 1.2 — Remove test login accounts

**Status:** OK — no problems

Commands used:

```powershell
cd d:\Reasearch\lecstu\server
npx tsx scripts/remove-test-hosting-accounts.ts --dry-run
npm run db:remove-test-hosting-accounts
```

- Dry-run and live run both completed successfully.
- Test accounts `lecturer@stu.kln.ac.lk` and `student@stu.kln.ac.lk` were not in the database (already absent).
- **92 users** remained — real data untouched.

---

### 1.3 — Export real database

**Status:** OK — no problems

Backup created:

| Item | Value |
|------|--------|
| File | `d:\Reasearch\lecstu\lecstu-backup.dump` |
| Size | ~506 KB |
| Database | `lecstu` on `localhost:5432` |
| User | `postgres` (from `server/.env`) |

Command used (PostgreSQL 16 `pg_dump` full path):

```powershell
$env:PGPASSWORD='1234'
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -h localhost -p 5432 -d lecstu -F c -f "d:\Reasearch\lecstu\lecstu-backup.dump"
```

---

### 1.4 — Gather files to upload

**Status:** Not started

| Problem | Solution |
|---------|----------|
| — | — |

---

### 1.5 — Install Windows tools (PuTTY, WinSCP, Oracle keys)

**Status:** Not started

| Problem | Solution |
|---------|----------|
| — | — |

---

## Phase 2 — Connect & secure the server

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 3 — Install system software

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 4 — Upload project & data

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 5 — Database setup

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 6 — Build & configure LECSTU

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 7 — Go live (Nginx + PM2 + verify)

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Phase 8 — Optional (HTTPS, AI, maintenance)

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| — | — | — |

---

## Quick reference — things to remember

- **Never run `npm run db:seed` on production** — it wipes all data.
- **Re-run test account removal on the server** after DB restore: `npm run db:remove-test-hosting-accounts`
- **Do not commit** `server/.env`, passwords, or `.ppk` keys to Git.
