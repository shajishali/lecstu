/**
 * Remove test accounts before production hosting.
 * Only deletes the two whitelisted emails — all other users/data are untouched.
 *
 * Usage (from server/):
 *   npx tsx scripts/remove-test-hosting-accounts.ts
 *   npx tsx scripts/remove-test-hosting-accounts.ts --dry-run
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const TEST_EMAILS = ['lecturer@stu.kln.ac.lk', 'student@stu.kln.ac.lk'] as const;
const dryRun = process.argv.includes('--dry-run');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function relatedCounts(userId: string) {
  const [appointmentsAsStudent, appointmentsAsLecturer, timetableRows, notifications, navSessions, groupMemberships, office, scheduleSlots] =
    await Promise.all([
      prisma.appointment.count({ where: { studentId: userId } }),
      prisma.appointment.count({ where: { lecturerId: userId } }),
      prisma.masterTimetable.count({ where: { lecturerId: userId } }),
      prisma.notification.count({ where: { userId } }),
      prisma.navigationSession.count({ where: { userId } }),
      prisma.studentGroupMember.count({ where: { studentId: userId } }),
      prisma.lecturerOffice.findUnique({ where: { lecturerId: userId } }),
      prisma.lecturerScheduleSlot.count({ where: { lecturerId: userId } }),
    ]);
  return {
    appointmentsAsStudent,
    appointmentsAsLecturer,
    timetableRows,
    notifications,
    navSessions,
    groupMemberships,
    lecturerOffice: office ? 1 : 0,
    scheduleSlots,
  };
}

async function main() {
  console.log(dryRun ? 'DRY RUN — no deletes\n' : 'Removing test hosting accounts…\n');

  let deleted = 0;
  for (const email of TEST_EMAILS) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) {
      console.log(`Skip (not found): ${email}`);
      continue;
    }

    const related = await relatedCounts(user.id);
    console.log(`Found: ${user.email} (${user.role}) — ${user.firstName} ${user.lastName}`);
    console.log('  Related rows (removed with user via cascade):', related);

    if (related.timetableRows > 0) {
      console.warn(
        `  Warning: ${related.timetableRows} timetable row(s) linked to this lecturer will also be deleted.`
      );
    }

    if (!dryRun) {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`  Deleted: ${user.email}`);
      deleted++;
    }
  }

  const totalUsers = await prisma.user.count();
  console.log(`\nDone. Deleted ${deleted} test account(s). Remaining users: ${totalUsers}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
