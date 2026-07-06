# Problems faced when hosting LECSTU

Log of issues encountered during Oracle Cloud hosting and how they were resolved.

**Guide:** [hostingSteps.md](./hostingSteps.md)  
**Started:** 20 June 2026  
**Last updated:** 7 July 2026 (post-hosting development fixes from Cursor chats)

---

## How to use this file

When something goes wrong during hosting:

1. Add an entry under the relevant phase/subphase.
2. Write **Problem** (what happened / error message).
3. Write **Solution** (what fixed it).
4. Mark **Status:** Resolved / Workaround / Still open.

If a phase completed with no issues, note **No problems** so we know it was verified.

**Screenshots** for each step are saved in [`hosting-screenshots/`](./hosting-screenshots/) and linked below. Chat screenshots from Cursor development sessions (July 2026) are copied there as `dev-fix01-…` through `dev-fix22-…`.

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

**Screenshot — PostgreSQL services running (Windows Services):**

![Phase 1.3 — PostgreSQL 15/16/17 services running](./hosting-screenshots/phase1-postgresql-services.png)

*Reference only — all three PostgreSQL versions were Running; LECSTU uses port 5432 from `server/.env`.*

---

### 1.4 — Gather files to upload

**Status:** OK — no problems

Verified with `Test-Path` (all returned `True`):

| Check | Path |
|-------|------|
| Database backup | `lecstu-backup.dump` (~0.5 MB) |
| Floor plan uploads | `server/uploads/floorplans/` (33 files, ~2.3 MB) |
| Server app | `server/package.json` |
| Client app | `client/package.json` |

**Upload plan:** Project code + `lecstu-backup.dump` + `server/uploads/` in Phase 4. Do **not** upload `server/.env`, `node_modules/`, or `.venv/`.

---

### 1.5 — Install Windows tools (PuTTY, WinSCP, Oracle keys)

**Status:** OK — no problems

| Item | Status |
|------|--------|
| PuTTY | Already installed |
| Oracle public IP | In use (LECSTU-Oracle session) |
| `.ppk` private key | Configured in PuTTY |
| WinSCP (optional) | Not needed yet — Git for code |

---

## Phase 2 — Connect & secure the server

### 2.1 — Configure PuTTY session

**Status:** OK — no problems

- Saved session: `LECSTU-Oracle`
- Host: `ubuntu@` + Oracle public IP, port 22, SSH
- Private key (`.ppk`) set under Connection → SSH → Auth → Credentials

**Screenshots:**

![Phase 2.1 — PuTTY Session (IP + port 22)](./hosting-screenshots/phase2-01-putty-session-ip.png)

![Phase 2.1 — PuTTY SSH Auth → Private key file](./hosting-screenshots/phase2-02-putty-ssh-auth-key.png)

### 2.2 — Connect and verify

**Status:** OK — no problems

- Connected successfully to `ubuntu@instance-20260618-1906`
- Ubuntu 20.04 LTS, ~77 GB disk (~3% used), low memory use
- `whoami` → `ubuntu`, `pwd` → `/home/ubuntu`

**Screenshots:**

![Phase 2.2 — First SSH login (Ubuntu welcome)](./hosting-screenshots/phase2-03-putty-connected.png)

![Phase 2.2 — whoami and pwd verified](./hosting-screenshots/phase2-04-whoami-pwd.png)

---

### 2.3 — Open Oracle Cloud firewall

**Status:** OK — no problems

Ingress rules confirmed: TCP **22** (SSH), **80** (HTTP), **443** (HTTPS) from `0.0.0.0/0`.

**Screenshot:**

![Phase 2.3 — Oracle Cloud ingress rules (22, 80, 443)](./hosting-screenshots/phase2-05-oracle-firewall.png)

### 2.4 — Open Ubuntu firewall (ufw)

**Status:** OK — no problems (after adding port 80)

- `sudo ufw enable` — firewall active on startup
- Rules: OpenSSH (22), 80/tcp, 443/tcp

**Screenshot:**

![Phase 2.4 — ufw status (final: 22, 80, 443)](./hosting-screenshots/phase2-07-ufw-status-with-80.png)

### 2.5 — Update system and create project folder

**Status:** OK — no problems

- `sudo apt update && sudo apt upgrade -y` — 7 packages upgraded
- Installed: `curl`, `wget`, `git`, `unzip`, `build-essential`
- Project folder: `/var/www/lecstu` (owned by `ubuntu`)

**Screenshot:**

![Phase 2.5 — pwd /var/www/lecstu](./hosting-screenshots/phase2-08-var-www-lecstu.png)

---

## Phase 3 — Install system software

### 3.1 — Node.js 20

**Status:** OK — no problems

- Installed Node.js **20.20.2** via NodeSource

### 3.2 — PM2

**Status:** OK — no problems

- `sudo npm install -g pm2`

### 3.3 — PostgreSQL

**Status:** OK — no problems

- PostgreSQL **12** installed, enabled, running

### 3.4 — Nginx

**Status:** OK — fixed iptables rule order

**Problem:** Browser showed `ERR_CONNECTION_TIMED_OUT` on `http://149.118.54.64`, but `curl -I http://127.0.0.1` returned `200 OK` on the server.

**Cause:** Oracle Ubuntu image has an iptables **REJECT** rule (line 5) **before** the port 80/443 ACCEPT rules, so web traffic was blocked.

**Solution:** Move ACCEPT rules **above** REJECT:

```bash
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -D INPUT -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -m state --state NEW -p tcp --dport 443 -j ACCEPT
```

**Screenshots:**

![Phase 3.4 — Browser timeout before fix](./hosting-screenshots/phase3-01-nginx-timeout-error.png)

![Phase 3.4 — iptables REJECT before port 80/443 rules](./hosting-screenshots/phase3-02-iptables-diagnose.png)

![Phase 3.4 — Nginx welcome page working](./hosting-screenshots/phase3-03-nginx-welcome.png)

---

## Phase 4 — Upload project & data

### 4.1 — Clone project from GitHub

**Status:** OK — no problems

```bash
cd /var/www/lecstu
git clone https://github.com/shajishali/lecstu.git .
```

- 1310 objects cloned (~320 MB)

**Screenshot:**

![Phase 4.1 — git clone complete](./hosting-screenshots/phase4-01-git-clone.png)

### 4.2 — Upload database backup and uploads folder

**Status:** OK — no problems

Database dump uploaded via `pscp` to `/home/ubuntu/lecstu-backup.dump` (505 kB).

Floor plan images uploaded to `/var/www/lecstu/server/uploads/floorplans/` (~33 files).

**Screenshots:**

![Phase 4.2 — pscp lecstu-backup.dump](./hosting-screenshots/phase4-02-pscp-backup.png)

![Phase 4.2 — pscp floorplans upload](./hosting-screenshots/phase4-03-pscp-floorplans.png)

### 4.3 — Verify project structure

**Status:** OK — no problems

- `package.json`, `client/package.json`, `server/package.json` present
- `/home/ubuntu/lecstu-backup.dump` present
- Floor plans in `/var/www/lecstu/server/uploads/floorplans/`

---

## Phase 5 — Database setup

### Server credentials (fill in — do not commit real password to Git)

| Item | Value |
|------|--------|
| Oracle public IP | `149.118.54.64` |
| Public URL | `https://lecstu.com` |
| SSH user | `ubuntu` |
| Project path | `/var/www/lecstu` |
| PostgreSQL database | `lecstu` |
| PostgreSQL user | `lecstu_user` |
| PostgreSQL password | *(your generated password — keep in private notes)* |
| Backup file on server | `/home/ubuntu/lecstu-backup.dump` |
| `DATABASE_URL` (for `.env`) | `postgresql://lecstu_user:YOUR_PASSWORD@localhost:5432/lecstu?schema=public` |

### 5.1 — Create database user

**Status:** OK — no problems (after retry)

**Problem:** First attempt — `CREATE DATABASE` failed with `role "lecstu_user" does not exist` because `CREATE USER` did not run first.

**Solution:** Run SQL **one line at a time** in `psql`:

```sql
CREATE USER lecstu_user WITH PASSWORD '<generated-password>';
CREATE DATABASE lecstu OWNER lecstu_user;
GRANT ALL PRIVILEGES ON DATABASE lecstu TO lecstu_user;
\q
```

- Password: **new generated password** (`openssl rand -base64 24`) — **not** the local `postgres` password
- All three commands succeeded on retry

**Screenshots:**

![Phase 5.1 — database create errors (first attempt)](./hosting-screenshots/phase5-01-db-create-errors.png)

![Phase 5.1 — CREATE ROLE success](./hosting-screenshots/phase5-02-create-role.png)

### 5.2 — Test database connection

**Status:** OK — no problems

**Problem:** Connection URL failed with `could not translate host name "1234@localhost"` — wrong URL format (missing `:` before password, or used local postgres password `1234` incorrectly).

**Solution:** Use `PGPASSWORD` instead of URL:

```bash
PGPASSWORD='your-password' psql -U lecstu_user -h localhost -d lecstu -c "SELECT 1;"
```

**Screenshot:**

![Phase 5.2 — SELECT 1 success](./hosting-screenshots/phase5-03-select-1-success.png)

### 5.3 — Apply schema (migrations)

**Status:** OK — no problems (after fixing `.env`)

**Problems faced:**
1. `P1013 invalid port number` — `.env` still had template `USER:HOST:PORT/DATABASE` placeholders
2. Empty password — `read -s` run without pasting hex password → `lecstu_user:@localhost`
3. Base64 password with `+`, `/`, `=` broke URL parsing — switched to **hex password** via `openssl rand -hex 24`

**Solution that worked:**
```bash
openssl rand -hex 24
sudo -u postgres psql -c "ALTER USER lecstu_user WITH PASSWORD 'hex-password';"
read -s DBPASS && echo && sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://lecstu_user:${DBPASS}@localhost:5432/lecstu?schema=public|" .env
npx prisma migrate deploy
```

- **26 migrations** applied successfully

### 5.4 — Restore real data from backup

**Status:** OK — no problems (data-only SQL + manual schema patches)

**Problem:** `pg_restore: error: unsupported version (1.15) in file header`

**Cause:** Backup created with **PostgreSQL 16** (`pg_dump` on Windows). Server has **PostgreSQL 12** — older `pg_restore` cannot read newer dump format.

**Solution:** Re-export as **plain SQL** (`.sql`) on Windows, upload again, restore with `psql -f`.

**Update — SQL full restore also failed:** Schema already existed from `prisma migrate deploy`. Errors: `already exists`, FK violations, `doorPassword` column mismatch. Database is in a **partial/broken** state.

**New plan:**
1. ~~Re-export with PostgreSQL 12~~ — **PG 12 not installed on Windows** (only 15/16/17). Server has PG 12.
2. Export **data-only** SQL from PG 16 on Windows → `lecstu-data-only.sql` (~2.1 MB) ✅
**Update — data-only restore partial success:** 92 users imported, then failed on `lecture_halls.doorPassword` — column exists in `schema.prisma` but **no migration** added it to DB.

**Fix:** Manually add column on server, then reset data and re-import.

**Schema patches applied before import (no migration):**
- `lecture_halls.doorPassword`, `hall_bookings.doorPassword`
- `HallBookingStatus` + `CANCELLED`
- `master_timetable.notes`

**Latest import:** OK — data restored. Final fix: created `timetable_table_snapshots` table manually, imported with `COPY 25`.

**Status:** OK — no problems (with manual schema patches)

### 5.5 — Remove test accounts again

**Status:** OK — no problems

- Ran `npx prisma generate` first (required)
- Test accounts not in backup — **92 users** remain

---

## Phase 6 — Build & configure LECSTU

**Status:** OK — completed (after TypeScript build fixes)

### 6.1 — Install Node dependencies

**Status:** OK — no problems

### 6.2 — Production `.env` values

**Status:** OK — no problems (with later corrections in Phase 7)

- `NODE_ENV=production`
- `CLIENT_URL=http://149.118.54.64`
- `DATABASE_URL=postgresql://lecstu_user:...@localhost:5432/lecstu?schema=public`

### 6.3 — Server build failed (TypeScript)

**Status:** Resolved

**Problem:** `npm run build` on the server failed with many `tsc` errors (40 errors / 15 files), including:

- `TS6059` — `shared/` and `server/prisma/fct-faculty-config.ts` outside `rootDir` (`server/src`)
- Missing imports (`findAvailableNow`, `getHallDaySchedule`)
- Prisma strict typing mismatches
- Duplicate identifiers in `timetableTableService.ts`

**Solution:** Fix the code locally (Windows), commit + push, then `git pull` on server.

Local (Windows):

```powershell
cd D:\Reasearch\lecstu
git add server/src server/prisma/fct-faculty-config.ts
git commit -m "Fix server TypeScript build errors for production deployment"
git push
```

Server (PuTTY):

```bash
cd /var/www/lecstu
git pull
cd server
npm run build
```

### 6.3 — Client build failed (TypeScript)

**Status:** Resolved

**Problem:** `npm run build` failed with 21 TypeScript errors (unused variables, missing Web Speech API types, JSX typing errors, etc.).

**Solution:** Fix the client locally (Windows), commit + push, then `git pull` on server and rebuild:

Local (Windows):

```powershell
cd D:\Reasearch\lecstu
git add client/src
git commit -m "Fix client TypeScript build errors for production deployment"
git push
```

Server (PuTTY):

```bash
cd /var/www/lecstu
git pull
cd client
npm run build
```

### 6.3 — Verify build outputs

**Status:** OK — no problems

```bash
ls -la /var/www/lecstu/server/dist/server.js
ls -la /var/www/lecstu/client/dist/index.html
```

### 6.4 — Uploads folder permissions

**Status:** OK — no problems

```bash
mkdir -p /var/www/lecstu/server/uploads/floorplans
chmod -R 755 /var/www/lecstu/server/uploads
```

---

## Phase 7 — Go live (Nginx + PM2 + verify)

**Status:** OK — site live on **https://lecstu.com** (HTTPS added 7 July 2026 — see Fix 13)

### 7.1 — Nginx site config

**Status:** Resolved

**Problem:** Needed to serve client build and reverse-proxy API (`/api`) + uploads.

**Solution:** Create `/etc/nginx/sites-available/lecstu`, enable it, remove default site, reload:

```bash
sudo nano /etc/nginx/sites-available/lecstu
sudo ln -sf /etc/nginx/sites-available/lecstu /etc/nginx/sites-enabled/lecstu
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 7.2 — PM2 start API

**Status:** OK — no problems

```bash
cd /var/www/lecstu/server
pm2 start dist/server.js --name lecstu-api
pm2 logs lecstu-api --lines 30
curl -s http://127.0.0.1:5000/api/health
```

### 7.2 — `NODE_ENV` was development after go-live

**Status:** Resolved

**Problem:** PM2 logs showed `Environment: development` even after deployment.

**Solution:** Update `.env`, restart PM2, confirm logs:

```bash
sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' /var/www/lecstu/server/.env
pm2 restart lecstu-api
pm2 logs lecstu-api --lines 8
```

### 7.5 — Login blocked: HTTPS required for auth (production)

**Status:** Resolved — superseded by Fix 13 (real HTTPS on `lecstu.com`)

**Problem:** Login page showed: `HTTPS is required for authentication requests.`

**Cause:** Server enforces HTTPS for `/api/auth/*` in production (`requireHttpsInProduction` middleware).

**Solution (temporary until you have a domain + SSL):**

1. Add support for `ALLOW_HTTP_AUTH=true` (code change committed to GitHub)
2. Set `ALLOW_HTTP_AUTH=true` on the server and restart PM2
3. Fix `CLIENT_URL` to the public IP (was incorrectly `http://localhost:5173`)

Server (PuTTY):

```bash
cd /var/www/lecstu && git pull
cd server && npm run build
grep -q '^ALLOW_HTTP_AUTH=' .env || echo 'ALLOW_HTTP_AUTH=true' >> .env
sed -i 's/^ALLOW_HTTP_AUTH=.*/ALLOW_HTTP_AUTH=true/' .env
sed -i 's|^CLIENT_URL=.*|CLIENT_URL=http://149.118.54.64|' .env
pm2 restart lecstu-api
```

### 7.3 — PM2 auto-start on reboot

**Status:** OK — no problems

```bash
pm2 save
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
pm2 save
```

Verify:

```bash
pm2 list
curl -s http://149.118.54.64/api/health
```

---

## Post-deployment fixes (local → GitHub → production pull)

Changes made on the Windows PC after Phases 1–7 went live. Deploy each batch with the standard update flow in [hostingSteps.md](./hostingSteps.md) (`git pull`, rebuild server/client, `pm2 restart`, `nginx reload`).

**Rule:** Edit code on **Windows** → `git push` → on **production** run `git pull` + rebuild/restart. Do **not** edit tracked files directly on the server (see Fix 2).

---

### Fix 1 — Admin can manage lecturers on the Lecturer Directory page

**Status:** Resolved on production (21 June 2026)

**Problem:** After hosting, the Lecturer Directory showed **duplicate lecturer records** (same person or timetable code listed more than once). Admins had no way to fix this from the lecturer page itself — only generic User Management elsewhere in the admin panel.

**Solution (code change):**

1. **Lecturer Directory (`/lecturers`)** — when logged in as **Admin**:
   - **Add Lecturer** — create a new lecturer with name, email, password, phone, department, designation, and timetable code.
   - **Edit** on each card — update lecturer details (name, phone, department, designation, timetable code).
   - **Remove** on each card — permanently delete a duplicate lecturer account and related data (schedule slots, timetable entries, appointments). Confirmation dialog warns before delete.

2. **API** — `DELETE /api/admin/users/:id` (lecturer accounts only).

**Files changed:**

| File | What changed |
|------|----------------|
| `client/src/pages/LecturerDirectory.tsx` | Admin Add / Edit / Remove UI |
| `server/src/controllers/adminUserController.ts` | `deleteUser`, cache invalidation |
| `server/prisma/migrations/20260621120000_lecturer_admin_last_modified/` | `adminLastModifiedAt`, `adminLastModifiedById` |

**How to use on production:**

1. Log in as admin.
2. Open **Lecturer Directory**.
3. For duplicates: keep the correct entry, click **Remove** on the duplicate card(s).
4. To add a missing lecturer: click **Add Lecturer** and fill in details.

**Deploy commands used (production):**

```bash
cd /var/www/lecstu && git pull
cd server && npm install && npx prisma migrate deploy && npx prisma generate && npm run build
cd ../client && npm install && npm run build
pm2 restart lecstu-api
sudo systemctl reload nginx
```

**UI fixes during development:** compact modal (`entity-form-compact`), two-column field rows, aligned Phone/Department labels.

**Bug fix — “Email verification code must be 6 digits” on Add Lecturer:** Admin create-user validation incorrectly required the public registration 6-digit email code. Removed that requirement for `POST /api/admin/users`.

**Admin last-modified display:** Lecturers added or edited by admin show **“Updated by [admin name] · [date]”** on their card (amber border), sorted to the top.

---

### Fix 2 — `git pull` blocked by local edits on the server

**Status:** Resolved

**Problem:** First production deploy of Fix 1 failed at `git pull`:

```text
error: Your local changes to the following files would be overwritten by merge:
        server/prisma/fct-faculty-config.js
        shared/constants/mapMarkerTypes.js
Please commit your changes or stash them before you merge.
Aborting
```

**Cause:** Old build artifacts or manual edits on the server conflicted with files now tracked in GitHub.

**Solution:**

```bash
cd /var/www/lecstu
git checkout -- server/prisma/fct-faculty-config.js
git checkout -- server/prisma/fct-faculty-config.js.map
git checkout -- server/prisma/fct-faculty-config.d.ts.map
rm -f shared/constants/mapMarkerTypes.d.ts shared/constants/mapMarkerTypes.js
# ... remove other untracked build artifacts listed by git status
git pull
```

**Lesson:** Never edit project files on production. Always change locally → push → pull.

---

### Fix 3 — Server `npm run build` failed after schema migration

**Status:** Resolved

**Problem:** After `git pull` and `npx prisma migrate deploy`, `npm run build` failed with TypeScript errors like `Property 'adminLastModifiedAt' does not exist on type ...`.

**Cause:** Migration applied to the database but **Prisma Client was not regenerated** before `tsc`.

**Solution:**

```bash
cd /var/www/lecstu/server
npx prisma generate   # ← required after every schema/migration change
npm run build
pm2 restart lecstu-api
```

**Proof:** `npm run build` completed with no errors after `prisma generate`; `pm2 list` showed `lecstu-api` **online**.

---

## Phase 8 — Optional (HTTPS, AI, maintenance)

### 8.2 — Rasa chatbot (production only — do not train on Windows)

**Status:** Resolved (21 June 2026) — chatbot live, timetable matches UI, messy grammar + confirm flow works, duplicate-on-yes fixed.

**Production model:** `models/20260621-110953-balanced-message.tar.gz`

#### Important: local vs production

| Task | Where | Notes |
|------|--------|--------|
| Edit chatbot code (`actions.py`, `nlu.yml`, `rules.yml`, etc.) | **Local (Windows)** | Develop, `git commit`, `git push` |
| `git pull` | **Production (PuTTY)** | Get latest code on the server |
| `rasa train` | **Production only** | **Never** copy a model from your Windows PC to the server |
| `pm2 restart lecstu-rasa` | **Production** | After `rasa train` (loads new `.tar.gz` model) |
| `pm2 restart lecstu-rasa-actions` | **Production** | After `actions.py` changes (no retrain needed) |
| `npm run build --workspace=client` | **Production** | After `ChatWidget.tsx` changes |
| Test chatbot | **Production browser** | `http://149.118.54.64` (logged in as student) |

**Why train must run on production**

- Oracle VM is **ARM (aarch64)** with **TensorFlow CPU AWS** in the Python venv.
- A model trained on **Windows (x86)** will **not** work on the server.
- Rasa stores **rules and NLU inside the `.tar.gz` model**. Updating `rules.yml` on disk and restarting PM2 is **not enough** — you must run **`rasa train` on the server**.

**Standard workflow (local → production)**

```bash
# Local (Windows)
git add ... && git commit -m "..." && git push

# Production (PuTTY)
cd /var/www/lecstu && git pull

# If rules.yml / nlu.yml / stories.yml / domain.yml changed:
cd ai-services/chatbot && source .venv/bin/activate
export LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0
rasa train
pm2 restart lecstu-rasa && pm2 restart lecstu-rasa-actions && pm2 save

# If only actions.py changed:
pm2 restart lecstu-rasa-actions
```

---

#### Chronology — what we hit during this chat (21 June 2026)

| # | Symptom | Root cause | Fix |
|---|---------|------------|-----|
| 1 | “Chatbot is starting or unavailable…” | Only `lecstu-api` in PM2; Rasa never started (Phase 8.2 optional) | One-time venv + PM2 start for `lecstu-rasa` + `lecstu-rasa-actions` |
| 2 | Rasa crash on start | `libgomp` static TLS on ARM | `LD_PRELOAD` for train **and** PM2 start |
| 3 | Chatbot timetable ≠ My Timetable page | Chatbot used stale `flat`/`weekly`; UI uses FET **grid** | `_timetable_lines_from_grid()` in `actions.py` |
| 4 | Tomorrow shows wrong classes / 1-hour slots | `rowSpan` not used for multi-row cells | Grid formatter uses `rowSpan` for end time |
| 5 | `give the time table of the friday` → out-of-scope | NLU + **old model** still had `utter_out_of_scope` rule | `action_recover_or_fallback` + **`rasa train`** |
| 6 | `rasa train` → `YamlValidationException` | Invalid rule condition `type: slot` (not valid in Rasa 3.6) | Replaced with **affirm/deny** intent rules |
| 7 | `rasa train` → `InvalidRule` story conflict | Story `messy timetable confirm then show` vs affirm rule | **Removed** conflicting story from `stories.yml` |
| 8 | `git pull` blocked | Manual `rules.yml` edit on server | `git checkout -- ai-services/chatbot/data/rules.yml` then pull |
| 9 | Reply **yes** → timetable shown **twice** | Confirm handler + `FollowupAction` ran query twice | `_dispatch_timetable_query()` inline on affirm; guard in `ActionQueryTimetable` |

---

#### Problems faced — Phase 8.2 (detailed)

##### A — Chatbot unavailable (Rasa not running)

**Problem:** Chat widget showed *“Chatbot is starting or unavailable. Please try again in a moment.”* Main site worked fine.

**Cause:** Phases 1–7 only start `lecstu-api`. Chatbot needs **two extra PM2 processes** (`lecstu-rasa`, `lecstu-rasa-actions`) and Nginx `/rasa/` proxy.

**Screenshot:**

![Phase 8.2 A — Chatbot unavailable in browser](./hosting-screenshots/phase8-01-chatbot-unavailable.png)

**Solution:** Complete Phase 8.2 setup (Python venv, `rasa train`, PM2 start). Verify:

```bash
pm2 list    # must show lecstu-api, lecstu-rasa, lecstu-rasa-actions
curl -s -X POST http://127.0.0.1:5005/webhooks/rest/webhook \
  -H "Content-Type: application/json" -d '{"sender":"test","message":"hello"}'
```

**Status:** Resolved

---

##### B — Ubuntu 20.04 ARM has no Python 3.10 from apt

**Problem:** Rasa 3.6 needs Python 3.10+. `apt` on Ubuntu 20.04 ARM only had Python 3.8; deadsnakes PPA had no ARM packages.

**Solution:** Build Python 3.10.14 from source on the server (`make altinstall` → `/usr/local/bin/python3.10`), then:

```bash
cd /var/www/lecstu/ai-services/chatbot
python3.10 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Screenshot:**

![Phase 8.2 B — Rasa venv setup on server](./hosting-screenshots/phase8-09-rasa-setup-terminal.png)

**Status:** Resolved

---

##### C — Rasa server crash: scikit-learn `libgomp` / static TLS

**Problem:** `lecstu-rasa` crashed on start:

```text
ImportError: ... libgomp-d22c30c5.so.1.0.0: cannot allocate memory in static TLS block
```

**Solution:** Use `LD_PRELOAD` for **both** `rasa train` and PM2 start:

```bash
export LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0
```

PM2 start (production):

```bash
cd /var/www/lecstu/ai-services/chatbot
LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0 \
  pm2 start ".venv/bin/rasa run --enable-api --cors \"*\"" --name lecstu-rasa --cwd /var/www/lecstu/ai-services/chatbot

LECSTU_API_URL=http://127.0.0.1:5000/api CHATBOT_API_KEY=lecstu-chatbot-dev-key \
  pm2 start ".venv/bin/rasa run actions" --name lecstu-rasa-actions --cwd /var/www/lecstu/ai-services/chatbot
```

**Status:** Resolved

---

##### D — Chatbot timetable wrong vs My Timetable page

**Problem:** Student asked for **tomorrow’s** timetable; chatbot listed different courses/times than the My Timetable grid (wrong codes, 1-hour slots).

**Cause:** UI reads the **FET grid snapshot** (`data.grid` from `timetable_table_snapshots`). Chatbot used **`flat` / `weekly`** DB rows that were out of sync after Phase 5 data-only re-import.

**Screenshots:**

![Phase 8.2 D — Production mismatch (chatbot vs My Timetable)](./hosting-screenshots/phase8-02-timetable-mismatch-production.png)

![Phase 8.2 D — Same bug reproduced locally](./hosting-screenshots/phase8-03-timetable-wrong-local.png)

**Solution (code):** `ai-services/chatbot/actions/actions.py` — `_timetable_lines_from_grid()` reads the same grid as the UI and uses **`rowSpan`** for real 2-hour blocks:

```python
# actions.py — prefer grid, honour rowSpan for end time
row_span = max(1, int(cell.get("rowSpan") or 1))
end_ti = min(ti + row_span - 1, len(time_rows) - 1)
start = cell.get("slotStart") or tr.get("start")
end = cell.get("slotEnd") or time_rows[end_ti].get("end")
```

**Deploy:** `git pull` → `pm2 restart lecstu-rasa-actions` only.

**Screenshots after fix:**

![Phase 8.2 D — Tomorrow timetable correct](./hosting-screenshots/phase8-04-tomorrow-timetable-test.png)

![Phase 8.2 D — 2-hour rowSpan blocks](./hosting-screenshots/phase8-05-rowspan-fix-test.png)

**Status:** Resolved

---

##### E — Messy student grammar → generic out-of-scope message

**Problem:** e.g. `give the time table of the friday` → *“I'm focused on academic help…”* instead of a timetable.

**Cause:**

1. NLU often classifies messy phrasing as `out_of_scope`.
2. Even after updating `rules.yml` on disk, the **old trained model** still routed `out_of_scope` → `utter_out_of_scope` until **`rasa train`** on production.

**Screenshots:**

![Phase 8.2 E — Messy grammar rejected](./hosting-screenshots/phase8-06-messy-grammar-out-of-scope.png)

![Phase 8.2 E — Production still on old model before retrain](./hosting-screenshots/phase8-08-production-still-out-of-scope.png)

**Solution (code + train):**

1. **`action_recover_or_fallback`** — detect timetable phrasing in fallback/out-of-scope; ask *“Did you mean Friday? Reply yes/no.”*
2. **`rules.yml`** — `fallback` / `out_of_scope` → `action_recover_or_fallback` (not `utter_out_of_scope`).
3. **`ChatWidget.tsx`** — `normalizeTimetableMessage()` rewrites messy text client-side before sending to Rasa.
4. **`rasa train` on production** — required after any `rules.yml` / `nlu.yml` / `stories.yml` change.

**Key files:**

| File | Role |
|------|------|
| `ai-services/chatbot/actions/actions.py` | `_looks_like_timetable_query`, `_maybe_prompt_timetable_confirm`, `ActionRecoverOrFallback` |
| `ai-services/chatbot/data/rules.yml` | affirm/deny → recover; out_of_scope → recover |
| `client/src/components/ChatWidget.tsx` | `normalizeTimetableMessage()` |

**Screenshot after confirm flow works:**

![Phase 8.2 E — Friday confirm prompt](./hosting-screenshots/phase8-07-confirm-friday-prompt.png)

**Status:** Resolved (after `rasa train`)

---

##### F — `rasa train` failed: invalid `rules.yml` syntax

**Problem:**

```text
YamlValidationException: Failed to validate 'data/rules.yml'
  Key 'type' was not defined. Path: '/rules/0/condition/0'
```

**Cause:** Rule used `condition: - type: slot` — **not valid** in Rasa 3.6 rule conditions.

**Screenshot:**

![Phase 8.2 F — rasa train YamlValidationException](./hosting-screenshots/phase8-10-rasa-train-invalid-rules.png)

**Solution:** Replace slot-condition rule with explicit **affirm** / **deny** intent rules in `ai-services/chatbot/data/rules.yml`:

```yaml
  - rule: Affirm (e.g. yes after timetable confirm)
    steps:
      - intent: affirm
      - action: action_recover_or_fallback

  - rule: Deny (e.g. no after timetable confirm)
    steps:
      - intent: deny
      - action: action_recover_or_fallback
```

**Status:** Resolved

---

##### G — `rasa train` failed: story vs rule conflict

**Problem:**

```text
InvalidRule: Contradicting rules or stories found
- the prediction of the action 'action_query_timetable' in story 'messy timetable confirm then show'
  is contradicting with rule(s) 'Affirm (e.g. yes after timetable confirm)'
  which predicted action 'action_recover_or_fallback'.
```

**Cause:** Story said **yes** → `action_query_timetable`; rule said **yes** → `action_recover_or_fallback`. Rasa cannot train both.

**Solution:** **Remove** story `messy timetable confirm then show` from `ai-services/chatbot/data/stories.yml`. The affirm rule + `action_recover_or_fallback` handles confirmation alone.

```bash
# On server if pull blocked — after git pull this story should already be gone
grep "messy timetable" ai-services/chatbot/data/stories.yml   # expect no output
```

**Status:** Resolved

---

##### H — `git pull` blocked by manual `rules.yml` edit on server

**Problem:**

```text
error: Your local changes to the following files would be overwritten by merge:
        ai-services/chatbot/data/rules.yml
Please commit your changes or stash them before you merge.
Aborting
```

**Cause:** Earlier emergency `cat > rules.yml` on the server conflicted with the same fix already pushed to GitHub.

**Solution:**

```bash
cd /var/www/lecstu
git checkout -- ai-services/chatbot/data/rules.yml
git pull
```

**Lesson:** Fix rules locally → push → pull. Do not patch YAML on the server long-term.

**Status:** Resolved

---

##### I — Successful `rasa train` and PM2 restart

**Proof:** Training completed on ARM (~15–30 min):

```text
Your Rasa model is trained and saved at 'models/20260621-110953-balanced-message.tar.gz'.
```

After restart, logs showed new model loading:

```text
Loading model models/20260621-110953-balanced-message.tar.gz...
Rasa server is up and running.
```

**Screenshot:**

![Phase 8.2 I — PM2 after train + restart](./hosting-screenshots/phase8-11-pm2-restart-after-train.png)

**Commands:**

```bash
pm2 restart lecstu-rasa && pm2 restart lecstu-rasa-actions && pm2 save
```

**Note:** `curl` may return empty while the model loads (~60 s). Wait for `Rasa server is up and running` in `pm2 logs lecstu-rasa`.

**Status:** Resolved

---

##### J — Duplicate Friday timetable after replying “yes”

**Problem:** After confirm prompt, student replied **yes** → bot posted the **same Friday timetable twice** in one turn.

**Cause:** On affirm, `action_recover_or_fallback` returned `FollowupAction("action_query_timetable")`, and `action_query_timetable` **also** ran the confirm handler — two paths executed the timetable query in one turn.

**Screenshot:**

![Phase 8.2 J — Duplicate timetable on yes](./hosting-screenshots/phase8-12-duplicate-timetable-on-yes.png)

**Solution (code):** `ai-services/chatbot/actions/actions.py`

1. Extract **`_dispatch_timetable_query()`** — shared fetch + utter logic.
2. On affirm in **`_handle_awaiting_timetable_confirm`**, call `_dispatch_timetable_query()` **directly** (no `FollowupAction`).
3. In **`ActionQueryTimetable`**, skip `affirm` / `deny` intents (handled only by recover).

```python
# On yes — show timetable once, no followup chain
if _is_affirmation(text):
    resolved = _resolve_day(day) if day else None
    _dispatch_timetable_query(dispatcher, tracker, resolved)
    return clear_events + [SlotSet("day", resolved or "")]
```

**Deploy proof:**

![Phase 8.2 J — git pull + restart lecstu-rasa-actions](./hosting-screenshots/phase8-13-deploy-actions-pull-restart.png)

```bash
cd /var/www/lecstu && git pull
pm2 restart lecstu-rasa-actions   # actions.py only — no retrain
```

**Status:** Resolved

---

##### K — PM2 services and API key (reference)

| PM2 name | Role | Port |
|----------|------|------|
| `lecstu-api` | Main API | 5000 |
| `lecstu-rasa` | Rasa NLU + dialogue (needs `LD_PRELOAD`) | 5005 |
| `lecstu-rasa-actions` | Custom actions (`actions.py`) | 5055 |

Actions server env (must match `server/.env`):

```bash
LECSTU_API_URL=http://127.0.0.1:5000/api
CHATBOT_API_KEY=lecstu-chatbot-dev-key
```

**Status:** Running

---

#### Production commands — full chatbot deploy (copy-paste)

```bash
# 1. Latest code
cd /var/www/lecstu && git pull

# 2. Train (only if rules/nlu/stories/domain changed)
cd /var/www/lecstu/ai-services/chatbot
source .venv/bin/activate
export LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0
rasa train

# 3. Restart
pm2 restart lecstu-rasa
pm2 restart lecstu-rasa-actions
pm2 save

# 4. Quick test
curl -s -X POST http://127.0.0.1:5005/webhooks/rest/webhook \
  -H "Content-Type: application/json" \
  -d '{"sender":"test","message":"hello"}'
```

**Browser test (logged in as student):**

1. `give the time table of the friday` → confirm prompt for Friday  
2. `yes` → **one** Friday timetable with 2-hour slots (matches My Timetable)  
3. `give me tomorrow timetable` → Monday with DSCI + CSCI blocks

---

#### Phase 8.2 screenshots index

All saved under [`hosting-screenshots/`](./hosting-screenshots/):

| File | What it shows |
|------|----------------|
| `phase8-01-chatbot-unavailable.png` | Widget error before Rasa was started |
| `phase8-02-timetable-mismatch-production.png` | Chatbot vs My Timetable (production) |
| `phase8-03-timetable-wrong-local.png` | Same mismatch on local dev |
| `phase8-04-tomorrow-timetable-test.png` | Tomorrow → Monday after grid fix |
| `phase8-05-rowspan-fix-test.png` | Correct 2-hour blocks |
| `phase8-06-messy-grammar-out-of-scope.png` | Bad grammar → out-of-scope |
| `phase8-07-confirm-friday-prompt.png` | “Did you mean Friday?” confirm |
| `phase8-08-production-still-out-of-scope.png` | Old model before retrain |
| `phase8-09-rasa-setup-terminal.png` | Python venv / Rasa setup |
| `phase8-10-rasa-train-invalid-rules.png` | YamlValidationException |
| `phase8-11-pm2-restart-after-train.png` | PM2 after successful train |
| `phase8-12-duplicate-timetable-on-yes.png` | Duplicate timetable bug |
| `phase8-13-deploy-actions-pull-restart.png` | Deploy duplicate fix |

---

---

### Fix 4 — Registration code not delivered to `@stu.kln.ac.lk` only

**Status:** Resolved (6 July 2026)

**Problem:** Student registers with `user@stu.kln.ac.lk` only. API says code sent, but nothing in Outlook. With personal Gmail as recovery email, code arrives.

**Cause:** Gmail SMTP accepts the send, but **Microsoft 365 quarantines** external senders to university mailboxes.

**Screenshots:**

![Registration — Outlook inbox empty, API says sent](./hosting-screenshots/dev-fix01-registration-outlook-no-mail.png)

![Development — dev verification code shown when SMTP fails](./hosting-screenshots/dev-fix02-registration-dev-code-shown.png)

**Solution:**

1. **Require personal recovery email** for all registrations (codes go to Gmail, not university Outlook).
2. Optional long-term: configure `SMTP_UNIVERSITY_*` in `server/.env` for Office 365 sender.
3. UI warnings on Register page when university email is used.

**Files:** `registrationVerificationController.ts`, `emailDomains.ts`, `Register.tsx`, `validate.ts`

---

### Fix 5 — Server crash after registration validation edit

**Status:** Resolved (6 July 2026)

**Problem:** `npm run dev` crashed — `validate.ts:31 Unexpected "."` — client showed `ECONNREFUSED` on `/api/auth/register-options`.

**Cause:** Password validation rules were accidentally merged into `recoveryEmail` rules during Fix 4.

**Solution:** Restore separate `body('recoveryEmail')` and `body('password')` blocks in `server/src/middleware/validate.ts`.

---

### Fix 6 — Dashboard indoor navigation: extra steps on Find My Way

**Status:** Resolved (6 July 2026)

**Problem:** Student picks building on dashboard → goes to Find My Way → must enter From/To again manually.

**Screenshots:**

![Dashboard — old flow, no destination picker](./hosting-screenshots/dev-fix09-dashboard-indoor-nav-before.png)

![Building selected but places list empty](./hosting-screenshots/dev-fix10-dashboard-places-dropdown.png)

![Added Floor dropdown for clearer place selection](./hosting-screenshots/dev-fix11-dashboard-floor-select.png)

**Solution:** Dashboard **Indoor Navigation** card now has Building → Floor → Destination → **Go**. Auto-sets From = Administration Building ground entrance and opens route on Find My Way.

**Files:** `Dashboard.tsx`, indoor navigation API hooks

---

### Fix 7 — “All lectures finished” greeting on dashboard

**Status:** Resolved (6 July 2026)

**Problem:** After last class of the day, dashboard still looked like a normal schedule with no friendly completion message.

**Screenshot:**

![Dashboard — friendly all-done greeting](./hosting-screenshots/dev-fix12-dashboard-all-done-greeting.png)

**Solution:** `TodayOnCampus.tsx` shows time-of-day greeting when all slots are past (morning / afternoon / evening variants).

---

### Fix 8 — Profile password change redirected to dashboard

**Status:** Resolved (6–7 July 2026)

**Problem:** On My Profile, clicking **Send code to email** saved the profile form and navigated away instead of showing the verification step.

**Screenshots:**

![Profile — password change step 1](./hosting-screenshots/dev-fix13-profile-password-step1.png)

![Bug — page jumped to dashboard after Send code](./hosting-screenshots/dev-fix14-password-redirect-bug.png)

**Cause:** `ProfilePasswordSection` was **nested inside** the main profile `<form>` — button triggered parent form submit.

**Solution:**

1. Move password section **outside** profile form.
2. Step-by-step flow on same page: current password → code → new password → success.
3. All buttons `type="button"`.
4. Works for **Student, Lecturer, Admin** roles.

**Files:** `Profile.tsx`, `ProfilePasswordSection.tsx`, `profileController.ts`

---

### Fix 9 — Profile password reset email not delivered (SMTP)

**Status:** Resolved (7 July 2026)

**Problem:** UI showed success but no email at recovery Gmail. Dev code appeared instead.

**Screenshot:**

![SMTP failed — no email, dev code shown](./hosting-screenshots/dev-fix15-smtp-no-email-delivered.png)

**Cause:** Stale app password in `server/data/email-settings.json` **overrode** `SMTP_PASS` in `.env`. Gmail returned `535 Username and Password not accepted`.

**Solution:**

1. `emailConfigStore.ts` — prefer `.env` `SMTP_PASS` over JSON override.
2. Clearer amber warning in UI when delivery fails.
3. User must **Save Changes** on recovery email before requesting code.
4. Regenerate Gmail app password if needed.

**Production proof (PM2 logs):**

```text
[LECSTU][email] Sent to pirabakaranshakiththiyan@gmail.com via default SMTP
[LECSTU][profile-password] Reset code emailed to ...
success=true
```

---

### Fix 10 — Online lectures not identified on dashboard (production)

**Status:** Resolved (7 July 2026)

**Problem:** Timetable cell marked **Online** in admin grid, but dashboard showed **Navigate** button and no online badge.

**Screenshots:**

![Request — show online count for the day](./hosting-screenshots/dev-fix16-online-lecture-chip-request.png)

![Production bug — online class still shows Navigate](./hosting-screenshots/dev-fix17-online-lecture-production-bug.png)

**Causes:**

1. Online detection used exact time keys — grid vs master timetable **start/end mismatch**.
2. Only checked `rawText`, not all grid cell lines.
3. Client build failed once (`isOnlineSlot` unused) so old UI (“Today on campus”) stayed cached.

**Solution:**

1. `buildOnlineSlotLookup()` + `resolveSlotOnlineFromGrid()` — match by course digits, start time, VL_ codes, virtual/zoom text.
2. `TodayOnCampus.tsx` — blue **Online** badge, day summary chips, **no Navigate** for online slots.
3. Fixed TS errors: `grid ?? null` in `studentTodayCampusService.ts`; removed unused `isOnlineSlot`.

**Deploy lesson:** After `git pull`, rebuild **both** `server` and `client`. Hard refresh browser (`Ctrl+Shift+R`).

---

### Fix 11 — Lecturer profile showed all slots as free (green)

**Status:** Resolved (7 July 2026)

**Problem:** Student opens lecturer profile → weekly grid entirely green (free). Teaching times and appointments ignored.

**Screenshot:**

![Lecturer profile — incorrectly all free slots](./hosting-screenshots/dev-fix18-lecturer-all-free-bug.png)

**Cause:** Teaching slots synced from master timetable only when **lecturer** opened their own timetable — not when **student** viewed availability.

**Solution:** `lecturerAvailabilityService.ts` syncs teaching schedule on every availability request; merges teaching + manual busy + appointments; grid defaults to gray (unavailable) not green.

---

### Fix 12 — Lecturer availability missing batches / wrong 1-hour duration

**Status:** Resolved (7 July 2026)

**Problem:** Some lectures missing on lecturer profile; 2-hour classes shown as 1-hour blocks.

**Screenshot:**

![Wrong duration — 2-hour lecture shown as 1 hour](./hosting-screenshots/dev-fix19-lecturer-wrong-duration.png)

**Cause:**

1. Only `master_timetable` used — missed slots from other batch grids.
2. Master rows store 1-hour periods; FET grid uses **`rowSpan`** for true 2-hour blocks.

**Solution:** `fetchTeachingBlocksForLecturer()` in `lecturerTimetableService.ts`:

- Scan **all published batch grids** (`TimetableTableSnapshot`) + master timetable.
- Match lecturer by name, timetable code, FET VL codes.
- Upgrade duration from grid `rowSpan`; merge adjacent same-course rows.

---

### Fix 13 — Domain `lecstu.com` + HTTPS (Phase 8.1)

**Status:** Resolved (7 July 2026)

**Problem:** Site only reachable by IP; login required `ALLOW_HTTP_AUTH=true` workaround; no padlock for users.

**Screenshots:**

![Namecheap Advanced DNS — www URL Redirect conflicted with A record](./hosting-screenshots/dev-fix20-namecheap-dns-redirect-conflict.png)

![Namecheap Domain tab — keep BasicDNS, fix records in Advanced DNS](./hosting-screenshots/dev-fix21-namecheap-domain-tab.png)

![nslookup — lecstu.com and www both → 149.118.54.64](./hosting-screenshots/dev-fix22-nslookup-dns-ok.png)

**Problems faced during setup:**

| # | Problem | Solution |
|---|---------|----------|
| 1 | Namecheap **URL Redirect** on `www` conflicted with **A record** | Delete redirect; keep only `@` and `www` A records → server IP |
| 2 | Pasted old PuTTY output → hundreds of `command not found` | Run **one command at a time**; use `clear` between steps |
| 3 | Certbot email prompt | Use `lecstu.system@gmail.com` (renewal notices only) |
| 4 | EFF share email | `N` is fine — does not affect certificate |

**Namecheap DNS (final):**

```
A Record    @      149.118.54.64
A Record    www    149.118.54.64
```

**Server steps:**

```bash
sudo nano /etc/nginx/sites-available/lecstu
# server_name lecstu.com www.lecstu.com;

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lecstu.com -d www.lecstu.com
# Choose redirect HTTP → HTTPS (option 2)

nano /var/www/lecstu/server/.env
# CLIENT_URL=https://lecstu.com
# Remove or set ALLOW_HTTP_AUTH=false

pm2 restart lecstu-api
```

**Result:** HTTPS live, cert expires **2026-10-04**, auto-renew via certbot timer. Public URL: **https://lecstu.com**

---

### Fix 14 — Production server build failed (TypeScript)

**Status:** Resolved (7 July 2026)

**Problem:** After `git pull`, `npm run build` failed on server:

```text
studentTodayCampusService.ts:196 — grid type undefined not assignable to null
TodayOnCampus.tsx:75 — isOnlineSlot declared but never read
```

**Solution:** `const gridSnapshot = grid ?? null`; remove unused `isOnlineSlot`. Push fix → `git pull` → rebuild **server and client**.

**Lesson:** If server `tsc` fails but you `pm2 restart` anyway, API runs **old** compiled code. Client may build while server does not — always check both builds succeed.

---

### Fix 15 — PM2 services running on production (reference, 7 July 2026)

| PM2 name | Role | Approx. RAM |
|----------|------|-------------|
| `lecstu-api` | Main API | ~18 MB |
| `lecstu-rasa` | Chatbot NLU | ~1.3 GB |
| `lecstu-rasa-actions` | Chatbot actions | ~120 MB |
| `lecstu-indoor-navigation` | Indoor nav AI | ~469 MB |
| `lecstu-vision` | Floor plan vision | ~881 MB |

**Note:** Enable AI services one at a time on 4 GB VM; monitor with `free -h`.

---

### 8.1 — HTTPS + custom domain (`lecstu.com`)

**Status:** Resolved — see **Fix 13** above.

| Item | Value |
|------|--------|
| Domain | `lecstu.com` (Namecheap) |
| DNS | A records `@` + `www` → `149.118.54.64` |
| SSL | Let's Encrypt via certbot |
| `CLIENT_URL` | `https://lecstu.com` |
| Cert expiry | 2026-10-04 (auto-renew) |

---

### 8.3 — Floor plan vision AI

**Status:** Running on production (`lecstu-vision` in PM2, ~880 MB RAM)

---

### Development fixes screenshots index (July 2026)

All saved under [`hosting-screenshots/`](./hosting-screenshots/) from Cursor chat images:

| File | What it shows |
|------|----------------|
| `dev-fix01-registration-outlook-no-mail.png` | Registration code not in university Outlook |
| `dev-fix02-registration-dev-code-shown.png` | Dev verification code when email fails |
| `dev-fix03-registration-why-dev-code.png` | User confusion about dev code display |
| `dev-fix09-dashboard-indoor-nav-before.png` | Old dashboard indoor nav flow |
| `dev-fix10-dashboard-places-dropdown.png` | Places list after building selected |
| `dev-fix11-dashboard-floor-select.png` | Floor dropdown added |
| `dev-fix12-dashboard-all-done-greeting.png` | All lectures finished greeting |
| `dev-fix13-profile-password-step1.png` | Profile password change UI |
| `dev-fix14-password-redirect-bug.png` | Redirect to dashboard bug |
| `dev-fix15-smtp-no-email-delivered.png` | SMTP failure / dev code fallback |
| `dev-fix16-online-lecture-chip-request.png` | Request for online lecture indicators |
| `dev-fix17-online-lecture-production-bug.png` | Online class still showing Navigate |
| `dev-fix18-lecturer-all-free-bug.png` | Lecturer profile all green (wrong) |
| `dev-fix19-lecturer-wrong-duration.png` | 2-hour class shown as 1 hour |
| `dev-fix20-namecheap-dns-redirect-conflict.png` | Namecheap DNS redirect conflict |
| `dev-fix21-namecheap-domain-tab.png` | Namecheap domain settings |
| `dev-fix22-nslookup-dns-ok.png` | DNS propagation verified |

---

## Quick reference — things to remember

- **Never run `npm run db:seed` on production** — it wipes all data.
- **Re-run test account removal on the server** after DB restore: `npm run db:remove-test-hosting-accounts`
- **Do not commit** `server/.env`, passwords, or `.ppk` keys to Git.
- **HTTPS is live** at `https://lecstu.com` — set `CLIENT_URL=https://lecstu.com`; remove `ALLOW_HTTP_AUTH` or set to `false`.
- **Registration codes** go to **personal recovery email** (Gmail). University `@stu.kln.ac.lk` alone will not receive codes unless university SMTP is configured.
- **Profile password reset** sends to recovery email; **Save Changes** on profile before requesting code. If email fails, check `server/data/email-settings.json` is not overriding stale SMTP password.
- **Never edit tracked files on the production server** — always local → `git push` → `git pull`. If pull fails, `git checkout -- <file>` only when GitHub has the correct version.
- **After every deploy:** rebuild **server AND client**; verify `npm run build` exits with **zero errors** before `pm2 restart`.
- **After Prisma migration on production:** always run `npx prisma generate` before `npm run build`.
- **PuTTY:** paste **one command at a time** — never paste old terminal output logs.
- **Namecheap DNS:** use **A records only** for `@` and `www`; do **not** use URL Redirect Record alongside www A record.
- **Rasa chatbot:** edit locally → `git push` → production `git pull`. Train **only on ARM server** with `LD_PRELOAD`. See **Phase 8.2** and screenshot index `phase8-01` … `phase8-13`.
- **`actions.py` only** → `pm2 restart lecstu-rasa-actions`. **Rules/NLU/stories** → `rasa train` + restart both Rasa processes.
- **Chatbot timetable** and **lecturer availability** must use FET **grid** data (same as My Timetable page), not stale `flat` rows alone.
- **Lecturer availability** uses all batch grids + `rowSpan` for correct 2-hour teaching blocks.
- **Online lectures** on dashboard: no Navigate button; match grid `isOnline` / course code / VL_ markers.
