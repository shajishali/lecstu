/**
 * Upsert FCT lecturers from prisma/fct-lecturer-roster.ts (does not purge other data).
 * npm run db:seed-lecturers
 */
import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../src/generated/prisma/client';
import bcrypt from 'bcrypt';
import { FCT_LECTURER_ROSTER } from '../prisma/fct-lecturer-roster';
import { deriveTimetableCodeFromName } from '../src/services/lecturerInitialsMatch';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'lecstu123';

async function main() {
  const password = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let created = 0;
  let updated = 0;

  const obsoleteEmails = [
    'laalitha.liyanage@kln.ac.lk',
    'pradeep.samarasekere@kln.ac.lk',
    'shakila.pathirana@kln.ac.lk',
    'shakya.bandara@kln.ac.lk',
    'amila.fernando@kln.ac.lk',
    // DCSE / DSE guessed emails replaced by official @kln.ac.lk roster
    'nimal.dias@kln.ac.lk',
    'dhammika.weerasinghe@kln.ac.lk',
    'rajitha.tennekoon@kln.ac.lk',
    'rasika.rajapaksha@kln.ac.lk',
    'madusha.chandrasena@kln.ac.lk',
    'navodi.hakmanage@kln.ac.lk',
    'sidath.liyanage@kln.ac.lk',
    'carmel.wijegunasekara@kln.ac.lk',
    'muditha.tissera@kln.ac.lk',
    'sp.kasthuri@kln.ac.lk',
  ];
  await prisma.user.updateMany({
    where: { email: { in: obsoleteEmails }, role: 'LECTURER' },
    data: { isActive: false, timetableCode: null },
  });

  for (const entry of FCT_LECTURER_ROSTER) {
    const dept = await prisma.department.findFirst({
      where: { code: entry.departmentCode },
      select: { id: true },
    });
    if (!dept) {
      console.warn(`  Skip ${entry.email}: department ${entry.departmentCode} not found (run db:seed first)`);
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { email: entry.email } });

    let timetableCode =
      entry.timetableCode?.trim().toUpperCase() ||
      deriveTimetableCodeFromName(entry.firstName, entry.lastName) ||
      null;

    if (timetableCode) {
      const taken = await prisma.user.findFirst({
        where: {
          timetableCode,
          isActive: true,
          ...(existing ? { NOT: { id: existing.id } } : {}),
        },
        select: { id: true, email: true },
      });
      if (taken) {
        console.warn(
          `  ⚠ Code ${timetableCode} already used by ${taken.email}; leaving timetableCode unset for ${entry.email}`,
        );
        timetableCode = null;
      }
    }

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: entry.firstName,
            lastName: entry.lastName,
            designation: entry.designation ?? existing.designation,
            phone: entry.phone ?? existing.phone,
            departmentId: dept.id,
            timetableCode,
            role: UserRole.LECTURER,
            isActive: true,
          },
        })
      : await prisma.user.create({
          data: {
            email: entry.email,
            password,
            role: UserRole.LECTURER,
            firstName: entry.firstName,
            lastName: entry.lastName,
            designation: entry.designation,
            phone: entry.phone,
            departmentId: dept.id,
            timetableCode,
            isActive: true,
          },
        });

    if (existing) updated++;
    else created++;

    if (entry.office) {
      await prisma.lecturerOffice.upsert({
        where: { lecturerId: user.id },
        create: {
          lecturerId: user.id,
          roomNumber: entry.office.roomNumber,
          building: entry.office.building,
          floor: entry.office.floor ?? 0,
        },
        update: {
          roomNumber: entry.office.roomNumber,
          building: entry.office.building,
          floor: entry.office.floor ?? 0,
        },
      });
    }

    const deptLabel = entry.fctDepartment ?? entry.departmentCode;
    console.log(`  ✓ [${deptLabel}] ${entry.firstName} ${entry.lastName} (${timetableCode ?? '—'}) — ${entry.email}`);
  }

  console.log(`  Cleared ${obsoleteEmails.length} obsolete lecturer placeholder email(s)`);

  // Ensure timetable codes on active accounts (skip if code already taken)
  const usedCodes = new Set(
    (
      await prisma.user.findMany({
        where: { role: 'LECTURER', isActive: true, timetableCode: { not: null } },
        select: { email: true, timetableCode: true },
      })
    )
      .map((u) => u.timetableCode!.toUpperCase())
      .filter(Boolean),
  );

  for (const entry of FCT_LECTURER_ROSTER) {
    const code =
      entry.timetableCode?.trim().toUpperCase() ||
      deriveTimetableCodeFromName(entry.firstName, entry.lastName) ||
      null;
    if (!code) continue;
    if (usedCodes.has(code)) {
      const owner = await prisma.user.findFirst({
        where: { role: 'LECTURER', isActive: true, timetableCode: code },
        select: { email: true },
      });
      if (owner?.email.toLowerCase() !== entry.email.toLowerCase()) continue;
    }
    await prisma.user.updateMany({
      where: { email: entry.email, role: 'LECTURER', isActive: true },
      data: { timetableCode: code },
    });
    usedCodes.add(code);
  }

  console.log(`\nDone: ${created} created, ${updated} updated. Default password for new accounts: ${DEFAULT_PASSWORD}`);
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
