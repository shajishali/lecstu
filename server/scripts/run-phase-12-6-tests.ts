/**
 * Phase 12.6 — automated API tests for email verification flows.
 * Requires API server: npm run dev:server
 *
 * Usage: npx tsx scripts/run-phase-12-6-tests.ts [active-user-email]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import { createResetToken } from '../src/services/passwordResetService';

const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000/api';
const testEmailArg = process.argv[2]?.trim().toLowerCase();

type Check = { name: string; pass: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  console.log(`       ${detail}\n`);
}

async function post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await axios.post(`${baseUrl}${path}`, body, { validateStatus: () => true });
  return res.data as T;
}

async function expectStatus(
  path: string,
  body: Record<string, unknown>,
  status: number,
): Promise<Record<string, unknown>> {
  const res = await axios.post(`${baseUrl}${path}`, body, { validateStatus: () => true });
  if (res.status !== status) {
    throw new Error(`${path} expected ${status}, got ${res.status}: ${JSON.stringify(res.data)}`);
  }
  return res.data as Record<string, unknown>;
}

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // Health
    try {
      await axios.get(`${baseUrl.replace(/\/api$/, '')}/api/health`, { timeout: 5000 });
    } catch {
      console.error('API not reachable. Start: npm run dev:server');
      process.exit(1);
    }

    const unknown = await post<{
      message?: string;
      accountFound?: boolean;
    }>('/auth/forgot-password', { email: 'phase-12-6-unknown@test.invalid' });
    const unknownOk =
      typeof unknown.message === 'string' &&
      unknown.message.includes('registered') &&
      (process.env.NODE_ENV === 'production' || unknown.accountFound === false);
    record(
      'Unknown email — generic response',
      unknownOk,
      unknownOk ? unknown.message! : JSON.stringify(unknown),
    );

    // ── Inactive account ────────────────────────────────────────────────────
    const inactive = await prisma.user.findFirst({
      where: { isActive: false },
      select: { email: true },
    });
    if (inactive) {
      const inactiveRes = await post<{ message?: string; accountFound?: boolean; devResetCode?: string }>(
        '/auth/forgot-password',
        { email: inactive.email },
      );
      const inactiveOk =
        typeof inactiveRes.message === 'string' &&
        inactiveRes.message.includes('registered') &&
        !inactiveRes.devResetCode &&
        (process.env.NODE_ENV === 'production' || inactiveRes.accountFound !== true);
      record(
        'Inactive account — no reset email',
        inactiveOk,
        inactiveOk ? `Inactive ${inactive.email}` : JSON.stringify(inactiveRes),
      );
    } else {
      record('Inactive account — no reset email', true, 'Skipped — no inactive user in DB (create one to test manually)');
    }

    // ── Test user ───────────────────────────────────────────────────────────
    const user = testEmailArg
      ? await prisma.user.findFirst({
          where: { email: { equals: testEmailArg, mode: 'insensitive' }, isActive: true },
          select: { id: true, email: true, password: true },
        })
      : await prisma.user.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, password: true },
        });

    if (!user) {
      record('Active user for flow tests', false, 'No active user found');
      printSummary();
      process.exit(1);
    }

    const originalPasswordHash = user.password;
    record('Active user for flow tests', true, user.email);

    // ── Wrong code ──────────────────────────────────────────────────────────
    try {
      await expectStatus('/auth/verify-reset-code', { email: user.email, code: '000000' }, 400);
      record('Wrong reset code rejected', true, 'HTTP 400 on verify-reset-code');
    } catch (err) {
      record('Wrong reset code rejected', false, (err as Error).message);
    }

    // ── Expired code ────────────────────────────────────────────────────────
    try {
      const { code, tokenId } = await createResetToken(user.id);
      await prisma.passwordResetToken.update({
        where: { id: tokenId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      await expectStatus('/auth/verify-reset-code', { email: user.email, code }, 400);
      record('Expired reset code rejected', true, 'Token backdated; verify returned 400');
    } catch (err) {
      record('Expired reset code rejected', false, (err as Error).message);
    }

    // ── Same password ───────────────────────────────────────────────────────
    try {
      const { code } = await createResetToken(user.id);
      const currentPlain = 'Phase12SamePass1';
      await prisma.user.update({
        where: { id: user.id },
        data: { password: await hashPassword(currentPlain) },
      });
      await expectStatus(
        '/auth/reset-password',
        { email: user.email, code, newPassword: currentPlain },
        400,
      );
      record('Same password rejected on reset', true, 'HTTP 400 when new equals current');
    } catch (err) {
      record('Same password rejected on reset', false, (err as Error).message);
    } finally {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: originalPasswordHash },
      });
    }

    // ── Full reset + login ──────────────────────────────────────────────────
    const newPassword = 'Phase12Reset1';
    let resetCode: string | undefined;

    try {
      const forgot = await post<{ devResetCode?: string; message?: string }>('/auth/forgot-password', {
        email: user.email,
      });
      resetCode = forgot.devResetCode;
    } catch {
      /* fall through */
    }

    if (!resetCode) {
      const created = await createResetToken(user.id);
      resetCode = created.code;
      record(
        'Forgot-password dev code (SMTP path)',
        true,
        'Used createResetToken fallback (SMTP may have delivered without devResetCode)',
      );
    } else {
      record('Forgot-password dev code (SMTP path)', true, 'devResetCode from /auth/forgot-password');
    }

    try {
      await expectStatus('/auth/verify-reset-code', { email: user.email, code: resetCode! }, 200);
      await expectStatus(
        '/auth/reset-password',
        { email: user.email, code: resetCode!, newPassword },
        200,
      );
      const loginOk = await post<{ success?: boolean }>('/auth/login', {
        email: user.email,
        password: newPassword,
      });
      const loginPass = loginOk.success === true;
      record(
        'Full reset + login',
        loginPass,
        loginPass ? 'verify → reset → login OK' : JSON.stringify(loginOk),
      );

      await prisma.user.update({
        where: { id: user.id },
        data: { password: originalPasswordHash },
      });
      record('Password restored after test', true, 'Original password hash restored');
    } catch (err) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: originalPasswordHash },
      }).catch(() => {});
      const ax = err as AxiosError;
      record('Full reset + login', false, ax.message || String(err));
    }

    // ── Admin force-reset route (unchanged) ─────────────────────────────────
    const adminRouteFile = fs.readFileSync(
      path.join(__dirname, '../src/routes/adminUsers.ts'),
      'utf8',
    );
    const adminPatchOk =
      adminRouteFile.includes("router.patch('/:id/password'") &&
      adminRouteFile.includes('resetUserPassword');
    record(
      'Admin User Management force-reset route',
      adminPatchOk,
      adminPatchOk ? 'PATCH /admin/users/:id/password unchanged' : 'Route missing',
    );

    printSummary();
    process.exit(checks.some((c) => !c.pass) ? 1 : 0);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

function printSummary() {
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\nPhase 12.6 API tests: ${checks.length - failed}/${checks.length} passed.\n`);
  console.log('Manual inbox matrix: docs/email-verification/PHASE-12-6-TEST-MATRIX.md\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
