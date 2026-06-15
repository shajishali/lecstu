/**
 * Clone active ET-Y2 master timetable rows onto ET-Y1 so ET first-year students
 * see a populated grid until admin imports a real ET-Y1 PDF.
 *
 * Idempotent: skips if ET-Y1 already has active slots.
 *
 * Run: npx tsx scripts/seed-et-y1-timetable.ts
 * Or:  npm run db:seed-et-y1 --prefix server
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { invalidateAll } from '../src/services/timetableCache';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/lecstu?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const etY1 = await prisma.studentGroup.findFirst({
    where: { name: { equals: 'ET-Y1', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  const etY2 = await prisma.studentGroup.findFirst({
    where: { name: { equals: 'ET-Y2', mode: 'insensitive' } },
    select: { id: true, name: true },
  });

  if (!etY1 || !etY2) {
    console.error('ET-Y1 or ET-Y2 group not found. Run npm run db:seed --prefix server first.');
    process.exit(1);
  }

  const existing = await prisma.masterTimetable.count({
    where: { groupId: etY1.id, isActive: true },
  });
  if (existing > 0) {
    console.log(`ET-Y1 already has ${existing} active slot(s). Nothing to do.`);
    return;
  }

  const source = await prisma.masterTimetable.findMany({
    where: { groupId: etY2.id, isActive: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  if (source.length === 0) {
    console.error('No active ET-Y2 slots to clone. Import ET-Y2 timetable first.');
    process.exit(1);
  }

  let created = 0;
  for (const s of source) {
    await prisma.masterTimetable.create({
      data: {
        year: s.year,
        month: s.month,
        week: s.week,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        semester: s.semester,
        isActive: true,
        lecturerInitials: s.lecturerInitials,
        courseId: s.courseId,
        lecturerId: s.lecturerId,
        hallId: s.hallId,
        groupId: etY1.id,
      },
    });
    created++;
  }

  invalidateAll();
  console.log(`Cloned ${created} active slot(s) from ${etY2.name} → ${etY1.name}.`);
  console.log('Timetable cache cleared. Refresh My Timetable in the browser.');
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
