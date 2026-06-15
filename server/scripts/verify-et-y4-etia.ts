import prisma from '../src/config/database';
import { getStudentTimetable } from '../src/services/timetableService';

async function main() {
  const db = await prisma.masterTimetable.findMany({
    where: {
      group: { name: 'ET-Y4-ETIA' },
      isActive: true,
      year: 2026,
      month: 1,
      week: 1,
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      course: { select: { code: true } },
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  console.log('DB ET-Y4-ETIA week1:');
  for (const r of db) {
    console.log(`  ${r.dayOfWeek} ${r.startTime}-${r.endTime} ${r.course.code}`);
  }

  const student = await prisma.user.findFirst({
    where: {
      role: 'STUDENT',
      studentGroupMemberships: { some: { group: { name: 'ET-Y4-ETIA' } } },
    },
    select: { id: true, email: true },
  });
  if (student) {
    const tt = await getStudentTimetable(student.id);
    const thu = (tt.flat || []).filter((s) => s.dayOfWeek === 'THURSDAY');
    console.log(`\nAPI for student ${student.email}:`);
    for (const s of thu) {
      console.log(`  ${s.startTime}-${s.endTime} ${s.course.code}`);
    }
  }
}

main()
  .finally(() => prisma.$disconnect());
