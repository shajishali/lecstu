/**
 * Reset password for all active admin accounts.
 * Usage: npx tsx scripts/reset-admin-password.ts [newPassword]
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/utils/password';

const newPassword = process.argv[2] || 'admin123';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { email: 'asc' },
  });

  if (admins.length === 0) {
    console.log('No active admin accounts found.');
    return;
  }

  const hashed = await hashPassword(newPassword);
  const result = await prisma.user.updateMany({
    where: { id: { in: admins.map((a) => a.id) } },
    data: { password: hashed },
  });

  console.log(`Reset password for ${result.count} admin(s):\n`);
  for (const admin of admins) {
    console.log(`  ✓ ${admin.firstName} ${admin.lastName} — ${admin.email}`);
  }
  console.log(`\nNew password: ${newPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
