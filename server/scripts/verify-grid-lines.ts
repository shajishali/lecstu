import prisma from '../src/config/database';
import type { TimetableGridSnapshot } from '../src/types/timetableGrid';

async function main() {
  let incomplete = 0;
  let total = 0;
  const snaps = await prisma.timetableTableSnapshot.findMany({
    select: { groupName: true, gridData: true },
  });
  for (const snap of snaps) {
    const g = snap.gridData as TimetableGridSnapshot;
    for (let ti = 0; ti < g.cells.length; ti++) {
      for (let di = 0; di < g.dayColumns.length; di++) {
        const c = g.cells[ti][di];
        if (!c || c.isEmpty || c.mergeContinue || c.isBreak) continue;
        total++;
        const lines = c.displayLines ?? [];
        const hasHall = lines.some((l) => /\b[A-Z]{2,4}-/.test(l) || l.toUpperCase() === 'TBD');
        const hasLect = lines.some((l, i) => i > 0 && l !== 'TBD');
        if (!hasHall || lines.length < 2) {
          incomplete++;
          if (incomplete <= 5) {
            console.log(`${snap.groupName} incomplete:`, lines.join(' | '));
          }
        }
      }
    }
  }
  console.log(`Grid class cells: ${total}, incomplete display: ${incomplete}`);
}

main().finally(() => prisma.$disconnect());
