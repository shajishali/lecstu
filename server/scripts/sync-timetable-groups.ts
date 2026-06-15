/**
 * Moves timetable entries from PDF/legacy group names to canonical seed groups (CS-Y3-AINT, …).
 * Run: npx tsx scripts/sync-timetable-groups.ts
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  resolveCanonicalGroupName,
  resolveCanonicalGroupNames,
} from '../prisma/fct-faculty-config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const groups = await prisma.studentGroup.findMany({
    include: { _count: { select: { members: true, timetableEntries: true } } },
  });

  const nameToId = new Map(groups.map((g) => [g.name.toUpperCase(), g.id]));
  let moved = 0;
  let duplicated = 0;
  const deleted: string[] = [];

  for (const group of groups) {
    const canonicalList = resolveCanonicalGroupNames(group.name);
    if (canonicalList.length === 0) continue;

    if (canonicalList.length === 1 && canonicalList[0].toUpperCase() === group.name.toUpperCase()) {
      continue;
    }

    const entries = await prisma.masterTimetable.findMany({
      where: { groupId: group.id },
    });
    if (entries.length === 0) continue;

    for (const canonical of canonicalList) {
      let targetId = nameToId.get(canonical.toUpperCase());
      if (!targetId) {
        const created = await prisma.studentGroup.create({
          data: {
            name: canonical,
            batchYear: group.batchYear,
            batchLabel: group.batchLabel,
            departmentId: group.departmentId,
            pathwayId: group.pathwayId,
          },
        });
        targetId = created.id;
        nameToId.set(canonical.toUpperCase(), targetId);
        console.log(`  + Created canonical group ${canonical}`);
      }

      if (targetId === group.id) continue;

      if (canonicalList.length === 1) {
        const result = await prisma.masterTimetable.updateMany({
          where: { groupId: group.id },
          data: { groupId: targetId },
        });
        moved += result.count;
        console.log(`  → ${group.name} → ${canonical}: moved ${result.count} entries`);
      } else {
        for (const entry of entries) {
          const exists = await prisma.masterTimetable.findFirst({
            where: {
              groupId: targetId,
              year: entry.year,
              month: entry.month,
              week: entry.week,
              dayOfWeek: entry.dayOfWeek,
              startTime: entry.startTime,
              endTime: entry.endTime,
              courseId: entry.courseId,
            },
          });
          if (!exists) {
            await prisma.masterTimetable.create({
              data: {
                year: entry.year,
                month: entry.month,
                week: entry.week,
                dayOfWeek: entry.dayOfWeek,
                startTime: entry.startTime,
                endTime: entry.endTime,
                semester: entry.semester,
                courseId: entry.courseId,
                lecturerId: entry.lecturerId,
                hallId: entry.hallId,
                groupId: targetId,
                isActive: entry.isActive,
              },
            });
            duplicated++;
          }
        }
        console.log(`  → ${group.name}: duplicated entries to ${canonical}`);
      }
    }

    if (canonicalList.length === 1) {
      const left = await prisma.masterTimetable.count({ where: { groupId: group.id } });
      if (left === 0 && group._count.members === 0) {
        await prisma.studentGroup.delete({ where: { id: group.id } });
        deleted.push(group.name);
      }
    }
  }

  console.log(`\nDone. Moved ${moved}, duplicated ${duplicated}, removed ${deleted.length} empty alias groups.`);
  if (deleted.length) console.log('Removed:', deleted.join(', '));
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
