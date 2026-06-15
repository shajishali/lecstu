import prisma from '../src/config/database';

async function main() {
  const slots = await prisma.masterTimetable.findMany({
    where: { isActive: true },
    include: {
      course: { select: { name: true, code: true } },
      hall: { select: { name: true } },
      group: { select: { name: true } },
    },
  });

  let noLect = 0;
  let noHall = 0;
  let tbdHall = 0;
  const byGroup = new Map<string, { total: number; noLect: number; tbdHall: number }>();

  for (const s of slots) {
    const g = s.group.name;
    if (!byGroup.has(g)) byGroup.set(g, { total: 0, noLect: 0, tbdHall: 0 });
    const b = byGroup.get(g)!;
    b.total++;
    if (!s.lecturerInitials?.trim()) {
      noLect++;
      b.noLect++;
    }
    if (!s.hall?.name?.trim() || s.hall.name.toUpperCase() === 'TBD') {
      tbdHall++;
      b.tbdHall++;
      if (!s.hall?.name) noHall++;
    }
  }

  console.log(`Total active slots: ${slots.length}`);
  console.log(`Missing lecturer: ${noLect}`);
  console.log(`TBD/missing hall: ${tbdHall}`);
  console.log('\nGroups with gaps:');
  for (const [g, b] of [...byGroup.entries()].sort((a, c) => c.noLect + c.tbdHall - (a.noLect + a.tbdHall))) {
    if (b.noLect > 0 || b.tbdHall > 0) {
      console.log(`  ${g}: ${b.total} slots, ${b.noLect} no lect, ${b.tbdHall} TBD hall`);
    }
  }
}

main().finally(() => prisma.$disconnect());
