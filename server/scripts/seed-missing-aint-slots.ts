/**
 * One-shot script: inserts the 4 timetable slots that the old parser dropped
 * for CS-Y3-AINT because their Excel cells had shared batch labels.
 *
 * Run: npx tsx scripts/seed-missing-aint-slots.ts
 */

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1234@localhost:5432/lecstu?schema=public',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GROUP_ID    = 'd44619de-380d-48cb-adee-a78d92938cfe'; // CS-Y3-AINT
const LECTURER_ID = '68424b74-ba0e-4138-8bd5-da5c6b5947d8'; // Unassigned (Timetable Import)
const HALL_ID     = 'fa70ec7c-32b6-479c-9bf3-a816f787d10d'; // AB-LCH-05-2
const DEPT_ID     = '797a9be5-75fa-4a16-8c6d-bb30f82e0b85'; // Computer Science

// Period (same as the already-imported slots)
const PERIOD = { year: 2026, month: 1, week: 1, semester: 2 };

// Courses to create + their slot details (approximate real-timetable times)
const MISSING = [
  {
    courseCode: 'CSCI-32073',
    courseName: 'CSCI 32073',
    dayOfWeek:  'WEDNESDAY',
    startTime:  '08:00',
    endTime:    '09:55',
  },
  {
    courseCode: 'AINT-32012',
    courseName: 'AINT 32012',
    dayOfWeek:  'THURSDAY',
    startTime:  '08:00',
    endTime:    '09:55',
  },
  {
    courseCode: 'AINT-32022',
    courseName: 'AINT 32022',
    dayOfWeek:  'THURSDAY',
    startTime:  '10:00',
    endTime:    '11:55',
  },
  {
    courseCode: 'DSCI-32012',
    courseName: 'DSCI 32012',
    dayOfWeek:  'FRIDAY',
    startTime:  '14:00',
    endTime:    '16:55',
  },
];

async function main() {
  console.log('Seeding 4 missing CS-Y3-AINT timetable slots...\n');

  for (const m of MISSING) {
    // Upsert the course
    const course = await prisma.course.upsert({
      where:  { code: m.courseCode },
      update: { name: m.courseName },
      create: { code: m.courseCode, name: m.courseName, departmentId: DEPT_ID },
    });
    console.log(`  Course: ${course.code} (${course.id})`);

    // Check if a slot already exists for this period + course + group
    const existing = await prisma.masterTimetable.findFirst({
      where: {
        courseId:  course.id,
        groupId:   GROUP_ID,
        year:      PERIOD.year,
        month:     PERIOD.month,
        week:      PERIOD.week,
        dayOfWeek: m.dayOfWeek as any,
      },
    });

    if (existing) {
      console.log(`  ↳ slot already exists — skipped`);
      continue;
    }

    const slot = await prisma.masterTimetable.create({
      data: {
        courseId:   course.id,
        lecturerId: LECTURER_ID,
        hallId:     HALL_ID,
        groupId:    GROUP_ID,
        dayOfWeek:  m.dayOfWeek as any,
        startTime:  m.startTime,
        endTime:    m.endTime,
        semester:   PERIOD.semester,
        year:       PERIOD.year,
        month:      PERIOD.month,
        week:       PERIOD.week,
        isActive:   true,
      },
    });
    console.log(`  ↳ created slot ${slot.id} on ${m.dayOfWeek} ${m.startTime}-${m.endTime}`);
  }

  console.log('\nDone.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
