/**
 * Timetable Import Service
 * Auto-creates missing courses, halls, groups. Uses Unassigned lecturer when lecturer not found.
 * Resolves entities from parsed rows and creates timetable entries.
 */
import type { DayOfWeek } from '../generated/prisma/client';
import prisma from '../config/database';
import { ParsedTimetableRow } from './timetableParserService';
import { detectConflicts, isCommonHall, PLACEHOLDER_HALL_NAME, UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  parseLectureHall,
  studyYearToOrdinal,
  resolveCanonicalGroupName,
  type StudyYear,
} from '../config/fct-faculty-config';
import { findCanonicalGroupId } from './studentGroupResolver';
import { finalizeParsedRows, formatShortCourseDisplay } from './timetableParserService';
import {
  buildLecturerInitialsIndex,
  isFetLecturerCodeToken,
  matchLecturerByInitials,
} from './lecturerInitialsMatch';
import { invalidateLecturerDisplayIndex } from './lecturerDisplayService';

const DEFAULT_DEPARTMENT_CODE = 'CS';
const FCT_PROGRAM_CODES = ['CS', 'ET', 'CT', 'BS', 'BST'] as const;

function timesOverlapImport(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

/** Parse group names like CS-Y3-AINT, CT-Y1, or "Y1 CT Group" from PDFs */
function parseGroupMeta(groupName: string): {
  programCode?: string;
  batchLabel?: string;
  batchYear?: number;
} {
  const trimmed = groupName.trim();
  const direct = trimmed.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
  if (direct) {
    const year = `Y${direct[2]}` as StudyYear;
    return {
      programCode: direct[1].toUpperCase(),
      batchLabel: year,
      batchYear: studyYearToOrdinal[year],
    };
  }
  const fetStyle = trimmed.match(/^Y([1-4])\s+(CS|ET|CT|BS|BST)\b/i);
  if (fetStyle) {
    const year = `Y${fetStyle[1]}` as StudyYear;
    return {
      programCode: fetStyle[2].toUpperCase(),
      batchLabel: year,
      batchYear: studyYearToOrdinal[year],
    };
  }
  return {};
}

export interface ImportResolution {
  courseId: string;
  lecturerId: string;
  hallId: string;
  groupId: string;
  lecturerAssigned: boolean; // true if matched existing, false if using Unassigned
}

export interface ImportStats {
  created: { courses: number; halls: number; groups: number };
  unassignedCount: number;
  imported: number;
}

/** Reset wrong auto-assigned lecturers; keep sheet initials. Re-import recommended after. */
export async function reresolveUnassignedLecturers(): Promise<{
  matched: number;
  stillUnassigned: number;
  total: number;
}> {
  const unassigned = await prisma.user.findFirst({
    where: { email: UNASSIGNED_LECTURER_EMAIL, role: 'LECTURER' },
    select: { id: true },
  });
  if (!unassigned) return { matched: 0, stillUnassigned: 0, total: 0 };

  const wronglyAssigned = await prisma.masterTimetable.updateMany({
    where: {
      isActive: true,
      lecturerId: { not: unassigned.id },
    },
    data: { lecturerId: unassigned.id },
  });

  return {
    matched: 0,
    stillUnassigned: wronglyAssigned.count,
    total: wronglyAssigned.count,
  };
}

export async function getOrCreateUnassignedLecturer(departmentId: string): Promise<string> {
  let lecturer = await prisma.user.findFirst({
    where: { email: UNASSIGNED_LECTURER_EMAIL, role: 'LECTURER' },
    select: { id: true },
  });
  if (!lecturer) {
    const bcrypt = await import('bcrypt');
    const password = await bcrypt.hash('unassigned-no-login', 12);
    lecturer = await prisma.user.create({
      data: {
        email: UNASSIGNED_LECTURER_EMAIL,
        password,
        role: 'LECTURER',
        firstName: 'Unassigned',
        lastName: '(Assign Manually)',
        departmentId,
      },
      select: { id: true },
    });
  }
  return lecturer.id;
}

export async function resolveAndImport(
  rows: ParsedTimetableRow[],
  defaultDepartmentId?: string,
  replacePeriod?: boolean
): Promise<{ created: number; conflicts: { row: number; conflicts: unknown[] }[]; stats: ImportStats; groupIds?: string[] }> {
  rows = finalizeParsedRows(rows);

  const stats: ImportStats = {
    created: { courses: 0, halls: 0, groups: 0 },
    unassignedCount: 0,
    imported: 0,
  };

  const [departments, existingCourses, existingLecturers, existingHalls, existingGroups] = await Promise.all([
    prisma.department.findMany({ select: { id: true, code: true } }),
    prisma.course.findMany({ select: { id: true, code: true } }),
    prisma.user.findMany({
      where: { role: 'LECTURER' },
      select: { id: true, email: true, firstName: true, lastName: true, timetableCode: true },
    }),
    prisma.lectureHall.findMany({ select: { id: true, name: true } }),
    prisma.studentGroup.findMany({ select: { id: true, name: true, departmentId: true } }),
  ]);

  const deptId = defaultDepartmentId || departments[0]?.id;
  if (!deptId) throw new Error('No department found. Run seed first.');

  const unassignedLecturerId = await getOrCreateUnassignedLecturer(deptId);

  const deptByCode = new Map(departments.map((d) => [d.code.toUpperCase(), d.id]));
  const courseMap = new Map(existingCourses.map((c) => [c.code.toUpperCase(), c.id]));
  const lecturerMap = new Map(existingLecturers.map((l) => [l.email.toLowerCase(), l.id]));
  const lecturerCodeIndex = buildLecturerInitialsIndex(
    existingLecturers.filter((l) => l.email !== UNASSIGNED_LECTURER_EMAIL),
  );
  const hallMap = new Map(existingHalls.map((h) => [h.name.toUpperCase(), h.id]));
  const groupMap = new Map(existingGroups.map((g) => [`${g.name.toUpperCase()}_${g.departmentId}`, g.id]));

  function inferDeptForGroup(groupName: string): string {
    const meta = parseGroupMeta(groupName);
    if (meta.programCode && deptByCode.has(meta.programCode)) {
      return deptByCode.get(meta.programCode)!;
    }
    const prefix = groupName.split('-')[0]?.toUpperCase() || '';
    if (FCT_PROGRAM_CODES.includes(prefix as (typeof FCT_PROGRAM_CODES)[number])) {
      return deptByCode.get(prefix) || deptId;
    }
    return deptId;
  }

  const validEntries: Array<{
    year: number;
    month: number;
    week: number;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    semester: number;
    courseId: string;
    lecturerId: string;
    lecturerInitials: string | null;
    hallId: string;
    groupId: string;
    _hallName: string;
    _rowNum: number;
    _lecturerAssigned: boolean;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const courseCode = (r.courseCode || 'UNKNOWN').trim().toUpperCase();
    const hallName = (r.hallName || 'TBD').trim();
    const groupName = (r.groupName || '').trim();
    if (!groupName) continue;

    let courseId = courseMap.get(courseCode);
    const shortCourseName = formatShortCourseDisplay(r.courseName || courseCode, courseCode);

    if (!courseId) {
      const created = await prisma.course.create({
        data: {
          name: shortCourseName,
          code: courseCode,
          credits: 3,
          semester: 1,
          departmentId: deptId,
        },
      });
      courseId = created.id;
      courseMap.set(courseCode, courseId);
      stats.created.courses++;
    } else {
      await prisma.course.update({
        where: { id: courseId },
        data: { name: shortCourseName },
      });
    }

    const sheetLecturer = (r.lecturerName || '').trim();
    const lecturerInitials = sheetLecturer
      ? isFetLecturerCodeToken(sheetLecturer)
        ? sheetLecturer.replace(/\s+/g, '').toUpperCase()
        : sheetLecturer
      : null;

    // Link by email first, then by FET sheet code (SB, CJ, …) when it matches one faculty profile.
    let lecturerId = r.lecturerEmail ? lecturerMap.get(r.lecturerEmail.toLowerCase()) : null;
    if (!lecturerId && lecturerInitials) {
      lecturerId = matchLecturerByInitials(lecturerInitials, lecturerCodeIndex) ?? null;
    }
    if (!lecturerId) lecturerId = unassignedLecturerId;
    const lecturerAssigned = lecturerId !== unassignedLecturerId;
    if (!lecturerInitials && !lecturerAssigned) stats.unassignedCount++;

    let hallId = hallMap.get(hallName.toUpperCase());
    if (!hallId) {
      const hallParsed = parseLectureHall(hallName);
      const created = await prisma.lectureHall.create({
        data: {
          name: hallParsed.name,
          building: hallParsed.building,
          floor: hallParsed.floor,
          capacity: hallParsed.capacity,
          equipment: hallParsed.equipment,
        },
      });
      hallId = created.id;
      hallMap.set(hallName.toUpperCase(), hallId);
      stats.created.halls++;
    }

    const groupDeptId = inferDeptForGroup(groupName);
    const canonicalName = resolveCanonicalGroupName(groupName);
    const resolvedName = canonicalName ?? groupName;
    const groupKey = `${resolvedName.toUpperCase()}_${groupDeptId}`;
    let groupId = groupMap.get(groupKey);
    if (!groupId && canonicalName) {
      groupId = (await findCanonicalGroupId(canonicalName)) ?? undefined;
      if (groupId) groupMap.set(groupKey, groupId);
    }
    if (!groupId) {
      const meta = parseGroupMeta(groupName);
      const created = await prisma.studentGroup.create({
        data: {
          name: resolvedName,
          batchYear: meta.batchYear ?? studyYearToOrdinal.Y1,
          batchLabel: meta.batchLabel ?? null,
          departmentId: groupDeptId,
        },
      });
      groupId = created.id;
      groupMap.set(groupKey, groupId);
      if (resolvedName !== groupName) {
        groupMap.set(`${groupName.toUpperCase()}_${groupDeptId}`, groupId);
      }
      stats.created.groups++;
    }

    validEntries.push({
      year: r.year ?? 2026,
      month: r.month ?? 1,
      week: r.week ?? 1,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      semester: r.semester ?? 1,
      courseId,
      lecturerId,
      lecturerInitials,
      hallId,
      groupId,
      _hallName: hallName.toUpperCase() === PLACEHOLDER_HALL_NAME ? PLACEHOLDER_HALL_NAME : hallName,
      _rowNum: rowNum,
      _lecturerAssigned: lecturerAssigned,
    });
  }

  // Replace all slots for each year/month in this import (matches admin checkbox copy)
  if (replacePeriod && validEntries.length > 0) {
    const periods = [...new Set(validEntries.map((e) => `${e.year}-${e.month}`))];
    for (const p of periods) {
      const [y, m] = p.split('-').map(Number);
      await prisma.masterTimetable.deleteMany({
        where: { year: y, month: m },
      });
    }
  }

  const allConflicts: { row: number; conflicts: unknown[] }[] = [];
  for (let i = 0; i < validEntries.length; i++) {
    const entry = validEntries[i];
    const conflicts = await detectConflicts({
      year: entry.year,
      month: entry.month,
      week: entry.week,
      dayOfWeek: entry.dayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      hallId: entry.hallId,
      lecturerId: entry.lecturerId,
      groupId: entry.groupId,
      hallName: entry._hallName,
      unassignedLecturerId,
    });
    if (conflicts.length > 0) {
      allConflicts.push({ row: entry._rowNum, conflicts });
      continue;
    }

    // Same import batch: only block duplicate slots within one student group.
    // Different groups may share a hall at the same time in a multi-table FET import.
    if (entry.groupId) {
      for (let j = 0; j < i; j++) {
        const prev = validEntries[j];
        if (prev.groupId !== entry.groupId) continue;
        if (prev.dayOfWeek !== entry.dayOfWeek) continue;
        if (!timesOverlapImport(entry.startTime, entry.endTime, prev.startTime, prev.endTime)) {
          continue;
        }

        const batchConflicts: { type: string; message: string }[] = [
          {
            type: 'GROUP',
            message: `Duplicate slot for this group on ${entry.dayOfWeek} ${entry.startTime}–${entry.endTime}`,
          },
        ];

        const hallIsReal =
          entry._hallName !== PLACEHOLDER_HALL_NAME && prev._hallName !== PLACEHOLDER_HALL_NAME;
        if (
          hallIsReal &&
          !isCommonHall(entry._hallName) &&
          !isCommonHall(prev._hallName) &&
          prev.hallId === entry.hallId
        ) {
          batchConflicts.push({
            type: 'HALL',
            message: `Hall "${entry._hallName}" is double-booked for this group on ${entry.dayOfWeek} ${entry.startTime}–${entry.endTime}`,
          });
        }

        const lectIsReal =
          entry.lecturerId !== unassignedLecturerId && prev.lecturerId !== unassignedLecturerId;
        if (lectIsReal && prev.lecturerId === entry.lecturerId) {
          batchConflicts.push({
            type: 'LECTURER',
            message: `Same lecturer is double-booked for this group on ${entry.dayOfWeek} ${entry.startTime}–${entry.endTime}`,
          });
        }

        allConflicts.push({ row: entry._rowNum, conflicts: batchConflicts });
        break;
      }
    }
  }

  if (allConflicts.length > 0) {
    return { created: 0, conflicts: allConflicts, stats, groupIds: [] };
  }

  const toCreate = validEntries.map(({ _rowNum, _lecturerAssigned, _hallName, ...e }) => ({
    ...e,
    dayOfWeek: e.dayOfWeek as DayOfWeek,
  }));
  const result = await prisma.masterTimetable.createMany({ data: toCreate });
  stats.imported = result.count;

  const groupIds = [...new Set(validEntries.map((e) => e.groupId))];
  invalidateLecturerDisplayIndex();
  return { created: result.count, conflicts: [], stats, groupIds };
}
