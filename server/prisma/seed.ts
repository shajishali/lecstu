import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';
import { FACULTY_MAP_BUILDINGS } from '../src/constants/facultyBuildings';
import {
  FACULTY,
  PROGRAMS,
  STUDY_YEARS,
  YEARS_WITHOUT_PATHWAYS,
  YEARS_WITH_PATHWAYS,
  LECTURE_HALL_NAMES,
  buildGroupName,
  parseLectureHall,
  studyYearToOrdinal,
  type StudyYear,
} from './fct-faculty-config';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function purgeAll() {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.mapMarker.deleteMany();
  await prisma.floorPlan.deleteMany();
  await prisma.mapBuilding.deleteMany();
  await prisma.lecturerScheduleSlot.deleteMany();
  await prisma.masterTimetable.deleteMany();
  await prisma.hallBooking.deleteMany();
  await prisma.studentGroupMember.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.pathway.deleteMany();
  await prisma.program.deleteMany();
  await prisma.lecturerOffice.deleteMany();
  await prisma.lectureHall.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.faculty.deleteMany();
}

async function main() {
  console.log('🌱 FCT faculty structure seed...\n');

  await purgeAll();
  console.log('  Cleaned existing data');

  const faculty = await prisma.faculty.create({
    data: {
      name: FACULTY.name,
      code: FACULTY.code,
      description: FACULTY.description,
    },
  });
  console.log(`  ✓ Faculty: ${FACULTY.code}`);

  const departmentByCode = new Map<string, string>();
  for (const prog of PROGRAMS) {
    const dept = await prisma.department.create({
      data: {
        name: prog.departmentName,
        code: prog.departmentCode,
        facultyId: faculty.id,
      },
    });
    departmentByCode.set(prog.code, dept.id);
  }
  console.log(`  ✓ ${PROGRAMS.length} departments (one per degree program)`);

  const pathwayByProgramAndCode = new Map<string, string>();

  for (const prog of PROGRAMS) {
    const created = await prisma.program.create({
      data: {
        name: prog.name,
        code: prog.code,
        description: prog.description,
        facultyId: faculty.id,
        pathways: {
          create: prog.pathways.map((p) => ({
            name: p.name,
            code: `${prog.code}-${p.code}`,
          })),
        },
      },
      include: { pathways: true },
    });

    for (const pw of created.pathways) {
      const suffix = pw.code.replace(`${prog.code}-`, '');
      pathwayByProgramAndCode.set(`${prog.code}:${suffix}`, pw.id);
    }
  }
  console.log('  ✓ Programs and pathways (pathways apply from Y3)');

  let groupCount = 0;

  for (const prog of PROGRAMS) {
    const departmentId = departmentByCode.get(prog.code)!;

    for (const year of prog.years) {
      if (YEARS_WITHOUT_PATHWAYS.includes(year as StudyYear)) {
        const groupName = buildGroupName(prog.code, year as StudyYear);
        await prisma.studentGroup.create({
          data: {
            name: groupName,
            batchYear: studyYearToOrdinal[year as StudyYear],
            batchLabel: year,
            departmentId,
            pathwayId: null,
          },
        });
        groupCount++;
        continue;
      }

      if (YEARS_WITH_PATHWAYS.includes(year as StudyYear) && prog.pathways.length > 0) {
        for (const pw of prog.pathways) {
          const groupName = buildGroupName(prog.code, year as StudyYear, pw.code);
          const pathwayId = pathwayByProgramAndCode.get(`${prog.code}:${pw.code}`);
          await prisma.studentGroup.create({
            data: {
              name: groupName,
              batchYear: studyYearToOrdinal[year as StudyYear],
              batchLabel: year,
              departmentId,
              pathwayId: pathwayId ?? null,
            },
          });
          groupCount++;
        }
      }
    }
  }
  console.log(`  ✓ ${groupCount} student groups (Y1/Y2 = no pathway; Y3/Y4 = per pathway)`);

  for (const b of FACULTY_MAP_BUILDINGS) {
    await prisma.mapBuilding.create({
      data: {
        name: b.name,
        code: b.code,
        latitude: b.latitude,
        longitude: b.longitude,
        floors: b.floors,
        metadata: { description: b.description },
      },
    });
  }
  console.log(`  ✓ Map buildings (${FACULTY_MAP_BUILDINGS.map((b) => b.code).join(', ')})`);

  const hallData = LECTURE_HALL_NAMES.map((name) => {
    const parsed = parseLectureHall(name);
    return {
      name: parsed.name,
      building: parsed.building,
      floor: parsed.floor,
      capacity: parsed.capacity,
      equipment: parsed.equipment,
      isActive: true,
    };
  });

  await prisma.lectureHall.createMany({ data: hallData });
  console.log(`  ✓ ${hallData.length} lecture halls`);

  const defaultPassword = await hashPassword('lecstu123');
  const csDeptId = departmentByCode.get('CS')!;

  await prisma.user.create({
    data: {
      email: 'unassigned@lecstu.edu',
      password: defaultPassword,
      role: UserRole.LECTURER,
      firstName: 'Unassigned',
      lastName: '(Timetable Import)',
      departmentId: csDeptId,
    },
  });
  console.log('  ✓ Unassigned lecturer (for PDF timetable import only)');

  console.log('\n✅ FCT structure ready.');
  console.log('   • Register your own admin / lecturer / student at /register');
  console.log('   • Group names for timetables: CS-Y1, CS-Y3-AINT, CT-Y2, BS-Y1, …');
  console.log('   • Upload timetable PDFs via Admin → Timetable → Import\n');

  console.log('── Programs ──');
  for (const p of PROGRAMS) {
    const yrs = p.years.join(', ');
    const pws = p.pathways.length ? p.pathways.map((x) => x.code).join(', ') : '(none)';
    console.log(`   ${p.code}: ${yrs} | pathways (Y3–Y4): ${pws}`);
  }
  console.log(`── Study years: ${STUDY_YEARS.join(', ')} ──\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
