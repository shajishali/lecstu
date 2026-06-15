import prisma from '../src/config/database';
import { normalizeGridSnapshot, rewriteGridCellsFromSlotRefs } from '../src/services/timetableGridBuilder';
import { backfillSlotRefsForGroup } from '../src/services/timetableRepairService';
import { getLecturerDisplayIndex } from '../src/services/lecturerDisplayService';
import type { TimetableGridSnapshot } from '../src/types/timetableGrid';
import { UNASSIGNED_LECTURER_EMAIL } from '../src/services/conflictDetector';

async function main() {
  const groupName = process.argv[2] || 'CT-Y3-CTNT';
  const snap = await prisma.timetableTableSnapshot.findFirst({
    where: { groupName },
    select: { id: true, gridData: true },
  });
  if (!snap) throw new Error('not found');
  const before = JSON.stringify(snap.gridData).length;
  const grid = normalizeGridSnapshot(snap.gridData as TimetableGridSnapshot);
  const dbSlots = await prisma.masterTimetable.findMany({
    where: { isActive: true, group: { name: groupName } },
    include: {
      course: { select: { name: true } },
      hall: { select: { name: true } },
      lecturer: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  let slotRefs = backfillSlotRefsForGroup(
    groupName,
    dbSlots.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      courseName: s.course.name,
      hallName: s.hall.name,
      lecturerName:
        s.lecturerInitials?.trim() ||
        (s.lecturer.email !== UNASSIGNED_LECTURER_EMAIL
          ? `${s.lecturer.firstName} ${s.lecturer.lastName}`.trim()
          : undefined),
    })),
  );
  const lecturerDisplay = await getLecturerDisplayIndex(true);
  const rewritten = rewriteGridCellsFromSlotRefs(grid, slotRefs, { lecturerDisplay });
  const after = JSON.stringify(rewritten).length;
  console.log(groupName, 'before MB', (before / 1024 / 1024).toFixed(2), 'after MB', (after / 1024 / 1024).toFixed(2));
  await prisma.timetableTableSnapshot.update({
    where: { id: snap.id },
    data: { gridData: rewritten as object },
  });
  console.log('saved');
}

main().finally(() => prisma.$disconnect());
