/**
 * Set recovery email for a user (password reset delivery).
 * Usage: npx tsx scripts/set-recovery-email.ts <loginEmail> <recoveryEmail>
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const loginEmail = process.argv[2];
const recoveryEmail = process.argv[3];

if (!loginEmail || !recoveryEmail) {
  console.error('Usage: npx tsx scripts/set-recovery-email.ts <loginEmail> <recoveryEmail>');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: loginEmail.trim(), mode: 'insensitive' } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!user) {
    console.error(`User not found: ${loginEmail}`);
    process.exit(1);
  }

  const normalizedRecovery = recoveryEmail.trim().toLowerCase();
  if (normalizedRecovery === user.email.toLowerCase()) {
    console.error('Recovery email must differ from login email.');
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { recoveryEmail: normalizedRecovery },
  });

  console.log(`Updated ${user.firstName} ${user.lastName} (${user.email})`);
  console.log(`Recovery email → ${normalizedRecovery}`);
  console.log('Password reset codes will now be sent to the recovery email.');
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
