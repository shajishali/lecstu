/**
 * Set timetableCode from lecturer names: first letter of first + last name (LK, NP, SP).
 * Run: npx tsx scripts/sync-lecturer-codes-from-names.ts
 */
import prisma from '../src/config/database';
import { deriveTimetableCodeFromName } from '../src/services/lecturerInitialsMatch';
import { UNASSIGNED_LECTURER_EMAIL } from '../src/services/conflictDetector';

async function main() {
  const lecturers = await prisma.user.findMany({
    where: {
      role: 'LECTURER',
      isActive: true,
      NOT: { email: UNASSIGNED_LECTURER_EMAIL },
    },
    select: { id: true, firstName: true, lastName: true, email: true, timetableCode: true },
  });

  let updated = 0;
  for (const lec of lecturers) {
    const code = deriveTimetableCodeFromName(lec.firstName, lec.lastName);
    if (!code) continue;
    if (lec.timetableCode?.trim().toUpperCase() === code) continue;
    await prisma.user.update({
      where: { id: lec.id },
      data: { timetableCode: code },
    });
    console.log(`  ${lec.firstName} ${lec.lastName} → ${code} (${lec.email})`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} of ${lecturers.length} lecturer(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
