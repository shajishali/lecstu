/**
 * Deletes ALL application data (users, registrations, timetables, map, etc.).
 * Schema/migrations are unchanged. Run: npm run db:purge
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log('Purging all LECSTU data...\n');

  const deleted = {
    auditLog: await prisma.auditLog.deleteMany(),
    notification: await prisma.notification.deleteMany(),
    appointment: await prisma.appointment.deleteMany(),
    hallBooking: await prisma.hallBooking.deleteMany(),
    mapMarker: await prisma.mapMarker.deleteMany(),
    floorPlan: await prisma.floorPlan.deleteMany(),
    mapBuilding: await prisma.mapBuilding.deleteMany(),
    lecturerScheduleSlots: await prisma.lecturerScheduleSlot.deleteMany(),
    masterTimetable: await prisma.masterTimetable.deleteMany(),
    studentGroupMember: await prisma.studentGroupMember.deleteMany(),
    studentGroup: await prisma.studentGroup.deleteMany(),
    pathway: await prisma.pathway.deleteMany(),
    program: await prisma.program.deleteMany(),
    lecturerOffice: await prisma.lecturerOffice.deleteMany(),
    lectureHall: await prisma.lectureHall.deleteMany(),
    course: await prisma.course.deleteMany(),
    user: await prisma.user.deleteMany(),
    department: await prisma.department.deleteMany(),
    faculty: await prisma.faculty.deleteMany(),
  };

  console.log('Deleted rows:');
  for (const [table, result] of Object.entries(deleted)) {
    console.log(`  ${table}: ${result.count}`);
  }

  const usersLeft = await prisma.user.count();
  console.log(`\nUsers remaining: ${usersLeft}`);
  console.log(usersLeft === 0 ? '✅ Database is empty. Register new accounts at /register.' : '⚠️ Some users remain.');
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
