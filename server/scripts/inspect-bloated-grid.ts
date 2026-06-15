import prisma from '../src/config/database';
import type { TimetableGridSnapshot } from '../src/types/timetableGrid';

async function main() {
  const snap = await prisma.timetableTableSnapshot.findFirst({
    where: { groupName: 'CT-Y3-CTNT' },
    select: { gridData: true },
  });
  const g = snap?.gridData as TimetableGridSnapshot;
  if (!g) return;
  console.log('timeRows', g.timeRows?.length, 'dayCols', g.dayColumns?.length);
  console.log('cells rows', g.cells?.length, 'cols', g.cells?.[0]?.length);
  let maxLines = 0;
  let maxRaw = 0;
  for (const row of g.cells ?? []) {
    for (const cell of row ?? []) {
      const n = (cell?.displayLines ?? []).length;
      if (n > maxLines) maxLines = n;
      const r = (cell?.rawText ?? '').length;
      if (r > maxRaw) maxRaw = r;
    }
  }
  console.log('max displayLines per cell', maxLines, 'max rawText len', maxRaw);
  const sample = g.cells?.[2]?.[1];
  console.log('sample cell keys', sample && Object.keys(sample));
  console.log('sample displayLines count', sample?.displayLines?.length);
}

main().finally(() => prisma.$disconnect());
