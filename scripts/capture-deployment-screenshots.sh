#!/usr/bin/env bash
# =============================================================================
# LECSTU — Deployment screenshot capture helper (run ON the Oracle VM via SSH)
# =============================================================================
# Purpose: Print the exact commands and on-screen state for 10 thesis figures.
# You still take screenshots yourself (PuTTY window or browser) — this script
# only prepares each view and pauses so you can capture it.
#
# Usage (on server):
#   cd /var/www/lecstu
#   bash scripts/capture-deployment-screenshots.sh
#
# Save images on your PC as:
#   photos-for-thesis/appendix/fig-j-01-....png  …  fig-j-10-....png
# =============================================================================

set -euo pipefail

APP_ROOT="${LECSTU_ROOT:-/var/www/lecstu}"
PAUSE_SEC="${PAUSE_SEC:-8}"

green() { printf '\033[1;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[1;33m%s\033[0m\n' "$*"; }
cyan() { printf '\033[1;36m%s\033[0m\n' "$*"; }

pause_capture() {
  local fig="$1"
  local title="$2"
  local filename="$3"
  echo
  green "════════════════════════════════════════════════════════"
  green " FIGURE ${fig}: ${title}"
  green " Save as: photos-for-thesis/appendix/${filename}"
  green "════════════════════════════════════════════════════════"
  yellow "→ Take screenshot NOW (Win+Shift+S on Windows / Snipping Tool)."
  yellow "→ Waiting ${PAUSE_SEC}s (press Enter to continue early)…"
  read -t "${PAUSE_SEC}" -r _ || true
}

echo
cyan "LECSTU deployment screenshot helper"
cyan "App root: ${APP_ROOT}"
echo

# ── Fig J.1 — Project directory on server ───────────────────────────────────
pause_capture "J.1" "LECSTU project root on the production server" "fig-j-01-project-directory.png"
cd "${APP_ROOT}"
pwd
ls -la
echo
ls -la client/dist/index.html server/dist/server.js 2>/dev/null || true

# ── Fig J.2 — Node / npm / PM2 versions ─────────────────────────────────────
pause_capture "J.2" "Production runtime versions (Node.js, npm, and PM2)" "fig-j-02-runtime-versions.png"
node -v
npm -v
pm2 -v
python3 --version 2>/dev/null || true

# ── Fig J.3 — PostgreSQL status ─────────────────────────────────────────────
pause_capture "J.3" "Active PostgreSQL database service on the host" "fig-j-03-postgresql-status.png"
sudo systemctl status postgresql --no-pager -l | head -n 25

# ── Fig J.4 — Nginx config test + status ────────────────────────────────────
pause_capture "J.4" "Valid Nginx reverse-proxy configuration and service status" "fig-j-04-nginx-status.png"
sudo nginx -t
sudo systemctl status nginx --no-pager -l | head -n 20

# ── Fig J.5 — PM2 process list ──────────────────────────────────────────────
pause_capture "J.5" "PM2-managed LECSTU processes (lecstu-api online)" "fig-j-05-pm2-list.png"
pm2 list

# ── Fig J.6 — API health check ──────────────────────────────────────────────
pause_capture "J.6" "Express API health response (GET /api/health)" "fig-j-06-api-health.png"
curl -sS http://127.0.0.1:5000/api/health | python3 -m json.tool 2>/dev/null \
  || curl -sS http://127.0.0.1:5000/api/health
echo

# ── Fig J.7 — Recent API logs ───────────────────────────────────────────────
pause_capture "J.7" "Recent production API logs from PM2 (lecstu-api)" "fig-j-07-pm2-logs.png"
pm2 logs lecstu-api --lines 40 --nostream

# ── Fig J.8 — Listening ports ───────────────────────────────────────────────
pause_capture "J.8" "Host listening ports for HTTP, HTTPS, and the API" "fig-j-08-listening-ports.png"
# Prefer ss; fall back to netstat if needed
if command -v ss >/dev/null 2>&1; then
  sudo ss -tlnp | grep -E ':(80|443|5000|5005|5055|8001|8003|8004)\s' || sudo ss -tlnp | head -n 30
else
  sudo netstat -tlnp | head -n 30
fi

# ── Fig J.9 — Disk / memory (host capacity) ─────────────────────────────────
pause_capture "J.9" "Server disk space and memory usage" "fig-j-09-disk-memory.png"
df -h /
free -h
echo
uptime

# ── Fig J.10 — HTTPS site (open browser; script only prints reminder) ───────
pause_capture "J.10" "Live LECSTU site over HTTPS (https://lecstu.com)" "fig-j-10-https-site.png"
yellow "Open a browser on your PC and visit: https://lecstu.com"
yellow "Show the address bar (HTTPS lock) + login or dashboard (no personal data)."
yellow "Optional TLS check from server:"
echo "curl -sI https://lecstu.com | head -n 15"
curl -sI https://lecstu.com 2>/dev/null | head -n 15 || true

echo
green "Done. Copy the 10 PNGs into photos-for-thesis/appendix/ then embed in Appendix J."
echo
