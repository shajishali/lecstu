import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, firstName: true, lastName: true, isActive: true },
    orderBy: { email: 'asc' },
  });
  if (users.length === 0) {
    console.log('No users registered.');
    return;
  }
  console.log(`Registered users (${users.length}):\n`);
  for (const u of users) {
    console.log(`  ${u.email}  [${u.role}]  ${u.firstName} ${u.lastName}${u.isActive ? '' : ' (inactive)'}`);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
