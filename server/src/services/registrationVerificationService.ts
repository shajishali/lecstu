import crypto from 'crypto';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';

export const REGISTRATION_CODE_EXPIRY_MINUTES = 15;
export const REGISTRATION_CODE_LENGTH = 6;

export type VerifyRegistrationCodeResult =
  | { valid: true; tokenId: string }
  | { valid: false; reason: 'not_found' | 'expired' | 'used' | 'invalid_code' };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function generateRegistrationCode(): string {
  const value = crypto.randomInt(0, 1_000_000);
  return value.toString().padStart(REGISTRATION_CODE_LENGTH, '0');
}

function expiryDate(): Date {
  return new Date(Date.now() + REGISTRATION_CODE_EXPIRY_MINUTES * 60 * 1000);
}

export async function createRegistrationVerificationToken(
  email: string,
): Promise<{ tokenId: string; code: string; expiresAt: Date }> {
  const normalized = normalizeEmail(email);
  const code = generateRegistrationCode();
  const codeHash = await hashPassword(code);
  const expiresAt = expiryDate();

  const token = await prisma.$transaction(async (tx) => {
    await tx.registrationVerificationToken.updateMany({
      where: { email: normalized, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.registrationVerificationToken.create({
      data: { email: normalized, codeHash, expiresAt },
      select: { id: true, expiresAt: true },
    });
  });

  return { tokenId: token.id, code, expiresAt: token.expiresAt };
}

export async function verifyRegistrationCode(
  email: string,
  code: string,
): Promise<VerifyRegistrationCodeResult> {
  const normalized = normalizeEmail(email);
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return { valid: false, reason: 'invalid_code' };
  }

  const now = new Date();
  const candidates = await prisma.registrationVerificationToken.findMany({
    where: {
      email: normalized,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (candidates.length === 0) {
    return { valid: false, reason: 'not_found' };
  }

  for (const token of candidates) {
    const match = await comparePassword(normalizedCode, token.codeHash);
    if (match) {
      await prisma.registrationVerificationToken.update({
        where: { id: token.id },
        data: { verifiedAt: new Date() },
      });
      return { valid: true, tokenId: token.id };
    }
  }

  return { valid: false, reason: 'invalid_code' };
}

export async function consumeRegistrationVerification(
  email: string,
  code: string,
): Promise<VerifyRegistrationCodeResult> {
  const normalized = normalizeEmail(email);
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    return { valid: false, reason: 'invalid_code' };
  }

  const now = new Date();
  const candidates = await prisma.registrationVerificationToken.findMany({
    where: {
      email: normalized,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (candidates.length === 0) {
    return { valid: false, reason: 'not_found' };
  }

  for (const token of candidates) {
    const match = await comparePassword(normalizedCode, token.codeHash);
    if (match) {
      await prisma.registrationVerificationToken.update({
        where: { id: token.id },
        data: { verifiedAt: token.verifiedAt ?? new Date(), usedAt: new Date() },
      });
      return { valid: true, tokenId: token.id };
    }
  }

  return { valid: false, reason: 'invalid_code' };
}

export async function purgeExpiredRegistrationVerificationTokens(): Promise<number> {
  const usedCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.registrationVerificationToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: usedCutoff } }],
    },
  });
  return result.count;
}
