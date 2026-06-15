import prisma from '../src/config/database';
import { extractSlotRefsFromGridSnapshot } from '../src/services/timetableGridBuilder';
import type { TimetableGridSnapshot } from '../src/types/timetableGrid';

async function main() {
  const tbdSlots = await prisma.masterTimetable.findMany({
    where: { isActive: true, hall: { name: { equals: 'TBD', mode: 'insensitive' } } },
    include: { group: { select: { name: true } } },
  });
  let recoverable = 0;
  for (const slot of tbdSlots) {
    const snap = await prisma.timetableTableSnapshot.findFirst({
      where: { groupName: { equals: slot.group.name, mode: 'insensitive' } },
      select: { gridData: true },
    });
    if (!snap) continue;
    const refs = extractSlotRefsFromGridSnapshot(snap.gridData as TimetableGridSnapshot);
    const ref = refs.find(
      (r) =>
        r.dayOfWeek === slot.dayOfWeek &&
        r.startTime === slot.startTime &&
        r.endTime === slot.endTime,
    );
    if (ref?.hallName && ref.hallName.toUpperCase() !== 'TBD') {
      recoverable++;
      if (recoverable <= 5) {
        console.log(slot.group.name, slot.dayOfWeek, slot.startTime, '->', ref.hallName);
      }
    }
  }
  console.log(`TBD in DB: ${tbdSlots.length}, recoverable from grid: ${recoverable}`);
}

main().finally(() => prisma.$disconnect());
