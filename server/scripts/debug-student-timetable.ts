import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const email = process.argv[2] || 'student@kln.ac.lk';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    include: {
      studentGroupMemberships: {
        include: { group: { select: { id: true, name: true } } },
      },
    },
  });
  if (!user) {
    console.log('User not found:', email);
    return;
  }
  console.log('User:', user.email, user.role, user.id);
  const groups = user.studentGroupMemberships.map((m) => m.group);
  console.log('Groups:', groups.length ? groups : '(none)');

  for (const g of groups) {
    const count = await prisma.masterTimetable.count({
      where: { groupId: g.id, isActive: true },
    });
    console.log(`  ${g.name} (${g.id}): ${count} active timetable entries`);
  }

  const allGroupsWithEntries = await prisma.masterTimetable.groupBy({
    by: ['groupId'],
    where: { isActive: true },
    _count: true,
  });
  console.log('\nAll groups with timetable entries:');
  for (const row of allGroupsWithEntries) {
    const g = await prisma.studentGroup.findUnique({
      where: { id: row.groupId },
      select: { name: true },
    });
    console.log(`  ${g?.name ?? row.groupId}: ${row._count} entries`);
  }

  const csGroups = await prisma.studentGroup.findMany({
    where: {
      OR: [
        { name: { contains: 'CS', mode: 'insensitive' } },
        { name: { contains: 'AINT', mode: 'insensitive' } },
      ],
    },
    include: { _count: { select: { members: true, timetableEntries: true } } },
    orderBy: { name: 'asc' },
  });
  console.log('\nCS/AINT groups:');
  for (const g of csGroups) {
    console.log(`  ${g.name}: ${g._count.members} members, ${g._count.timetableEntries} entries`);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
