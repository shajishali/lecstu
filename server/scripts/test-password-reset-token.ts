/**
 * Smoke test for password reset tokens (Phase 12.2).
 * Usage: npx tsx scripts/test-password-reset-token.ts [user-email]
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  createResetToken,
  verifyResetCode,
  markResetTokenUsed,
  purgeExpiredResetTokens,
} from '../src/services/passwordResetService';

const email = process.argv[2];

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = email
      ? await prisma.user.findFirst({
          where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
          select: { id: true, email: true },
        })
      : await prisma.user.findFirst({
          where: { isActive: true },
          select: { id: true, email: true },
          orderBy: { createdAt: 'asc' },
        });

    if (!user) {
      console.error('No user found.');
      process.exit(1);
    }

    console.log(`User: ${user.email}`);

    const { tokenId, code, expiresAt } = await createResetToken(user.id);
    console.log(`Created token ${tokenId}, expires ${expiresAt.toISOString()}`);
    console.log(`Plain code (dev only): ${code}`);

    const ok = await verifyResetCode(user.id, code);
    console.log('Verify correct code:', ok);

    const bad = await verifyResetCode(user.id, '000000');
    console.log('Verify wrong code:', bad);

    await markResetTokenUsed(tokenId);
    const afterUse = await verifyResetCode(user.id, code);
    console.log('Verify after mark used:', afterUse);

    const purged = await purgeExpiredResetTokens();
    console.log(`Purged ${purged} old token(s)`);

    console.log('\nPhase 12.2 token service OK');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
