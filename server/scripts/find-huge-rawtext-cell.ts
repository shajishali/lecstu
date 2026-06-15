import prisma from '../src/config/database';
import type { TimetableGridSnapshot } from '../src/types/timetableGrid';

async function main() {
  const snap = await prisma.timetableTableSnapshot.findFirst({
    where: { groupName: 'CT-Y3-CTNT' },
    select: { gridData: true },
  });
  const g = snap?.gridData as TimetableGridSnapshot;
  if (!g) return;
  for (let ti = 0; ti < (g.cells?.length ?? 0); ti++) {
    for (let di = 0; di < (g.cells?.[ti]?.length ?? 0); di++) {
      const c = g.cells[ti][di];
      const len = (c?.rawText ?? '').length;
      if (len > 10000) {
        const dl = (c?.displayLines ?? []).join('\n').length;
        console.log(
          'huge at',
          ti,
          di,
          'raw',
          len,
          'displayJoin',
          dl,
          'first line len',
          (c?.displayLines?.[0] ?? '').length,
        );
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
