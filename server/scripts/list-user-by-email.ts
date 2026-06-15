import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/list-user-by-email.ts <email>');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true, email: true, role: true, firstName: true, lastName: true, createdAt: true },
  });
  console.log(user ?? 'not found');
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
