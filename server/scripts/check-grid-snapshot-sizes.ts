import prisma from '../src/config/database';

async function main() {
  const snaps = await prisma.timetableTableSnapshot.findMany({
    select: { id: true, groupName: true, gridData: true },
  });
  for (const s of snaps) {
    const bytes = JSON.stringify(s.gridData).length;
    console.log(s.groupName, (bytes / 1024 / 1024).toFixed(2), 'MB');
  }
}

main().finally(() => prisma.$disconnect());
