# Phase 12.6 — Email verification test matrix

Password reset and registration verification flows. Automated API checks: `npx tsx scripts/run-phase-12-6-tests.ts` (server must be running). Playwright UI flow: `npm run test:password-reset`.

## Prerequisites

- API on port **5000**, client on **5173** (for UI tests)
- `server/.env`: database URL, JWT secrets
- For real inbox delivery: `SMTP_DISABLED=false` and valid Gmail/Office 365 credentials
- For dev codes on screen/API: console mode or failed SMTP (`devResetCode` / `devVerificationCode` in non-production)

---

## Manual test matrix

| # | Role | Email type | Steps | Expected |
|---|------|------------|-------|----------|
| 1 | Student | Gmail (personal recovery) | Forgot password → code in Gmail → reset → login | New password works; old password fails |
| 2 | Student | Outlook / `@stu.kln.ac.lk` | Same | Code in inbox or recovery Gmail; check junk/quarantine if missing |
| 3 | Lecturer | University mail | Same | Generic success message; code delivered to login or recovery address |
| 4 | Admin | Any registered admin | Same | Reset completes; admin dashboard loads after login |
| 5 | — | Unknown email | Forgot password with unregistered address | Generic message only; no enumeration |
| 6 | — | Expired code | Request code, wait 15+ min (or use script) | “Invalid or expired reset code” |
| 7 | — | Wrong code | Enter `000000` on reset page | Clear error; after 5 tries / 15 min → rate limit |
| 8 | Inactive user | Registered but deactivated | Forgot password | Generic message; no email sent |
| 9 | Registration | New Gmail signup | Register step 1 send code → verify → step 2 → login | Account created; duplicate email blocked |
| 10 | Admin | User Management | Admin → Users → Reset password on a user | **Unchanged** — force reset without email still works |

### Registration flow (manual)

1. `/register` → enter login email (+ optional recovery) → **Send verification code**
2. Enter 6-digit code → **Verify** → **Continue to account details**
3. Complete form → submit → redirected signed in

---

## Automated checks

```powershell
# Terminal 1: npm run dev:server

cd d:\Reasearch\lecstu\server
npx tsx scripts/run-phase-12-6-tests.ts
# Optional: npx tsx scripts/run-phase-12-6-tests.ts student@example.com

cd d:\Reasearch\lecstu
npm run test:password-reset
```

`run-phase-12-6-tests.ts` covers: unknown email, inactive account, wrong/expired code, full reset + login, same-password rejection, admin force-reset route present.

---

## Production cutover checklist

- [ ] `NODE_ENV=production` on API host
- [ ] `SMTP_DISABLED=false` (and Admin → Settings console mode **off**)
- [ ] `MAIL_FROM="LECSTU <sender@your-domain>"` with verified sender (Gmail app password or `noreply@kln.ac.lk` via IT)
- [ ] Reverse proxy sets `X-Forwarded-Proto: https` (auth routes reject plain HTTP in production)
- [ ] Run `npx tsx scripts/audit-phase-12-5-security.ts` — all checks pass
- [ ] Manual matrix rows 1–4 with real inboxes (Gmail + at least one university mailbox)
- [ ] Confirm `devResetCode` / `devVerificationCode` **not** returned in production API responses
- [ ] `.env` secrets not committed; `server/data/email-settings.json` gitignored if it holds credentials

---

## SMTP reference

See `server/.env.example` and root `runnableCommand.md` → **Email verification** section.
