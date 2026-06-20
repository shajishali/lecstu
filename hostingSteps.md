# LECSTU — Oracle Cloud Hosting Guide (PuTTY)

> **Goal:** Host LECSTU on Oracle Cloud (4 GB RAM) using PuTTY.  
> **Rule:** Do not change application code — only configure the server and environment.  
> **Order:** Complete **Phase 1 → 8** in sequence. Check each box before moving on.

---

## Table of Contents

| Phase | Title |
|-------|--------|
| [Overview](#overview) | Architecture, RAM plan, time estimate |
| [Your server details](#your-server-details-fill-in) | IP, passwords (fill in) |
| [Phase 1](#phase-1--prepare-on-your-windows-pc) | Prepare on Windows PC |
| [Phase 2](#phase-2--connect--secure-the-server) | Connect & secure the server |
| [Phase 3](#phase-3--install-system-software) | Install system software |
| [Phase 4](#phase-4--upload-project--data) | Upload project & data |
| [Phase 5](#phase-5--database-setup) | Database setup |
| [Phase 6](#phase-6--build--configure-lecstu) | Build & configure LECSTU |
| [Phase 7](#phase-7--go-live-nginx--pm2--verify) | Go live (Nginx + PM2 + verify) |
| [Phase 8](#phase-8--optional-extensions) | Optional extensions |
| [Appendix A](#appendix-a--command-dictionary) | PuTTY command dictionary |
| [Appendix B](#appendix-b--troubleshooting) | Troubleshooting & struggle log |

---

## Overview

### What runs on the server

| Layer | Technology | Port |
|-------|------------|------|
| Website (React) | Vite build → Nginx | 80 / 443 |
| API (Express) | Node.js + PM2 | 5000 |
| Database | PostgreSQL | 5432 |
| Chatbot (optional) | Rasa | 5005, 5055 |
| Floor Plan AI (optional) | Python FastAPI | 8003 |
| Indoor Nav AI (optional) | Python FastAPI | 8004 |

### Architecture

```
Internet → Oracle Public IP (:80)
              │
              ▼
           [Nginx] → client/dist (React)
              │
              ├── /api/*     → Node.js (:5000)
              ├── /uploads/* → Node.js (:5000)
              └── /rasa/*    → Rasa (:5005, optional)
```

### RAM on a 4 GB VM

| Stage | Services | Approx. RAM |
|-------|----------|-------------|
| **Core (Phase 7)** | PostgreSQL + API + Nginx + React | ~1.0 GB |
| **+ Chatbot** | + Rasa | ~1.6 GB |
| **+ One AI service** | + Floor Plan **or** Indoor Nav | ~2.5 GB |

Enable optional AI services **one at a time** (Phase 8). Run `free -h` after each.

### Time estimate (core site)

| Work | Time |
|------|------|
| Phases 1–2 (prepare + connect) | 20–40 min |
| Phase 3 (install software) | 20–40 min |
| Phases 4–6 (upload + DB + build) | 30–60 min |
| Phase 7 (Nginx + PM2 + test) | 20–30 min |
| **Total (Phases 1–7)** | **~2 hours** |

---

## Your server details (fill in)

**Do not commit real passwords to Git.**

| Item | Your value |
|------|------------|
| Oracle Public IP | `___________________` |
| SSH username | `ubuntu` or `opc` |
| PPK file path | `___________________` |
| Domain (optional) | `___________________` |
| PostgreSQL DB name | `lecstu` |
| PostgreSQL user | `lecstu_user` |
| PostgreSQL password | `___________________` |
| JWT access secret | `___________________` |
| JWT refresh secret | `___________________` |
| Project path on server | `/var/www/lecstu` |

---

## Phase 1 — Prepare on your Windows PC

**Where:** Windows PowerShell (local)  
**Goal:** Clean test accounts, export real data, gather tools.

### 1.1 — Confirm local app works

- [ ] API runs: `npm run dev:server` (port 5000)
- [ ] Client runs: `npm run dev:client` (port 5173)
- [ ] Login and timetable/navigation work locally

### 1.2 — Remove test login accounts (keep all real data)

Deletes **only** `lecturer@stu.kln.ac.lk` and `student@stu.kln.ac.lk`. All other users and data stay.

```powershell
cd d:\Reasearch\lecstu\server
npx tsx scripts/remove-test-hosting-accounts.ts --dry-run
npm run db:remove-test-hosting-accounts
```

| Command | Meaning |
|---------|---------|
| `--dry-run` | Show what would be deleted — no changes |
| `npm run db:remove-test-hosting-accounts` | Delete the two test emails from PostgreSQL |

### 1.3 — Export your real database

**Do not use `npm run db:seed` on production** — it wipes everything.

```powershell
pg_dump -U postgres -d lecstu -F c -f d:\Reasearch\lecstu\lecstu-backup.dump
```

| Command | Meaning |
|---------|---------|
| `pg_dump` | Export PostgreSQL database to a file |
| `-U postgres` | Connect as PostgreSQL user `postgres` |
| `-d lecstu` | Database name |
| `-F c` | Custom compressed format (for `pg_restore`) |
| `-f ...dump` | Output file path |

Adjust `-U` / `-d` if your local `DATABASE_URL` differs.

### 1.4 — Gather files to upload later

| Local path | Upload to server? | Why |
|------------|-------------------|-----|
| Project code (Git or folder) | Yes | Application |
| `lecstu-backup.dump` | Yes | Real users, timetable, nav data |
| `server/uploads/` | Yes | Floor plans, profile photos |
| `server/.env` | No — create fresh on server | Secrets |
| `node_modules/`, `.venv/` | **No** | Reinstall on Linux |

### 1.5 — Install Windows tools

- [ ] [PuTTY](https://www.putty.org/) — SSH terminal
- [ ] [WinSCP](https://winscp.net/) (optional) — drag-and-drop upload
- [ ] Oracle Cloud **public IP** and **`.ppk`** private key

---

## Phase 2 — Connect & secure the server

**Where:** PuTTY + Oracle Cloud web console  
**Goal:** SSH access, open ports 22/80/443, update Ubuntu.

### 2.1 — Configure PuTTY session

1. Open **PuTTY**
2. **Session → Host Name:** `ubuntu@YOUR_PUBLIC_IP` (or `opc@...`)
3. **Session → Port:** `22`
4. **Connection → SSH → Auth → Private key:** your `.ppk` file
5. **Saved Sessions:** `LECSTU-Oracle` → **Save**

### 2.2 — Connect and verify

Click **Open** → Accept host key → you should see:

```text
ubuntu@instance-name:~$
```

```bash
whoami
pwd
```

| Command | Meaning |
|---------|---------|
| `whoami` | Show logged-in username (expect `ubuntu` or `opc`) |
| `pwd` | Print current folder (usually `/home/ubuntu`) |

### 2.3 — Open Oracle Cloud firewall (web console)

**Networking → VCN → Security Lists → Add Ingress Rules:**

| Source | Protocol | Port | Purpose |
|--------|----------|------|---------|
| `0.0.0.0/0` | TCP | 22 | SSH (PuTTY) |
| `0.0.0.0/0` | TCP | 80 | HTTP (website) |
| `0.0.0.0/0` | TCP | 443 | HTTPS (optional) |

### 2.4 — Open Ubuntu firewall (PuTTY)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

| Command | Meaning |
|---------|---------|
| `sudo ufw allow ...` | Allow traffic on a port through Ubuntu firewall |
| `sudo ufw enable` | Turn firewall on |
| `sudo ufw status` | List allowed ports — expect 22, 80, 443 |

### 2.5 — Update system and create project folder

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip build-essential
free -h
df -h
```

| Command | Meaning |
|---------|---------|
| `sudo apt update` | Refresh list of available packages |
| `sudo apt upgrade -y` | Install latest security updates (`-y` = yes to prompts) |
| `free -h` | Show RAM usage |
| `df -h` | Show disk space — need ~15 GB free on `/` |

```bash
sudo mkdir -p /var/www/lecstu
sudo chown -R $USER:$USER /var/www/lecstu
cd /var/www/lecstu
pwd
```

| Command | Meaning |
|---------|---------|
| `mkdir -p` | Create folder (and parents if missing) |
| `chown -R $USER:$USER` | Give your user ownership of the project folder |
| `cd` | Change into project directory |

✅ **Phase 2 done when:** PuTTY connects, `ufw status` shows 22/80/443, `pwd` is `/var/www/lecstu`.

---

## Phase 3 — Install system software

**Where:** PuTTY  
**Goal:** Node.js, PM2, PostgreSQL, Nginx, Python.

### 3.1 — Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

| Command | Meaning |
|---------|---------|
| `curl ... \| sudo bash` | Download and run NodeSource install script |
| `node -v` | Check Node version (expect `v20.x.x`) |
| `npm -v` | Check npm version |

### 3.2 — PM2 (keeps API running after logout)

```bash
sudo npm install -g pm2
pm2 -v
```

| Command | Meaning |
|---------|---------|
| `npm install -g pm2` | Install PM2 globally (process manager) |
| `pm2 -v` | Verify PM2 installed |

### 3.3 — PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
sudo systemctl status postgresql
```

| Command | Meaning |
|---------|---------|
| `systemctl enable` | Start PostgreSQL automatically on boot |
| `systemctl start` | Start PostgreSQL now |
| `systemctl status` | Check if running (press `q` to exit) |

### 3.4 — Nginx (web server)

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

Open `http://YOUR_PUBLIC_IP` in browser — you should see the **Nginx welcome page**.

| Command | Meaning |
|---------|---------|
| `nginx` | Serves React files and forwards `/api` to Node.js |

### 3.5 — Python 3.10 (for optional AI in Phase 8)

```bash
python3 --version
```

If not 3.10.x:

```bash
sudo apt install -y python3.10 python3.10-venv python3-pip
python3.10 --version
```

✅ **Phase 3 done when:** `node -v`, `pm2 -v`, PostgreSQL active, Nginx welcome page loads in browser.

---

## Phase 4 — Upload project & data

**Where:** PuTTY and/or WinSCP  
**Goal:** Code on server at `/var/www/lecstu`, uploads and DB dump uploaded.

### 4.1 — Upload code (choose one method)

**Method A — Git (if repo on GitHub)**

```bash
cd /var/www/lecstu
git clone https://github.com/YOUR_USERNAME/lecstu.git .
```

| Command | Meaning |
|---------|---------|
| `git clone URL .` | Download repo into current folder |

**Method B — WinSCP**

1. Connect: Host = public IP, User = `ubuntu`, Key = `.ppk`
2. Upload project to `/var/www/lecstu`
3. **Exclude:** `node_modules/`, `dist/`, `**/.venv/`

**Method C — ZIP**

On server after uploading `lecstu.zip`:

```bash
cd /var/www
unzip lecstu.zip -d lecstu
sudo chown -R $USER:$USER /var/www/lecstu
```

### 4.2 — Upload real data files (WinSCP)

| From (Windows) | To (server) |
|----------------|-------------|
| `d:\Reasearch\lecstu\lecstu-backup.dump` | `/home/ubuntu/lecstu-backup.dump` |
| `d:\Reasearch\lecstu\server\uploads\` | `/var/www/lecstu/server/uploads/` |

### 4.3 — Verify project structure

```bash
cd /var/www/lecstu
ls -la
ls package.json client/package.json server/package.json
```

| Command | Meaning |
|---------|---------|
| `ls -la` | List all files with details |

✅ **Phase 4 done when:** `server/package.json` and `client/package.json` exist on server; dump and uploads uploaded.

---

## Phase 5 — Database setup

**Where:** PuTTY (+ Windows already done in Phase 1.3)  
**Goal:** PostgreSQL user/database, schema migrations, restore real data.

### 5.1 — Create database user (PuTTY)

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER lecstu_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE lecstu OWNER lecstu_user;
GRANT ALL PRIVILEGES ON DATABASE lecstu TO lecstu_user;
\q
```

| SQL | Meaning |
|-----|---------|
| `CREATE USER` | Login for the app |
| `CREATE DATABASE` | Database named `lecstu` |
| `\q` | Quit psql |

### 5.2 — Test connection

```bash
psql "postgresql://lecstu_user:YOUR_STRONG_PASSWORD@localhost:5432/lecstu" -c "SELECT 1;"
```

| Command | Meaning |
|---------|---------|
| `psql "postgresql://..."` | Connect using connection string |
| `-c "SELECT 1;"` | Run one SQL command — expect a row with `1` |

Write password in [Your server details](#your-server-details-fill-in) above.

### 5.3 — Apply schema (migrations)

```bash
cd /var/www/lecstu/server
npx prisma migrate deploy
```

| Command | Meaning |
|---------|---------|
| `prisma migrate deploy` | Apply all migrations to production DB (creates tables) |

> Use `migrate deploy` on server — **never** `migrate dev` in production.

### 5.4 — Restore real data from backup

```bash
sudo apt install -y postgresql-client
pg_restore -U lecstu_user -d lecstu -c --if-exists /home/ubuntu/lecstu-backup.dump
```

| Command | Meaning |
|---------|---------|
| `pg_restore` | Import data from `pg_dump` backup |
| `-U lecstu_user` | Database user |
| `-d lecstu` | Target database |
| `-c --if-exists` | Drop existing objects before restore (clean import) |

If restore fails on `-c`, try without `-c` on an empty database, or use a plain SQL dump with `psql -f backup.sql`.

### 5.5 — Remove test accounts again (if in backup)

```bash
cd /var/www/lecstu/server
npm install
npm run db:remove-test-hosting-accounts
```

✅ **Phase 5 done when:** `SELECT 1` works, migrations applied, real users/timetable visible (optional: `npx prisma studio` locally against server DB).

---

## Phase 6 — Build & configure LECSTU

**Where:** PuTTY  
**Goal:** Install npm packages, production `.env`, build API and client.

### 6.1 — Install Node dependencies

```bash
cd /var/www/lecstu
npm install
npm install --prefix client
npm install --prefix server
```

| Command | Meaning |
|---------|---------|
| `npm install` | Install root dependencies |
| `npm install --prefix client` | Install client (React) dependencies |
| `npm install --prefix server` | Install server (API) dependencies |

Wait 5–15 minutes.

### 6.2 — Create production `.env`

```bash
cd /var/www/lecstu/server
cp .env.example .env
nano .env
```

**Nano keys:** `Ctrl+O` save, `Enter` confirm, `Ctrl+X` exit.

Minimum values:

```env
PORT=5000
NODE_ENV=production
CLIENT_URL=http://YOUR_PUBLIC_IP

DATABASE_URL=postgresql://lecstu_user:YOUR_STRONG_PASSWORD@localhost:5432/lecstu?schema=public

JWT_ACCESS_SECRET=PASTE_RANDOM_STRING_1
JWT_REFRESH_SECRET=PASTE_RANDOM_STRING_2
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

CHATBOT_API_KEY=lecstu-chatbot-prod-key

FLOORPLAN_VISION_URL=http://127.0.0.1:8003
FLOORPLAN_VISION_ENABLED=false

INDOOR_NAVIGATION_URL=http://127.0.0.1:8004
INDOOR_NAVIGATION_ENABLED=false
```

Generate JWT secrets:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

| Command | Meaning |
|---------|---------|
| `openssl rand -hex 32` | Create a random 64-character secret (run twice) |

Keep AI flags `false` until Phase 8 (saves RAM).

### 6.3 — Build server and client

```bash
cd /var/www/lecstu/server
npm run build

cd /var/www/lecstu/client
npm run build
```

| Command | Meaning |
|---------|---------|
| `npm run build` (server) | Compile TypeScript → `server/dist/` |
| `npm run build` (client) | Build React → `client/dist/` |

Verify:

```bash
ls /var/www/lecstu/server/dist/server.js
ls /var/www/lecstu/client/dist/index.html
```

Both files must exist.

### 6.4 — Ensure uploads folder

```bash
mkdir -p /var/www/lecstu/server/uploads/floorplans
chmod -R 755 /var/www/lecstu/server/uploads
```

| Command | Meaning |
|---------|---------|
| `chmod -R 755` | Allow web server to read uploaded files |

✅ **Phase 6 done when:** `dist/server.js` and `client/dist/index.html` exist; `.env` saved with real secrets.

---

## Phase 7 — Go live (Nginx + PM2 + verify)

**Where:** PuTTY + browser  
**Goal:** Public website on port 80, API on PM2, login works.

### 7.1 — Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/lecstu
```

Paste (replace `YOUR_PUBLIC_IP`):

```nginx
server {
    listen 80;
    server_name YOUR_PUBLIC_IP;

    client_max_body_size 25M;

    root /var/www/lecstu/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000/uploads/;
        proxy_set_header Host $host;
    }

    location /rasa/ {
        proxy_pass http://127.0.0.1:5005/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_read_timeout 120s;
    }
}
```

Enable site:

```bash
sudo ln -sf /etc/nginx/sites-available/lecstu /etc/nginx/sites-enabled/lecstu
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

| Command | Meaning |
|---------|---------|
| `ln -sf` | Enable LECSTU site (symlink) |
| `nginx -t` | Test config syntax |
| `systemctl reload nginx` | Apply new config without downtime |

### 7.2 — Start API with PM2

```bash
cd /var/www/lecstu/server
pm2 start dist/server.js --name lecstu-api
pm2 logs lecstu-api --lines 30
```

Look for: `[LECSTU] Server running on http://localhost:5000`  
Press `Ctrl+C` to stop watching logs (app keeps running).

| Command | Meaning |
|---------|---------|
| `pm2 start ... --name lecstu-api` | Run API in background with a name |
| `pm2 logs` | View application output |

### 7.3 — Auto-start PM2 on reboot

```bash
pm2 save
pm2 startup
```

Copy and run the `sudo env ...` command that PM2 prints, then:

```bash
pm2 save
```

| Command | Meaning |
|---------|---------|
| `pm2 save` | Remember current process list |
| `pm2 startup` | Generate boot script so PM2 starts after server restart |

### 7.4 — Health checks

```bash
curl http://127.0.0.1:5000/api/health
curl http://YOUR_PUBLIC_IP/api/health
pm2 list
ss -tlnp | grep -E '5000|80'
```

| Command | Meaning |
|---------|---------|
| `curl` | Test HTTP from server |
| `pm2 list` | All apps should show **online** |
| `ss -tlnp` | Show processes listening on ports 5000 and 80 |

### 7.5 — Browser verification

| URL | Expected |
|-----|----------|
| `http://YOUR_PUBLIC_IP` | LECSTU login page |
| `http://YOUR_PUBLIC_IP/api/health` | JSON health response |

**Checklist — core site live**

- [ ] Login works with a real user account
- [ ] Dashboard loads
- [ ] Timetable / navigation data present
- [ ] `pm2 list` → `lecstu-api` **online**
- [ ] Floor plan images load (uploads copied in Phase 4.2)

🎉 **Phases 1–7 complete — LECSTU is hosted.**

---

## Phase 8 — Optional extensions

**Only after Phase 7 works.** Enable one service at a time; run `free -h` after each.

### 8.1 — HTTPS with a domain

Requires a domain pointing to your public IP.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Update `server/.env`: `CLIENT_URL=https://yourdomain.com`  
Then: `pm2 restart lecstu-api`

### 8.2 — Rasa chatbot

```bash
cd /var/www/lecstu/ai-services/chatbot
python3.10 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
rasa train

pm2 start "rasa run actions" --name lecstu-rasa-actions
LECSTU_API_URL=http://127.0.0.1:5000/api CHATBOT_API_KEY=lecstu-chatbot-prod-key \
  pm2 start "rasa run --enable-api --cors \"*\"" --name lecstu-rasa
pm2 save
```

| Command | Meaning |
|---------|---------|
| `python3 -m venv .venv` | Create isolated Python environment |
| `source .venv/bin/activate` | Activate venv for this session |
| `rasa train` | Train chatbot model |

### 8.3 — Floor Plan Vision AI

```bash
cd /var/www/lecstu/ai-services/floorplan-vision
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pm2 start ".venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8003" --name lecstu-vision
```

In `server/.env`: `FLOORPLAN_VISION_ENABLED=true` → `pm2 restart lecstu-api`

### 8.4 — Indoor Navigation AI

```bash
cd /var/www/lecstu/ai-services/indoor-navigation-engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pm2 start ".venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8004" --name lecstu-indoor-nav
```

In `server/.env`: `INDOOR_NAVIGATION_ENABLED=true` → `pm2 restart lecstu-api`

### 8.5 — Add swap if out of memory

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

| Command | Meaning |
|---------|---------|
| `fallocate` / `mkswap` / `swapon` | Add 2 GB swap file as extra virtual RAM |

### 8.6 — Daily maintenance (after hosting)

```bash
pm2 list
free -h
df -h
curl -s http://127.0.0.1:5000/api/health
pm2 logs lecstu-api --lines 100
sudo tail -n 50 /var/log/nginx/error.log
```

**Deploy code updates:**

```bash
cd /var/www/lecstu
git pull
cd server && npm install && npm run build && npx prisma migrate deploy
cd ../client && npm install && npm run build
pm2 restart lecstu-api
sudo systemctl reload nginx
```

---

## Appendix A — Command dictionary

Quick reference for PuTTY. **Right-click** in PuTTY = paste.

### Navigation & files

| Command | Meaning |
|---------|---------|
| `pwd` | Show current folder |
| `ls -la` | List files (detailed) |
| `cd FOLDER` | Change directory |
| `cd ..` | Go up one folder |
| `mkdir -p PATH` | Create folder |
| `cp A B` | Copy file |
| `mv A B` | Move or rename |
| `rm FILE` | Delete file |
| `nano FILE` | Edit file in terminal |
| `cat FILE` | Print file contents |
| `tail -f FILE` | Follow log file live |

### System

| Command | Meaning |
|---------|---------|
| `sudo COMMAND` | Run as administrator |
| `whoami` | Current username |
| `chmod +x FILE` | Make script executable |
| `chown -R USER:GROUP PATH` | Change file owner |

### Packages & services

| Command | Meaning |
|---------|---------|
| `sudo apt update` | Refresh package list |
| `sudo apt install PKG` | Install software |
| `systemctl start/stop/restart/enable/status NAME` | Control system service |

### Network & processes

| Command | Meaning |
|---------|---------|
| `curl URL` | Test HTTP |
| `ss -tlnp` | Show listening ports |
| `free -h` | RAM usage |
| `df -h` | Disk usage |
| `htop` | Interactive process monitor (`q` to quit) |

### PM2

| Command | Meaning |
|---------|---------|
| `pm2 start FILE --name NAME` | Start app |
| `pm2 list` | List all apps |
| `pm2 logs NAME` | View logs |
| `pm2 restart NAME` | Restart app |
| `pm2 save` | Save process list |
| `pm2 startup` | Enable boot auto-start |

### Git

| Command | Meaning |
|---------|---------|
| `git clone URL .` | Clone repo into current folder |
| `git pull` | Download latest changes |

---

## Appendix B — Troubleshooting

### Common problems

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| PuTTY: Connection timed out | Port 22 blocked | Phase 2.3–2.4 |
| PuTTY: Server refused key | Wrong `.ppk` or user | Try `ubuntu` vs `opc` |
| Browser timeout on :80 | Port 80 blocked | Phase 2.3–2.4 |
| Nginx welcome, not LECSTU | Client not built or wrong `root` | Phase 6.3, 7.1 |
| `502 Bad Gateway` on `/api` | Node not running | `pm2 restart lecstu-api` |
| Login / DB error | Wrong `DATABASE_URL` | Phase 5, 6.2 |
| Missing floor plans | `uploads/` not copied | Phase 4.2 |
| `Killed` during pip | Out of RAM | Phase 8.5 swap; enable one AI at a time |

### Struggle log

| # | Date | Phase | What you tried | Error (exact) | Fix / status |
|---|------|-------|----------------|---------------|--------------|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |

---

## Start here

1. Complete **Phase 1** on Windows (export DB, remove test accounts).  
2. Complete **Phase 2** (PuTTY connect + firewall).  
3. Continue **Phase 3 → 7** in order.

When stuck, add a row to the [Struggle log](#struggle-log) with the exact error message.

---

*Last updated: 2026-06-20 — LECSTU Oracle Cloud deployment (8 phases)*
