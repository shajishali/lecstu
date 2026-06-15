/**
 * Assign a student to a class group by email and group name.
 * Usage: npx tsx scripts/assign-student-group.ts student@kln.ac.lk CS-Y3-AINT
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { assignStudentToGroup } from '../src/services/studentEnrollmentService';
import { invalidateUser as invalidateTimetableCacheForUser } from '../src/services/timetableCache';

const email = process.argv[2];
const groupName = process.argv[3];

if (!email || !groupName) {
  console.error('Usage: npx tsx scripts/assign-student-group.ts <email> <group-name>');
  console.error('Example: npx tsx scripts/assign-student-group.ts student@kln.ac.lk CS-Y3-AINT');
  process.exit(1);
}

const parts = groupName.split('-');
const programCode = parts[0];
const studyYear = parts[1];
const pathwayCode = parts.length >= 3 ? parts.slice(2).join('-') : undefined;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error('User not found:', email);
    process.exit(1);
  }
  if (user.role !== 'STUDENT') {
    console.error('User is not a student:', email);
    process.exit(1);
  }

  const enrollment = await assignStudentToGroup(
    user.id,
    programCode,
    studyYear as 'Y1' | 'Y2' | 'Y3' | 'Y4',
    pathwayCode,
  );
  invalidateTimetableCacheForUser(user.id);

  const slotCount = await prisma.masterTimetable.count({
    where: { groupId: enrollment.groupId, isActive: true },
  });

  console.log(`Assigned ${user.email} → ${enrollment.groupName}`);
  console.log(`Active timetable slots for this group: ${slotCount}`);
  if (slotCount === 0) {
    console.log('No timetable imported for this group yet. Import via Admin → Timetable → Import.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
