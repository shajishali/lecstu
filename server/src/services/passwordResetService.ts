import crypto from 'crypto';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';

export const RESET_CODE_EXPIRY_MINUTES = 15;
export const RESET_CODE_LENGTH = 6;

export type VerifyResetCodeResult =
  | { valid: true; tokenId: string; userId: string }
  | { valid: false; reason: 'not_found' | 'expired' | 'used' | 'invalid_code' };

/** Cryptographically secure 6-digit numeric code (100000-999999). */
export function generateResetCode(): string {
  const value = crypto.randomInt(0, 1_000_000);
  return value.toString().padStart(RESET_CODE_LENGTH, '0');
}

function expiryDate(): Date {
  return new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);
}

/**
 * Invalidate prior unused tokens for the user, then store a new hashed code.
 * Returns the plain code (for email only - never persist or log in production API).
 */
export async function createResetToken(userId: string): Promise<{ tokenId: string; code: string; expiresAt: Date }> {
  const code = generateResetCode();
  const codeHash = await hashPassword(code);
  const expiresAt = expiryDate();

  const token = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.passwordResetToken.create({
      data: { userId, codeHash, expiresAt },
      select: { id: true, expiresAt: true },
    });
  });

  return { tokenId: token.id, code, expiresAt: token.expiresAt };
}

export async function verifyResetCode(userId: string, code: string): Promise<VerifyResetCodeResult> {
  const normalized = code.trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { valid: false, reason: 'invalid_code' };
  }

  const now = new Date();
  const candidates = await prisma.passwordResetToken.findMany({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (candidates.length === 0) {
    const anyForUser = await prisma.passwordResetToken.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { expiresAt: true, usedAt: true },
    });
    if (!anyForUser) return { valid: false, reason: 'not_found' };
    if (anyForUser.usedAt) return { valid: false, reason: 'used' };
    if (anyForUser.expiresAt <= now) return { valid: false, reason: 'expired' };
    return { valid: false, reason: 'invalid_code' };
  }

  for (const token of candidates) {
    const match = await comparePassword(normalized, token.codeHash);
    if (match) {
      return { valid: true, tokenId: token.id, userId };
    }
  }

  return { valid: false, reason: 'invalid_code' };
}

export async function verifyResetCodeByEmail(
  email: string,
  code: string,
): Promise<VerifyResetCodeResult & { userId?: string }> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' }, isActive: true },
    select: { id: true },
  });
  if (!user) return { valid: false, reason: 'not_found' };
  return verifyResetCode(user.id, code);
}

export async function markResetTokenUsed(tokenId: string): Promise<void> {
  await prisma.passwordResetToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
}

/** Remove expired tokens (and old used tokens older than 7 days). */
export async function purgeExpiredResetTokens(): Promise<number> {
  const usedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: usedCutoff } }],
    },
  });
  return result.count;
}
