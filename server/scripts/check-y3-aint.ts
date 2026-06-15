import prisma from '../src/config/database';

async function main() {
  const g = await prisma.studentGroup.findFirst({
    where: { name: { equals: 'CS-Y3-AINT', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!g) {
    console.log('No CS-Y3-AINT group');
    return;
  }
  const n = await prisma.masterTimetable.count({
    where: { groupId: g.id, isActive: true },
  });
  const sample = await prisma.masterTimetable.findMany({
    where: { groupId: g.id, isActive: true },
    take: 8,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    select: {
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      lecturerInitials: true,
      lecturer: { select: { firstName: true, lastName: true, email: true } },
      course: { select: { code: true } },
    },
  });
  console.log('CS-Y3-AINT slots:', n);
  console.log(JSON.stringify(sample, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
