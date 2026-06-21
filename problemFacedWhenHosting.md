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

**Screenshots** for each step are saved in [`hosting-screenshots/`](./hosting-screenshots/) and linked below so you can look back at what you did.

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

**Status:** In progress — backup uploaded

Database dump uploaded via `pscp` to `/home/ubuntu/lecstu-backup.dump` (505 kB).

Floor plan images uploaded to `/var/www/lecstu/server/uploads/floorplans/` (~33 files).

**Screenshots:**

![Phase 4.2 — pscp lecstu-backup.dump](./hosting-screenshots/phase4-02-pscp-backup.png)

![Phase 4.2 — pscp floorplans upload](./hosting-screenshots/phase4-03-pscp-floorplans.png)

**Status:** OK — no problems

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

**Status:** OK — site live on HTTP with PM2 + Nginx

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

**Screenshot (add):** `hosting-screenshots/phase7-01-nginx-config-ok.png`

### 7.2 — PM2 start API

**Status:** OK — no problems

```bash
cd /var/www/lecstu/server
pm2 start dist/server.js --name lecstu-api
pm2 logs lecstu-api --lines 30
curl -s http://127.0.0.1:5000/api/health
```

**Screenshot (add):** `hosting-screenshots/phase7-02-pm2-online.png`

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

**Status:** Resolved (workaround — HTTP only)

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

**Screenshot (add):**

- `hosting-screenshots/phase7-03-https-required-login.png`

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

**Screenshot (add):** `hosting-screenshots/phase7-04-pm2-startup-health.png`

---

## Post-deployment fixes (local → GitHub → production pull)

Changes made on the Windows PC after Phases 1–7 went live. Deploy each batch with the standard update flow in [hostingSteps.md](./hostingSteps.md) (`git pull`, rebuild server/client, `pm2 restart`, `nginx reload`).

### Fix 1 — Admin can manage lecturers on the Lecturer Directory page

**Status:** Resolved (local — pending push to production)

**Problem:** After hosting, the Lecturer Directory showed **duplicate lecturer records** (same person or timetable code listed more than once). Admins had no way to fix this from the lecturer page itself — only generic User Management elsewhere in the admin panel.

**Solution (code change):**

1. **Lecturer Directory (`/lecturers`)** — when logged in as **Admin**:
   - **Add Lecturer** — create a new lecturer with name, email, password, phone, department, designation, and timetable code.
   - **Edit** on each card — update lecturer details (name, phone, department, designation, timetable code).
   - **Remove** on each card — permanently delete a duplicate lecturer account and related data (schedule slots, timetable entries, appointments). Confirmation dialog warns before delete.

2. **API** — `DELETE /api/admin/users/:id` (lecturer accounts only).

**How to use on production (after deploy):**

1. Log in as admin.
2. Open **Lecturer Directory**.
3. For duplicates: keep the correct entry, click **Remove** on the duplicate card(s).
4. To add a missing lecturer: click **Add Lecturer** and fill in details.

**Local test before push:**

```powershell
cd d:\Reasearch\lecstu
npm run dev:server
npm run dev:client
```

Log in as admin → Lecturer Directory → verify Add / Edit / Remove.

**UI fix:** Add/Edit modal first and last name fields use `form-row-2` so both inputs align side-by-side. Modal uses compact layout (`entity-form-compact`), pairs fields in two columns (phone/department, designation/code), and sizes to content instead of filling the viewport.

**Bug fix — “Email verification code must be 6 digits” on Add Lecturer:** Admin create-user validation incorrectly required the public registration 6-digit email code. Removed that requirement for `POST /api/admin/users` — admins can add lecturers without email verification.

**Admin last-modified display:** Lecturers added or edited by admin show **“Updated by [admin name] · [date]”** on their card, highlighted with an amber border, and are sorted to the **top** (most recent first). Requires DB migration `20260621120000_lecturer_admin_last_modified`.

---

## Phase 8 — Optional (HTTPS, AI, maintenance)

### 8.2 — Rasa chatbot (production only — do not train on Windows)

**Status:** In progress — model retrain required for latest rules/NLU

#### Important: local vs production

| Task | Where | Notes |
|------|--------|--------|
| Edit chatbot code (`actions.py`, `nlu.yml`, `rules.yml`, etc.) | **Local (Windows)** | Develop, test optionally, `git commit`, `git push` |
| `git pull` | **Production (PuTTY)** | Get latest code on the server |
| `rasa train` | **Production only** | **Never** copy a model from your Windows PC to the server |
| `pm2 restart lecstu-rasa` / `lecstu-rasa-actions` | **Production** | After train or `actions.py`-only changes |
| Test chatbot | **Production browser** | `http://149.118.54.64` (logged in as student) |

**Why train must run on production**

- Oracle VM is **ARM (aarch64)** with **TensorFlow CPU AWS** in the Python venv.
- A model trained on **Windows (x86)** will **not** work on the server.
- Rasa stores **rules and NLU inside the `.tar.gz` model**. Updating `rules.yml` on disk and restarting PM2 is **not enough** — you must run **`rasa train` on the server** so the new rules (e.g. timetable recovery + confirm) are baked into the model.

**Workflow (local → production)**

1. **Local:** change files → `git push`
2. **Production (PuTTY):** `cd /var/www/lecstu && git pull`
3. **Production:** `rasa train` (inside chatbot venv, with `LD_PRELOAD` — see below)
4. **Production:** `pm2 restart lecstu-rasa && pm2 restart lecstu-rasa-actions`
5. **Production:** test in browser

If you only changed `actions.py` (no `rules.yml` / `nlu.yml` / `stories.yml`), restarting **`lecstu-rasa-actions`** may be enough. If you changed **rules or NLU**, **`rasa train` is required**.

---

#### Problems faced — Phase 8.2 chatbot setup

##### A — Ubuntu 20.04 ARM has no Python 3.10 from apt

**Problem:** Rasa 3.6 needs Python 3.10+. `apt` on Ubuntu 20.04 ARM only had Python 3.8; deadsnakes PPA had no ARM packages.

**Solution:** Build Python 3.10.14 from source on the server (`make altinstall` → `/usr/local/bin/python3.10`), then:

```bash
cd /var/www/lecstu/ai-services/chatbot
python3.10 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**Status:** Resolved

---

##### B — Rasa server crash: scikit-learn `libgomp` / static TLS

**Problem:** `lecstu-rasa` crashed on start:

```text
ImportError: ... libgomp-d22c30c5.so.1.0.0: cannot allocate memory in static TLS block
```

**Solution:** Start Rasa with `LD_PRELOAD` pointing to libgomp inside the venv:

```bash
export LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0
```

PM2 start (production):

```bash
cd /var/www/lecstu/ai-services/chatbot
LD_PRELOAD=/var/www/lecstu/ai-services/chatbot/.venv/lib/python3.10/site-packages/scikit_learn.libs/libgomp-d22c30c5.so.1.0.0 \
  pm2 start ".venv/bin/rasa run --enable-api --cors \"*\"" --name lecstu-rasa --cwd /var/www/lecstu/ai-services/chatbot
```

Use the same `LD_PRELOAD` for **`rasa train`**.

**Status:** Resolved

---

##### C — Chatbot timetable wrong vs My Timetable page

**Problem:** Chatbot showed different courses/times than the My Timetable grid (e.g. old 1-hour slots, wrong course codes).

**Cause:** UI uses the **FET grid snapshot** (`data.grid`); chatbot used **`flat` / `weekly`** DB rows that were out of sync after re-import.

**Solution:** Updated `actions.py` to prefer **grid** data (same as the UI), use **rowSpan** for real 2-hour lecture blocks, and normalize day words (`tomorrows` → Monday, etc.).

**Status:** Resolved in code — deploy via `git pull` + restart actions; full behaviour needs **`rasa train`** if rules changed.

---

##### D — Messy grammar → generic “I'm focused on academic help…”

**Problem:** e.g. `give the time table of the friday` → out-of-scope message instead of timetable.

**Cause:** (1) NLU classified as `out_of_scope`. (2) **Old trained model** still had rule `out_of_scope` → `utter_out_of_scope`; updated `rules.yml` on disk was **not** loaded until **`rasa train`**.

**Solution:**

1. `action_recover_or_fallback` — detect timetable phrasing, ask **“Did you mean Friday?”**, confirm with **yes** / **no**.
2. **`rasa train` on production** — required after any `rules.yml` / `nlu.yml` / `stories.yml` change.

**Status:** Code deployed — **pending `rasa train` on production**

---

##### E — PM2 services (chatbot)

| PM2 name | Role | Port |
|----------|------|------|
| `lecstu-api` | Main API | 5000 |
| `lecstu-rasa` | Rasa server | 5005 |
| `lecstu-rasa-actions` | Custom actions (`actions.py`) | 5055 |

Actions server env (set when starting):

```bash
LECSTU_API_URL=http://127.0.0.1:5000/api CHATBOT_API_KEY=lecstu-chatbot-dev-key
```

Must match `CHATBOT_API_KEY` in `/var/www/lecstu/server/.env`.

**Status:** Running — retrain pending for latest dialogue rules

---

#### Production commands — chatbot retrain (copy-paste on PuTTY)

```bash
# 1. Latest code
cd /var/www/lecstu && git pull

# 2. Train (15–30 min on ARM) — MUST run on server
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

**Browser test:** Log in as student → chat → `give the time table of the friday` → confirm **yes** → Friday timetable with 2-hour slots.

---

### 8.1 / 8.3 / other optional phases

**Status:** Not started

| Subphase | Problem | Solution |
|----------|---------|----------|
| 8.1 HTTPS | — | — |
| 8.3 Floor plan vision | — | — |

---

## Quick reference — things to remember

- **Never run `npm run db:seed` on production** — it wipes all data.
- **Re-run test account removal on the server** after DB restore: `npm run db:remove-test-hosting-accounts`
- **Do not commit** `server/.env`, passwords, or `.ppk` keys to Git.
- If hosting on **HTTP only** (no domain/SSL yet), keep `ALLOW_HTTP_AUTH=true` (temporary). When you enable HTTPS, remove it or set it to `false`.
- **Rasa chatbot:** edit code locally → `git push` → on **production only**: `git pull`, then **`rasa train`** (do not copy models from Windows). See **Phase 8.2** in this file.
