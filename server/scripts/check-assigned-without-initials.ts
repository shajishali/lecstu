import prisma from '../src/config/database';
import { UNASSIGNED_LECTURER_EMAIL } from '../src/services/conflictDetector';

async function main() {
  const slots = await prisma.masterTimetable.findMany({
    where: { isActive: true, lecturerInitials: null },
    include: {
      course: { select: { name: true } },
      lecturer: { select: { email: true, firstName: true, lastName: true, timetableCode: true } },
      group: { select: { name: true } },
    },
  });
  const assigned = slots.filter((s) => s.lecturer.email !== UNASSIGNED_LECTURER_EMAIL);
  console.log('missing initials:', slots.length);
  console.log('but assigned lecturer:', assigned.length);
  for (const s of assigned.slice(0, 5)) {
    console.log(' ', s.group.name, s.dayOfWeek, s.startTime, s.lecturer.firstName, s.lecturer.timetableCode);
  }

  const { parseCellLinesToSlotRef } = await import('../src/services/timetableGridBuilder');
  let fromCourse = 0;
  for (const s of slots) {
    const parsed = parseCellLinesToSlotRef([s.course.name], s.dayOfWeek, s.startTime, s.endTime);
    if (parsed?.lecturerName) fromCourse++;
  }
  console.log('could parse lecturer from course.name:', fromCourse, '/', slots.length);
}

main().finally(() => prisma.$disconnect());
