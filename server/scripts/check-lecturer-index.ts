import prisma from '../src/config/database';
import { getLecturerDisplayIndex } from '../src/services/lecturerDisplayService';
import { UNASSIGNED_LECTURER_EMAIL } from '../src/services/conflictDetector';

async function main() {
  const index = await getLecturerDisplayIndex(true);
  console.log('index codes:', [...index.nameByCode.keys()].sort().join(', '));

  const withCode = await prisma.masterTimetable.findMany({
    where: { isActive: true, lecturerInitials: { not: null } },
    take: 5,
    select: { lecturerInitials: true, lecturer: { select: { email: true } } },
  });
  for (const s of withCode) {
    const key = s.lecturerInitials!.toLowerCase();
    console.log(
      s.lecturerInitials,
      '->',
      index.nameByCode.get(key) ?? '(no name)',
      'assigned:',
      s.lecturer.email !== UNASSIGNED_LECTURER_EMAIL,
    );
  }
}

main().finally(() => prisma.$disconnect());
