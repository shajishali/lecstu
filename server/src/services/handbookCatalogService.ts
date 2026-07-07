import prisma from '../config/database';
import { CourseRequirementType } from '../generated/prisma/client';
import type { HandbookCatalogEntry, HandbookCatalogFile, HandbookCatalogLecturer } from '../types/handbookCatalog';
import { PROGRAMS } from '../config/fct-faculty-config';
import { deriveTimetableCodeFromName } from './lecturerInitialsMatch';

const FACULTY_COURSE_PREFIXES =
  'GTEC|CTEC|CSCI|CTNT|SWST|GANI|ETEC|ETIA|ETMP|ETST|AINT|DSCI|CSEC|SPCS|SCOM|ENPR|DELT|LNPR|GCPR|MGMT';

const COURSE_CODE_RE = new RegExp(
  `\\b(${FACULTY_COURSE_PREFIXES})[\\s-]?(\\d{4,5})(?:\\s+([A-Za-z][A-Za-z0-9_]*))?\\b`,
  'i',
);

const STRICT_COURSE_CODE_RE = new RegExp(
  `^(${FACULTY_COURSE_PREFIXES})-(\\d{4,5})(?:-([A-Za-z]))?$`,
  'i',
);

export function normalizeCourseCode(raw: string): string {
  const t = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (/[+]/.test(t)) return t.replace(/\s+/g, '-');
  const m = t.match(COURSE_CODE_RE);
  if (!m) return t.replace(/\s+/g, '-');
  const prefix = m[1].toUpperCase();
  const num = m[2];
  const suffix = m[3] ? `-${m[3].toUpperCase()}` : '';
  return `${prefix}-${num}${suffix}`;
}

/** Strip FET suffixes (ONLINE, T, O, VR_LAB, merged codes) to the handbook code e.g. CTNT-44073. */
export function baseCourseCode(raw: string): string {
  const normalized = normalizeCourseCode(raw);
  const m = normalized.match(/^([A-Z]+)-(\d{4,5})/);
  return m ? `${m[1]}-${m[2]}` : normalized;
}

export function isValidFacultyCourseCode(raw: string): boolean {
  const t = raw.trim();
  if (!t || /[+]/.test(t)) return false;
  const normalized = normalizeCourseCode(t);
  return STRICT_COURSE_CODE_RE.test(normalized);
}

/** Reject lecturer initials / names stored as course titles during import. */
export function looksLikePersonName(text: string): boolean {
  const t = text.trim();
  if (!t || /\d/.test(t)) return false;
  if (isValidFacultyCourseCode(t)) return false;
  if (/^VL_/i.test(t)) return true;
  if (/^[A-Z]{1,4}(_[A-Za-z]+)?$/i.test(t) && t.length <= 12) return true;
  if (/^(Dr|Prof|Mr|Ms|Mrs)\b/i.test(t)) return true;
  if (/^[A-Z][A-Z.'-]{2,28}$/.test(t) && !STRICT_COURSE_CODE_RE.test(normalizeCourseCode(t))) {
    return true;
  }
  return false;
}

export function resolveCourseDisplayTitle(
  code: string,
  name?: string | null,
  handbookTitle?: string | null,
): string {
  const handbook = handbookTitle?.trim();
  if (handbook && !looksLikePersonName(handbook) && handbook.toUpperCase() !== code.toUpperCase()) {
    return handbook;
  }
  const n = (name || '').trim();
  if (n && !looksLikePersonName(n) && !isValidFacultyCourseCode(n)) {
    if (!/^[A-Z]{2,6}(\s+\d{4,5})/i.test(n)) return n;
  }
  return normalizeCourseCode(code).replace(/-/g, ' ');
}

export function inferProgramFromCoursePrefix(code: string): string {
  const prefix = code.split('-')[0]?.toUpperCase() ?? '';
  const map: Record<string, string> = {
    CS: 'CS',
    CSCI: 'CS',
    CT: 'CT',
    CTEC: 'CT',
    SWST: 'CT',
    GANI: 'CT',
    CTNT: 'CT',
    ET: 'ET',
    ETEC: 'ET',
    ETIA: 'ET',
    ETMP: 'ET',
    ETST: 'ET',
    GCPR: 'ET',
    LNPR: 'ET',
    BS: 'BS',
    AINT: 'CS',
    DSCI: 'CS',
    CSEC: 'CS',
    SPCS: 'CS',
    SCOM: 'CS',
    MGMT: 'CS',
    DELT: 'CS',
  };
  return map[prefix] ?? 'CS';
}

async function resolveLecturerId(entry: HandbookCatalogLecturer): Promise<{
  lecturerId: string | null;
  lecturerName: string | null;
}> {
  const name = entry.name?.trim();
  if (!name) return { lecturerId: null, lecturerName: null };

  const email = entry.email?.trim().toLowerCase();
  if (email) {
    const u = await prisma.user.findFirst({
      where: { email, role: 'LECTURER', isActive: true },
      select: { id: true },
    });
    return { lecturerId: u?.id ?? null, lecturerName: u ? null : name };
  }

  const rosterMatch = entry.timetableCode
    ? await prisma.user.findFirst({
        where: {
          role: 'LECTURER',
          isActive: true,
          timetableCode: entry.timetableCode.toUpperCase(),
        },
        select: { id: true },
      })
    : null;
  if (rosterMatch) {
    return { lecturerId: rosterMatch.id, lecturerName: null };
  }

  const parts = name.replace(/\./g, ' ').trim().split(/\s+/);
  if (parts.length >= 2) {
    const first = parts[0];
    const last = parts[parts.length - 1];
    const u = await prisma.user.findFirst({
      where: {
        role: 'LECTURER',
        isActive: true,
        firstName: { equals: first, mode: 'insensitive' },
        lastName: { equals: last, mode: 'insensitive' },
      },
      select: { id: true },
    });
    return { lecturerId: u?.id ?? null, lecturerName: u ? null : name };
  }

  return { lecturerId: null, lecturerName: name };
}

async function resolveDepartmentId(programCode: string): Promise<string> {
  const dept = await prisma.department.findFirst({
    where: { code: programCode },
    select: { id: true },
  });
  if (dept) return dept.id;
  const fallback = await prisma.department.findFirst({ select: { id: true } });
  if (!fallback) throw new Error('No departments in database — run db:seed first');
  return fallback.id;
}

export async function upsertHandbookCatalogEntry(entry: HandbookCatalogEntry): Promise<void> {
  if (!isValidFacultyCourseCode(entry.code)) return;
  const code = normalizeCourseCode(entry.code);
  const programCode = entry.programCode.toUpperCase();
  const departmentId = await resolveDepartmentId(programCode);

  const course = await prisma.course.upsert({
    where: { code },
    create: {
      code,
      name: entry.title.trim(),
      credits: entry.credits ?? 3,
      semester: entry.semester ?? null,
      description: entry.title,
      departmentId,
    },
    update: {
      name: entry.title.trim(),
      credits: entry.credits ?? undefined,
      semester: entry.semester ?? undefined,
      description: entry.title,
    },
  });

  const pathwayKey = entry.pathwayCode?.trim().toUpperCase() ?? '';
  const requirementType =
    entry.requirementType === 'OPTIONAL'
      ? CourseRequirementType.OPTIONAL
      : CourseRequirementType.COMPULSORY;

  const programCourse = await prisma.programCourse.upsert({
    where: {
      programCode_studyYear_pathwayCode_courseId: {
        programCode,
        studyYear: entry.studyYear,
        pathwayCode: pathwayKey,
        courseId: course.id,
      },
    },
    create: {
      programCode,
      studyYear: entry.studyYear,
      pathwayCode: pathwayKey,
      requirementType,
      semester: entry.semester ?? null,
      credits: entry.credits ?? null,
      handbookTitle: entry.title,
      courseId: course.id,
    },
    update: {
      requirementType,
      semester: entry.semester ?? null,
      credits: entry.credits ?? null,
      handbookTitle: entry.title,
    },
  });

  await prisma.programCourseLecturer.deleteMany({ where: { programCourseId: programCourse.id } });

  for (const lec of entry.lecturers ?? []) {
    const { lecturerId, lecturerName } = await resolveLecturerId(lec);
    await prisma.programCourseLecturer.create({
      data: {
        programCourseId: programCourse.id,
        lecturerId,
        lecturerName,
        isPrimary: true,
      },
    });
  }
}

export async function importHandbookCatalogFile(file: HandbookCatalogFile): Promise<{
  imported: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let imported = 0;
  for (const entry of file.entries) {
    try {
      await upsertHandbookCatalogEntry(entry);
      imported++;
    } catch (err) {
      errors.push(`${entry.code}: ${(err as Error).message}`);
    }
  }
  return { imported, errors };
}

export async function getCatalogForEnrollment(
  programCode: string,
  studyYear: number,
  pathwayCode?: string | null,
) {
  const pathway = pathwayCode?.trim().toUpperCase() ?? '';
  return prisma.programCourse.findMany({
    where: {
      programCode: programCode.toUpperCase(),
      studyYear,
      pathwayCode: pathway,
    },
    include: {
      course: { select: { id: true, code: true, name: true, credits: true, semester: true } },
      lecturers: {
        include: {
          lecturer: {
            select: { id: true, firstName: true, lastName: true, timetableCode: true, email: true },
          },
        },
      },
    },
    orderBy: [{ requirementType: 'asc' }, { course: { code: 'asc' } }],
  });
}

/** All pathway rows for a program year (used for Y3/Y4 elective pools). */
export async function getCatalogForProgramYear(programCode: string, studyYear: number) {
  return prisma.programCourse.findMany({
    where: {
      programCode: programCode.toUpperCase(),
      studyYear,
    },
    include: {
      course: { select: { id: true, code: true, name: true, credits: true, semester: true } },
    },
    orderBy: [{ pathwayCode: 'asc' }, { requirementType: 'asc' }, { course: { code: 'asc' } }],
  });
}

export async function syncCatalogFromTimetable(): Promise<{ synced: number }> {
  const entries = await prisma.masterTimetable.findMany({
    where: { isActive: true },
    select: {
      course: { select: { id: true, code: true, name: true } },
      group: { select: { name: true } },
      lecturer: { select: { id: true, firstName: true, lastName: true, timetableCode: true, email: true } },
    },
  });

  const byKey = new Map<string, HandbookCatalogEntry>();

  for (const row of entries) {
    const groupMatch = row.group.name.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
    if (!groupMatch) continue;
    const programCode = groupMatch[1].toUpperCase();
    const studyYear = Number(groupMatch[2]);
    const suffix = groupMatch[3]?.toUpperCase();
    const pathwayKey =
      suffix && PROGRAMS.find((p) => p.code === programCode)?.pathways.some((pw) => pw.code === suffix)
        ? suffix
        : '';

    const rawCode = row.course.code;
    if (!isValidFacultyCourseCode(rawCode)) continue;
    if (looksLikePersonName(row.course.name)) continue;

    const code = normalizeCourseCode(rawCode);
    const key = `${programCode}|${studyYear}|${pathwayKey}|${code}`;
    if (byKey.has(key)) continue;

    byKey.set(key, {
      code,
      title: row.course.name,
      programCode,
      studyYear,
      pathwayCode: pathwayKey,
      requirementType: 'COMPULSORY',
      lecturers: [
        {
          name: `${row.lecturer.firstName} ${row.lecturer.lastName}`.trim(),
          email: row.lecturer.email,
          timetableCode: row.lecturer.timetableCode ?? deriveTimetableCodeFromName(row.lecturer.firstName, row.lecturer.lastName) ?? undefined,
        },
      ],
    });
  }

  let synced = 0;
  for (const entry of byKey.values()) {
    await upsertHandbookCatalogEntry(entry);
    synced++;
  }
  return { synced };
}

export async function enrichAllCourseNamesFromCatalog(): Promise<number> {
  const programCourses = await prisma.programCourse.findMany({
    include: { course: true },
  });
  let updated = 0;
  for (const pc of programCourses) {
    const title = pc.handbookTitle?.trim();
    if (!title || title === pc.course.name) continue;
    await prisma.course.update({
      where: { id: pc.courseId },
      data: { name: title },
    });
    updated++;
  }
  return updated;
}
