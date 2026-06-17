/**
 * Set password for all active lecturer accounts (except system placeholders).
 * npm run db:reset-lecturer-passwords
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/utils/password';
import { UNASSIGNED_LECTURER_EMAIL } from '../src/services/conflictDetector';

const LECTURER_DEFAULT_PASSWORD = 'lecturer123';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashed = await hashPassword(LECTURER_DEFAULT_PASSWORD);
  const lecturers = await prisma.user.findMany({
    where: {
      role: 'LECTURER',
      isActive: true,
      NOT: { email: UNASSIGNED_LECTURER_EMAIL },
    },
    select: { id: true, email: true, firstName: true, lastName: true },
    orderBy: { email: 'asc' },
  });

  if (lecturers.length === 0) {
    console.log('No active lecturer accounts found.');
    return;
  }

  const result = await prisma.user.updateMany({
    where: {
      id: { in: lecturers.map((l) => l.id) },
    },
    data: { password: hashed },
  });

  console.log(`Reset password for ${result.count} lecturer(s) to "${LECTURER_DEFAULT_PASSWORD}":\n`);
  for (const l of lecturers) {
    console.log(`  ✓ ${l.firstName} ${l.lastName} — ${l.email}`);
  }
  console.log('\nLecturers can change their password later in My Profile.');
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
