/**
 * Phase 12.5 security checklist — run: npx tsx scripts/audit-phase-12-5-security.ts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getEmailServiceMode, isSmtpConfigured } from '../src/services/emailService';

const checks: { name: string; pass: boolean; detail: string }[] = [];

function pass(name: string, detail: string) {
  checks.push({ name, pass: true, detail });
}

function fail(name: string, detail: string) {
  checks.push({ name, pass: false, detail });
}

const root = path.resolve(__dirname, '..');

// Codes hashed at rest — verify service files never persist plain codes in DB layer
const resetService = fs.readFileSync(path.join(root, 'src/services/passwordResetService.ts'), 'utf8');
const regService = fs.readFileSync(path.join(root, 'src/services/registrationVerificationService.ts'), 'utf8');
if (resetService.includes('codeHash') && resetService.includes('hashPassword(code)')) {
  pass('Password reset codes hashed', 'codeHash + bcrypt in passwordResetService');
} else {
  fail('Password reset codes hashed', 'passwordResetService missing codeHash flow');
}
if (regService.includes('codeHash') && regService.includes('hashPassword(code)')) {
  pass('Registration codes hashed', 'codeHash + bcrypt in registrationVerificationService');
} else {
  fail('Registration codes hashed', 'registrationVerificationService missing codeHash flow');
}

// Generic forgot-password message
const resetCtrl = fs.readFileSync(path.join(root, 'src/controllers/passwordResetController.ts'), 'utf8');
if (resetCtrl.includes('GENERIC_FORGOT_MESSAGE') && !resetCtrl.includes('email not found')) {
  pass('Generic forgot-password response', 'No email enumeration in API message');
} else {
  fail('Generic forgot-password response', 'Check passwordResetController messages');
}

// Rate limiters on auth routes
const authRoutes = fs.readFileSync(path.join(root, 'src/routes/auth.ts'), 'utf8');
const rateLimited = [
  'forgot-password',
  'verify-reset-code',
  'reset-password',
  'registration/send-code',
  'registration/verify-code',
].every((route) => authRoutes.includes(route) && authRoutes.includes('Limiter'));
if (rateLimited) {
  pass('Rate limits on email verification routes', 'IP + email limiters wired in auth.ts');
} else {
  fail('Rate limits on email verification routes', 'Missing limiter on one or more routes');
}

// HTTPS middleware
const authRoutesHttps = authRoutes.includes('requireHttpsInProduction');
if (authRoutesHttps) {
  pass('HTTPS enforcement (production)', 'requireHttpsInProduction on /api/auth');
} else {
  fail('HTTPS enforcement (production)', 'Missing requireHttpsInProduction');
}

// Audit logging
if (fs.existsSync(path.join(root, 'src/utils/emailVerificationAudit.ts'))) {
  pass('Security audit logging', 'emailVerificationAudit.ts present');
} else {
  fail('Security audit logging', 'emailVerificationAudit.ts missing');
}

// Email templates multipart
const emailService = fs.readFileSync(path.join(root, 'src/services/emailService.ts'), 'utf8');
if (emailService.includes('text:') && emailService.includes('html:')) {
  pass('HTML + plain-text email bodies', 'sendMail sends both text and html');
} else {
  fail('HTML + plain-text email bodies', 'emailService missing text/html');
}

// MAIL_FROM
const mailFrom = process.env.MAIL_FROM || '';
if (mailFrom.includes('LECSTU') || mailFrom.includes('@')) {
  pass('MAIL_FROM configured', mailFrom || '(from admin settings JSON)');
} else {
  fail('MAIL_FROM configured', 'Set MAIL_FROM in server/.env');
}

// SMTP mode
const mode = getEmailServiceMode();
if (process.env.NODE_ENV === 'production') {
  if (mode === 'smtp' && isSmtpConfigured()) {
    pass('Production SMTP ready', `mode=${mode}`);
  } else {
    fail('Production SMTP ready', `mode=${mode} — set SMTP credentials and SMTP_DISABLED=false`);
  }
} else {
  pass('Dev email mode', `mode=${mode} (console OK in development)`);
}

console.log('\nPhase 12.5 — Email verification security audit\n');
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} | ${c.name}`);
  console.log(`       ${c.detail}\n`);
}
const failed = checks.filter((c) => !c.pass).length;
console.log(`${checks.length - failed}/${checks.length} checks passed.\n`);
process.exit(failed > 0 ? 1 : 0);
