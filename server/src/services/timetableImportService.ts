/**
 * Timetable Import Service
 * Auto-creates missing courses, halls, groups. Uses Unassigned lecturer when lecturer not found.
 * Resolves entities from parsed rows and creates timetable entries.
 */
import type { DayOfWeek } from '../generated/prisma/client';
import { Prisma } from '../generated/prisma/client';
import prisma from '../config/database';
import { ParsedTimetableRow } from './timetableParserService';
import {
  detectConflicts,
  type ConflictInfo,
  cleanHallDisplayName,
  isCommonHall,
  PLACEHOLDER_HALL_NAME,
  splitHallDisplayNames,
  UNASSIGNED_LECTURER_EMAIL,
} from './conflictDetector';
import {
  parseLectureHall,
  studyYearToOrdinal,
  resolveCanonicalGroupName,
  type StudyYear,
} from '../config/fct-faculty-config';
import { findCanonicalGroupId } from './studentGroupResolver';
import { filterStaleCrossBatchHallConflicts } from './timetableSlotVisibility';
import { finalizeParsedRows, formatShortCourseDisplay } from './timetableParserService';
import {
  buildLecturerInitialsIndex,
  deriveTimetableCodeFromName,
  isFetLecturerCodeToken,
  matchLecturerByInitials,
} from './lecturerInitialsMatch';
import { invalidateLecturerDisplayIndex } from './lecturerDisplayService';

const DEFAULT_DEPARTMENT_CODE = 'CS';
const FCT_PROGRAM_CODES = ['CS', 'ET', 'CT', 'BS', 'BST'] as const;

function timesOverlapImport(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

/** Keep the most useful single message per slot (room clash beats duplicate-group noise). */
function prioritizeSlotConflicts(conflicts: ConflictInfo[]): ConflictInfo[] {
  const halls = conflicts.filter((c) => c.type === 'HALL');
  if (halls.length > 0) return halls;
  return conflicts;
}

export function formatTimetableConflictSummary(
  conflictRows: { row: number; conflicts: unknown[] }[],
): { summary: string; flat: ConflictInfo[] } {
  const flat = conflictRows.flatMap((c) => c.conflicts as ConflictInfo[]);
  const halls = flat.filter((c) => c.type === 'HALL');
  const seen = new Set<string>();
  const unique = halls.filter((c) => {
    if (seen.has(c.message)) return false;
    seen.add(c.message);
    return true;
  });
  if (unique.length === 1) {
    return { summary: unique[0].message, flat: unique };
  }
  if (unique.length > 1) {
    return {
      summary: `${unique.length} room booking conflicts with other batches. See the list below.`,
      flat: unique,
    };
  }
  const fallback = flat.filter((c) => {
    if (seen.has(c.message)) return false;
    seen.add(c.message);
    return true;
  });
  return {
    summary: fallback[0]?.message || 'Schedule conflicts detected while saving timetable',
    flat: fallback,
  };
}

function normalizeDayOfWeek(day: string): DayOfWeek {
  const key = day.trim().toUpperCase();
  const allowed: DayOfWeek[] = [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY',
  ];
  if (allowed.includes(key as DayOfWeek)) return key as DayOfWeek;
  throw new Error(`Invalid day of week: ${day}`);
}

async function findOrCreateHallId(
  hallName: string,
  hallMap: Map<string, string>,
  stats: ImportStats,
): Promise<string> {
  const lookupKey = hallName.toUpperCase();
  let hallId = hallMap.get(lookupKey);
  if (hallId) return hallId;

  const hallParsed = parseLectureHall(hallName);
  let createdNew = false;
  try {
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
    createdNew = true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const existing = await prisma.lectureHall.findFirst({
        where: { name: { equals: hallParsed.name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!existing) throw err;
      hallId = existing.id;
    } else {
      throw err;
    }
  }

  hallMap.set(lookupKey, hallId);
  hallMap.set(hallParsed.name.toUpperCase(), hallId);
  if (createdNew) stats.created.halls++;
  return hallId;
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
  created: { courses: number; halls: number; groups: number; lecturers: number };
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

function splitLecturerName(label: string): { firstName: string; lastName: string } {
  const cleaned = label.replace(/\s+/g, ' ').trim();
  const parts = cleaned.split(' ').filter(Boolean);
  if (parts.length === 0) return { firstName: 'Timetable', lastName: 'Lecturer' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '(Timetable)' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function slugifyLecturerLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return slug || 'lecturer';
}

function isAutoCreatableLecturerLabel(label: string): boolean {
  const cleaned = label.trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return false;
  if (isFetLecturerCodeToken(cleaned)) return false;
  if (/^(T|P|TD|PR|RR|DEMO|LECTURE|PRACTICAL)$/i.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

async function createTimetableLecturer(input: {
  label: string;
  email?: string;
  departmentId: string;
  existingTimetableCodes: Set<string>;
  stats: ImportStats;
}): Promise<{ id: string; email: string; timetableCode: string | null }> {
  const bcrypt = await import('bcrypt');
  const normalizedEmail =
    input.email && input.email.includes('@')
      ? input.email.trim().toLowerCase()
      : `timetable.${slugifyLecturerLabel(input.label)}@lecstu.local`;
  const { firstName, lastName } = splitLecturerName(input.label || normalizedEmail.split('@')[0]);
  const autoCode = deriveTimetableCodeFromName(firstName, lastName);
  const timetableCode =
    autoCode && !input.existingTimetableCodes.has(autoCode.toUpperCase())
      ? autoCode.toUpperCase()
      : null;

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: await bcrypt.hash('timetable-import-no-login', 12),
      role: 'LECTURER',
      firstName,
      lastName,
      departmentId: input.departmentId,
      ...(timetableCode ? { timetableCode } : {}),
    },
    select: { id: true, email: true, timetableCode: true },
  });
  if (created.timetableCode) input.existingTimetableCodes.add(created.timetableCode.toUpperCase());
  input.stats.created.lecturers++;
  return { id: created.id, email: created.email, timetableCode: created.timetableCode };
}

export async function resolveAndImport(
  rows: ParsedTimetableRow[],
  defaultDepartmentId?: string,
  replacePeriod?: boolean,
  replacingGroupId?: string,
  options?: { validateOnly?: boolean; forcedGroupId?: string; replacingGroupName?: string },
): Promise<{ created: number; conflicts: { row: number; conflicts: unknown[] }[]; stats: ImportStats; groupIds?: string[] }> {
  rows = finalizeParsedRows(rows);

  const stats: ImportStats = {
    created: { courses: 0, halls: 0, groups: 0, lecturers: 0 },
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
  const timetableCodeSet = new Set(
    existingLecturers
      .map((l) => l.timetableCode?.trim().toUpperCase())
      .filter((code): code is string => Boolean(code)),
  );
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
    _hallIsShared: boolean;
    _rowNum: number;
    _lecturerAssigned: boolean;
    _multiHallSiblingKey?: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const courseCode = (r.courseCode || 'UNKNOWN').trim().toUpperCase();
    const rawHallName = (r.hallName || 'TBD').trim();
    const hallIsShared = r.sharedHall === true || isCommonHall(rawHallName);
    const hallName = cleanHallDisplayName(rawHallName);
    const hallNames = splitHallDisplayNames(hallName);
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
      ? sheetLecturer.includes(',')
        ? sheetLecturer
            .split(',')
            .map((part) => part.trim().toUpperCase())
            .filter(Boolean)
            .join(',')
        : isFetLecturerCodeToken(sheetLecturer)
          ? sheetLecturer.replace(/\s+/g, '').toUpperCase()
          : sheetLecturer
      : null;

    // Link by email first, then by FET sheet code (SB, CJ, …) when it matches one faculty profile.
    let lecturerId = r.lecturerEmail ? lecturerMap.get(r.lecturerEmail.toLowerCase()) : null;
    if (!lecturerId && lecturerInitials) {
      const codesToTry = lecturerInitials.includes(',')
        ? lecturerInitials.split(',').map((part) => part.trim()).filter(Boolean)
        : [lecturerInitials];
      for (const code of codesToTry) {
        lecturerId = matchLecturerByInitials(code, lecturerCodeIndex) ?? null;
        if (lecturerId) break;
      }
    }
    if (!lecturerId && (r.lecturerEmail || isAutoCreatableLecturerLabel(sheetLecturer))) {
      const email = r.lecturerEmail?.trim().toLowerCase();
      try {
        const created = await createTimetableLecturer({
          label: sheetLecturer || email || 'Timetable Lecturer',
          email,
          departmentId: deptId,
          existingTimetableCodes: timetableCodeSet,
          stats,
        });
        lecturerId = created.id;
        lecturerMap.set(created.email.toLowerCase(), created.id);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          const existing = await prisma.user.findFirst({
            where: {
              email: { equals: email || `timetable.${slugifyLecturerLabel(sheetLecturer)}@lecstu.local`, mode: 'insensitive' },
              role: 'LECTURER',
            },
            select: { id: true, email: true },
          });
          if (existing) {
            lecturerId = existing.id;
            lecturerMap.set(existing.email.toLowerCase(), existing.id);
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
    }
    if (!lecturerId) lecturerId = unassignedLecturerId;
    const lecturerAssigned = lecturerId !== unassignedLecturerId;
    if (!lecturerInitials && !lecturerAssigned) stats.unassignedCount++;

    const hallIds = await Promise.all(hallNames.map((name) => findOrCreateHallId(name, hallMap, stats)));

    let groupId: string;
    if (options?.forcedGroupId) {
      groupId = options.forcedGroupId;
    } else {
      const groupDeptId = inferDeptForGroup(groupName);
      const canonicalName = resolveCanonicalGroupName(groupName);
      const resolvedName = canonicalName ?? groupName;
      const groupKey = `${resolvedName.toUpperCase()}_${groupDeptId}`;
      let resolvedGroupId = groupMap.get(groupKey);
      if (!resolvedGroupId && canonicalName) {
        resolvedGroupId = (await findCanonicalGroupId(canonicalName)) ?? undefined;
        if (resolvedGroupId) groupMap.set(groupKey, resolvedGroupId);
      }
      if (!resolvedGroupId) {
        const meta = parseGroupMeta(groupName);
        const created = await prisma.studentGroup.create({
          data: {
            name: resolvedName,
            batchYear: meta.batchYear ?? studyYearToOrdinal.Y1,
            batchLabel: meta.batchLabel ?? null,
            departmentId: groupDeptId,
          },
        });
        resolvedGroupId = created.id;
        groupMap.set(groupKey, resolvedGroupId);
        if (resolvedName !== groupName) {
          groupMap.set(`${groupName.toUpperCase()}_${groupDeptId}`, resolvedGroupId);
        }
        stats.created.groups++;
      }
      groupId = resolvedGroupId;
    }

    const multiHallSiblingKey =
      hallIds.length > 1
        ? [
            rowNum,
            groupId,
            courseId,
            lecturerId,
            r.dayOfWeek,
            r.startTime,
            r.endTime,
          ].join('|')
        : undefined;

    hallIds.forEach((hallId, hallIndex) => {
      const singleHallName = hallNames[hallIndex] ?? PLACEHOLDER_HALL_NAME;
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
        _hallName: singleHallName.toUpperCase() === PLACEHOLDER_HALL_NAME ? PLACEHOLDER_HALL_NAME : singleHallName,
        _hallIsShared: hallIsShared,
        _rowNum: rowNum,
        _lecturerAssigned: lecturerAssigned,
        _multiHallSiblingKey: multiHallSiblingKey,
      });
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
    const rawConflicts = await detectConflicts({
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
      hallIsShared: entry._hallIsShared,
      replacingGroupId,
      replacingGroupName: options?.replacingGroupName,
      unassignedLecturerId,
    });
    const conflicts =
      options?.replacingGroupName
        ? await filterStaleCrossBatchHallConflicts(
            rawConflicts,
            { year: entry.year, month: entry.month, week: entry.week },
            options.replacingGroupName,
          )
        : rawConflicts;
    if (conflicts.length > 0) {
      allConflicts.push({ row: entry._rowNum, conflicts: prioritizeSlotConflicts(conflicts) });
      continue;
    }

    // Same import batch: only block duplicate slots within one student group.
    // Different groups may share a hall at the same time in a multi-table FET import.
    if (entry.groupId) {
      for (let j = 0; j < i; j++) {
        const prev = validEntries[j];
        if (prev.groupId !== entry.groupId) continue;
        if (prev.dayOfWeek !== entry.dayOfWeek) continue;
        if (
          entry._multiHallSiblingKey &&
          prev._multiHallSiblingKey &&
          entry._multiHallSiblingKey === prev._multiHallSiblingKey
        ) {
          continue;
        }
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
          !entry._hallIsShared &&
          !prev._hallIsShared &&
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

  if (options?.validateOnly) {
    return {
      created: validEntries.length,
      conflicts: [],
      stats,
      groupIds: [...new Set(validEntries.map((e) => e.groupId))],
    };
  }

  let imported = 0;
  const toCreate = validEntries.map((entry) => ({
    year: entry.year,
    month: entry.month,
    week: entry.week,
    dayOfWeek: normalizeDayOfWeek(entry.dayOfWeek),
    startTime: entry.startTime,
    endTime: entry.endTime,
    semester: entry.semester,
    courseId: entry.courseId,
    lecturerId: entry.lecturerId,
    lecturerInitials: entry.lecturerInitials,
    hallId: entry.hallId,
    groupId: entry.groupId,
    hallIsShared: entry._hallIsShared,
  }));

  if (toCreate.length > 0) {
    try {
      const result = await prisma.masterTimetable.createMany({ data: toCreate });
      stats.imported = result.count;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        throw new Error(`Failed to save timetable slots: ${err.message}`);
      }
      throw err;
    }
  }

  const groupIds = [...new Set(validEntries.map((e) => e.groupId))];
  invalidateLecturerDisplayIndex();
  return { created: stats.imported, conflicts: [], stats, groupIds };
}
