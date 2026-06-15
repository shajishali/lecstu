import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const count = await prisma.user.count();
  const recent = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });
  console.log('DATABASE_URL host:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
  console.log('Total users:', count);
  console.log('Recent:', recent);
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
