import prisma from '../src/config/database';
import { getTableSnapshotById } from '../src/services/timetableTableService';

async function main() {
  const snap = await prisma.timetableTableSnapshot.findFirst({
    where: { groupName: { contains: 'ET-Y4-ETIA', mode: 'insensitive' } },
    select: { id: true },
  });
  if (!snap) return;
  const g = await getTableSnapshotById(snap.id);
  if (!g) return;
  const di = g.dayColumns.findIndex((d) => d.day === 'MONDAY');
  const ti = g.timeRows.findIndex((t) => t.start === '10:00');
  console.log('Monday 10:00 lines:', g.cells[ti]?.[di]?.displayLines);
}

main().finally(() => prisma.$disconnect());
