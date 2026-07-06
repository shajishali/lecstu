import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { detectConflicts } from './conflictDetector';
import {
  lecturerCodesFromName,
  effectiveTimetableCode,
  matchLecturerByInitials,
  matchLecturerFromSheetCode,
} from './lecturerInitialsMatch';
import { getLecturerDisplayIndex, resolveLecturerDisplayName, type LecturerDisplayIndex } from './lecturerDisplayService';
import { resolveGroupIdToCanonical } from './studentGroupResolver';
import { formatShortCourseDisplay } from './timetableParserService';
import { invalidateAll } from './timetableCache';
import { notifyTimetableChange } from './notificationService';
import {
  extractSlotRefsFromGridSnapshot,
  normalizeGridSnapshot,
  type GridSlotRef,
} from './timetableGridBuilder';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import type { DayOfWeek } from '../generated/prisma/client';
import type { TimetableSlot } from './timetableService';

const SLOT_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  semester: true,
  year: true,
  month: true,
  week: true,
  lecturerInitials: true,
  notes: true,
  lecturerId: true,
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true, doorPassword: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getLecturerCodes(lecturerId: string): Promise<string[]> {
  const lecturer = await prisma.user.findUnique({
    where: { id: lecturerId },
    select: { firstName: true, lastName: true, timetableCode: true },
  });
  if (!lecturer) return [];
  return lecturerCodesFromName(lecturer.firstName, lecturer.lastName, lecturer.timetableCode);
}

function initialsMatch(codes: string[], initials: string | null | undefined): boolean {
  const raw = (initials || '').trim();
  if (!raw || codes.length === 0) return false;
  const upper = raw.toUpperCase();
  return codes.some((c) => c.toUpperCase() === upper);
}

export function lecturerOwnsMasterSlot(
  lecturerId: string,
  codes: string[],
  slot: { lecturerId: string; lecturerInitials: string | null },
): boolean {
  if (slot.lecturerId === lecturerId) return true;
  return initialsMatch(codes, slot.lecturerInitials);
}

async function resolveHallIdByName(hallName: string): Promise<string> {
  const trimmed = hallName.trim();
  if (!trimmed) throw new AppError('Place is required', 400);

  const existing = await prisma.lectureHall.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) return existing.id;

  const { parseLectureHall } = await import('../config/fct-faculty-config');
  const parsed = parseLectureHall(trimmed);
  const created = await prisma.lectureHall.create({
    data: {
      name: parsed.name,
      building: parsed.building,
      floor: parsed.floor,
      capacity: parsed.capacity,
      equipment: parsed.equipment,
    },
  });
  return created.id;
}

export async function fetchMasterEntriesForLecturer(lecturerId: string): Promise<TimetableSlot[]> {
  const codes = await getLecturerCodes(lecturerId);
  const orConditions: Array<{ lecturerId: string } | { lecturerInitials: { in: string[] } }> = [
    { lecturerId },
  ];
  if (codes.length > 0) {
    orConditions.push({ lecturerInitials: { in: codes } });
  }

  const entries = await prisma.masterTimetable.findMany({
    where: { isActive: true, OR: orConditions },
    select: SLOT_SELECT,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return entries as TimetableSlot[];
}

export interface TeachingBlock {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  label: string | null;
  location: string | null;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Course identity for merge/dedupe (e.g. CSCI-12042 from "CSCI 12042 T"). */
function normalizeCourseKey(label: string | null): string {
  if (!label) return '';
  const m = label.trim().toUpperCase().match(/([A-Z]{2,6})[\s-]*(\d{4,5})/);
  return m ? `${m[1]}-${m[2]}` : label.trim().toUpperCase();
}

function slotsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/** Prefer the batch grid's rowSpan duration over a 1h master_timetable row. */
function upgradeBlockFromGridRefs(block: TeachingBlock, gridRefs: GridSlotRef[]): TeachingBlock {
  const courseKey = normalizeCourseKey(block.label);
  if (!courseKey) return block;

  const matches = gridRefs.filter(
    (g) =>
      g.dayOfWeek === block.dayOfWeek &&
      normalizeCourseKey(g.courseName) === courseKey &&
      slotsOverlap(block.startTime, block.endTime, g.startTime, g.endTime),
  );
  if (matches.length === 0) return block;

  const best = matches.reduce((a, b) => {
    const durA = timeToMinutes(a.endTime) - timeToMinutes(a.startTime);
    const durB = timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
    return durB > durA ? b : a;
  });

  const blockDur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
  const bestDur = timeToMinutes(best.endTime) - timeToMinutes(best.startTime);
  if (bestDur <= blockDur) return block;

  return {
    ...block,
    startTime: best.startTime,
    endTime: best.endTime,
    location: block.location || best.hallName || null,
    label: block.label || best.courseName || null,
  };
}

function mergeConsecutiveTeachingBlocks(blocks: TeachingBlock[]): TeachingBlock[] {
  const sorted = [...blocks].sort(
    (a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
  );
  const merged: TeachingBlock[] = [];
  let current: TeachingBlock | null = null;

  for (const row of sorted) {
    if (!current) {
      current = { ...row };
      continue;
    }
    const sameDay = current.dayOfWeek === row.dayOfWeek;
    const sameCourse = normalizeCourseKey(current.label) === normalizeCourseKey(row.label);
    const gap = timeToMinutes(row.startTime) - timeToMinutes(current.endTime);

    if (sameDay && sameCourse && gap >= 0 && gap <= 15) {
      current = {
        ...current,
        endTime:
          timeToMinutes(row.endTime) > timeToMinutes(current.endTime) ? row.endTime : current.endTime,
        location: current.location || row.location,
      };
    } else {
      merged.push(current);
      current = { ...row };
    }
  }
  if (current) merged.push(current);
  return merged;
}

function dedupeTeachingBlocks(blocks: TeachingBlock[]): TeachingBlock[] {
  const byKey = new Map<string, TeachingBlock>();
  for (const block of blocks) {
    const key = `${block.dayOfWeek}|${block.startTime}|${normalizeCourseKey(block.label)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...block });
      continue;
    }
    const existingDur = timeToMinutes(existing.endTime) - timeToMinutes(existing.startTime);
    const blockDur = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
    if (blockDur > existingDur) {
      byKey.set(key, {
        ...block,
        label: existing.label || block.label,
        location: existing.location || block.location,
      });
    } else {
      if (block.label && existing.label && !existing.label.includes(block.label)) {
        existing.label = `${existing.label}; ${block.label}`;
      }
      if (block.location && !existing.location) existing.location = block.location;
    }
  }
  return [...byKey.values()].sort(
    (a, b) => a.dayOfWeek.localeCompare(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
  );
}

async function fetchLatestPublishedBatchGrids(): Promise<
  { groupName: string; grid: TimetableGridSnapshot }[]
> {
  const snapshots = await prisma.timetableTableSnapshot.findMany({
    where: { isPublished: true },
    select: { groupName: true, gridData: true, importedAt: true },
    orderBy: [{ groupName: 'asc' }, { importedAt: 'desc' }],
  });

  const byGroup = new Map<string, { groupName: string; grid: TimetableGridSnapshot }>();
  for (const snap of snapshots) {
    const key = snap.groupName.trim().toUpperCase();
    if (byGroup.has(key)) continue;
    byGroup.set(key, {
      groupName: snap.groupName,
      grid: normalizeGridSnapshot(snap.gridData as unknown as TimetableGridSnapshot),
    });
  }
  return [...byGroup.values()];
}

function slotRefMatchesLecturer(
  ref: GridSlotRef,
  lecturer: { id: string; firstName: string; lastName: string },
  codes: string[],
  index: LecturerDisplayIndex,
): boolean {
  const raw = ref.lecturerName?.trim();
  if (!raw || raw === '—' || raw === '-' || /^tbd$/i.test(raw) || /^unassigned$/i.test(raw)) {
    return false;
  }

  const fullName = `${lecturer.firstName} ${lecturer.lastName}`.trim();
  const fullLower = fullName.toLowerCase();
  const rawLower = raw.toLowerCase();
  const lastLower = lecturer.lastName.trim().toLowerCase();
  const firstLower = lecturer.firstName.trim().toLowerCase();

  if (rawLower === fullLower) return true;
  if (rawLower.includes(fullLower) || fullLower.includes(rawLower)) return true;
  if (lastLower.length >= 4 && rawLower.includes(lastLower)) return true;
  if (firstLower.length >= 3 && lastLower.length >= 4 && rawLower.includes(firstLower) && rawLower.includes(lastLower)) {
    return true;
  }

  if (codes.some((c) => c.toUpperCase() === raw.toUpperCase())) return true;

  const matchedId =
    matchLecturerFromSheetCode(raw, index.idByCode) ?? matchLecturerByInitials(raw, index.idByCode);
  if (matchedId === lecturer.id) return true;

  const resolved = resolveLecturerDisplayName(raw, index);
  if (resolved && resolved.toLowerCase() === fullLower) return true;

  return false;
}

/**
 * Teaching blocks from every batch timetable: master_timetable rows plus every
 * published FET grid snapshot (all groups, all days). Ensures no lecturer slot
 * is missed when students view availability or book appointments.
 */
export async function fetchTeachingBlocksForLecturer(lecturerId: string): Promise<TeachingBlock[]> {
  const lecturer = await prisma.user.findUnique({
    where: { id: lecturerId },
    select: { id: true, firstName: true, lastName: true, timetableCode: true },
  });
  if (!lecturer) return [];

  const codes = lecturerCodesFromName(lecturer.firstName, lecturer.lastName, lecturer.timetableCode);
  const index = await getLecturerDisplayIndex();
  const blocks: TeachingBlock[] = [];
  const coveredKeys = new Set<string>();

  const batchGrids = await fetchLatestPublishedBatchGrids();
  const gridRefsByGroup = new Map<string, GridSlotRef[]>();
  for (const { groupName, grid } of batchGrids) {
    gridRefsByGroup.set(groupName.trim().toUpperCase(), extractSlotRefsFromGridSnapshot(grid));
  }

  const masterEntries = await fetchMasterEntriesForLecturer(lecturerId);
  for (const entry of masterEntries) {
    if (
      !lecturerOwnsMasterSlot(lecturerId, codes, {
        lecturerId: entry.lecturer.id,
        lecturerInitials: entry.lecturerInitials,
      })
    ) {
      continue;
    }
    const groupKey = entry.group.name.trim().toUpperCase();
    const gridRefs = gridRefsByGroup.get(groupKey) ?? [];
    let block = upgradeBlockFromGridRefs(
      {
        dayOfWeek: entry.dayOfWeek as DayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        label: entry.course.name || entry.course.code,
        location: entry.hall.name,
      },
      gridRefs,
    );
    blocks.push(block);
    coveredKeys.add(`${block.dayOfWeek}|${block.startTime}|${normalizeCourseKey(block.label)}`);
  }

  for (const { groupName } of batchGrids) {
    const refs = gridRefsByGroup.get(groupName.trim().toUpperCase()) ?? [];
    for (const ref of refs) {
      if (!slotRefMatchesLecturer(ref, lecturer, codes, index)) continue;
      const key = `${ref.dayOfWeek}|${ref.startTime}|${normalizeCourseKey(ref.courseName)}`;
      if (coveredKeys.has(key)) continue;
      coveredKeys.add(key);
      blocks.push({
        dayOfWeek: ref.dayOfWeek as DayOfWeek,
        startTime: ref.startTime,
        endTime: ref.endTime,
        label: ref.courseName || null,
        location: ref.hallName || null,
      });
    }
  }

  return mergeConsecutiveTeachingBlocks(dedupeTeachingBlocks(blocks));
}

/** Keep LecturerScheduleSlot TEACHING rows aligned with all batch timetables. */
export async function syncTeachingScheduleFromMaster(lecturerId: string): Promise<void> {
  const blocks = await fetchTeachingBlocksForLecturer(lecturerId);

  await prisma.$transaction(async (tx) => {
    await tx.lecturerScheduleSlot.deleteMany({ where: { lecturerId, slotType: 'TEACHING' } });
    if (blocks.length > 0) {
      await tx.lecturerScheduleSlot.createMany({
        data: blocks.map((e) => ({
          lecturerId,
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          slotType: 'TEACHING' as const,
          label: e.label,
          location: e.location,
        })),
      });
    }
  });
}

export interface LecturerMasterSlotUpdate {
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  year?: number;
  month?: number;
  week?: number;
  courseName?: string;
  courseCode?: string;
  hallName?: string;
  hallDoorPassword?: string | null;
  notes?: string | null;
}

export async function updateLecturerMasterSlot(
  lecturerId: string,
  slotId: string,
  patch: LecturerMasterSlotUpdate,
): Promise<TimetableSlot> {
  const codes = await getLecturerCodes(lecturerId);
  const existing = await prisma.masterTimetable.findUnique({
    where: { id: slotId },
    select: { ...SLOT_SELECT, groupId: true },
  });
  if (!existing) throw new AppError('Timetable entry not found', 404);
  if (!lecturerOwnsMasterSlot(lecturerId, codes, existing)) {
    throw new AppError('You can only edit your own assigned lectures', 403);
  }

  const dayOfWeek = patch.dayOfWeek ?? existing.dayOfWeek;
  const startTime = patch.startTime ?? existing.startTime;
  const endTime = patch.endTime ?? existing.endTime;
  const year = patch.year ?? existing.year ?? 2026;
  const month = patch.month ?? existing.month ?? 1;
  const week = patch.week ?? existing.week ?? 1;

  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw new AppError('Times must be HH:mm (24h)', 400);
  }
  if (startTime >= endTime) throw new AppError('Start time must be before end time', 400);
  if (month < 1 || month > 12) throw new AppError('Month must be between 1 and 12', 400);
  if (week < 1 || week > 53) throw new AppError('Week must be between 1 and 53', 400);

  let hallId = existing.hall.id;
  if (patch.hallName !== undefined) {
    hallId = await resolveHallIdByName(patch.hallName);
  }

  if (patch.hallDoorPassword !== undefined) {
    await prisma.lectureHall.update({
      where: { id: hallId },
      data: { doorPassword: patch.hallDoorPassword?.trim() || null },
    });
  }

  const conflicts = await detectConflicts({
    year,
    month,
    week,
    dayOfWeek,
    startTime,
    endTime,
    hallId,
    lecturerId: existing.lecturerId,
    groupId: existing.group.id,
    excludeId: slotId,
  });
  if (conflicts.length > 0) {
    throw new AppError(`Schedule conflict: ${conflicts[0].message}`, 409);
  }

  let courseId: string | undefined;
  if (patch.courseCode?.trim()) {
    const newCode = patch.courseCode.trim().toUpperCase();
    if (newCode !== existing.course.code) {
      const lecturer = await prisma.user.findUnique({
        where: { id: lecturerId },
        select: { departmentId: true },
      });
      courseId = await resolveOrCreateCourse(
        newCode,
        patch.courseName ?? existing.course.name,
        lecturer?.departmentId ?? null,
      );
    } else if (patch.courseName?.trim()) {
      await prisma.course.update({
        where: { id: existing.course.id },
        data: { name: patch.courseName.trim() },
      });
    }
  } else if (patch.courseName?.trim()) {
    await prisma.course.update({
      where: { id: existing.course.id },
      data: { name: patch.courseName.trim() },
    });
  }

  const updateData: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    year: number;
    month: number;
    week: number;
    hallId: string;
    courseId?: string;
    notes?: string | null;
    lecturerId?: string;
  } = {
    dayOfWeek: dayOfWeek as DayOfWeek,
    startTime,
    endTime,
    year,
    month,
    week,
    hallId,
  };

  if (courseId) {
    updateData.courseId = courseId;
  }

  if (patch.notes !== undefined) {
    updateData.notes = patch.notes?.trim() || null;
  }
  if (existing.lecturerId !== lecturerId) {
    updateData.lecturerId = lecturerId;
  }

  const updated = await prisma.masterTimetable.update({
    where: { id: slotId },
    data: updateData,
    select: SLOT_SELECT,
  });

  await syncTeachingScheduleFromMaster(lecturerId);
  invalidateAll();
  await notifyTimetableChange([existing.group.id]);

  return updated as TimetableSlot;
}

export async function getLecturerTimetableCreateOptions(lecturerId: string) {
  const lecturer = await prisma.user.findUnique({
    where: { id: lecturerId },
    select: {
      firstName: true,
      lastName: true,
      timetableCode: true,
      departmentId: true,
      department: { select: { id: true, code: true, name: true } },
    },
  });
  if (!lecturer) throw new AppError('Lecturer not found', 404);

  const groups = await prisma.studentGroup.findMany({
    select: {
      id: true,
      name: true,
      batchYear: true,
      batchLabel: true,
      department: { select: { id: true, code: true, name: true } },
      pathway: { select: { id: true, code: true, name: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: 'asc' },
  });

  const courses = await prisma.course.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  const halls = await prisma.lectureHall.findMany({
    where: { isActive: true },
    select: { id: true, name: true, building: true, doorPassword: true },
    orderBy: { name: 'asc' },
  });

  return {
    timetableCode: effectiveTimetableCode(
      lecturer.firstName,
      lecturer.lastName,
      lecturer.timetableCode,
    ),
    department: lecturer.department,
    groups: groups.map(({ _count, ...g }) => ({
      ...g,
      memberCount: _count.members,
    })),
    courses,
    halls,
  };
}

async function resolveOrCreateCourse(
  courseCode: string,
  courseName: string | undefined,
  departmentId: string | null,
): Promise<string> {
  const code = courseCode.trim().toUpperCase();
  if (!code) throw new AppError('Course code is required', 400);

  const existing = await prisma.course.findUnique({ where: { code } });
  if (existing) {
    const name = formatShortCourseDisplay(courseName || existing.name, code);
    if (name !== existing.name) {
      await prisma.course.update({ where: { id: existing.id }, data: { name } });
    }
    return existing.id;
  }

  if (!departmentId) {
    throw new AppError('Your profile needs a department before creating new courses', 400);
  }

  const created = await prisma.course.create({
    data: {
      code,
      name: formatShortCourseDisplay(courseName || code, code),
      credits: 3,
      semester: 1,
      departmentId,
    },
  });
  return created.id;
}

export interface CreateLecturerTimetableInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  year?: number;
  month?: number;
  week?: number;
  semester?: number;
  courseCode: string;
  courseName?: string;
  courseId?: string;
  hallName: string;
  hallDoorPassword?: string | null;
  groupIds: string[];
  notes?: string | null;
}

export async function createLecturerTimetableEntries(
  lecturerId: string,
  input: CreateLecturerTimetableInput,
): Promise<TimetableSlot[]> {
  if (!input.groupIds?.length) {
    throw new AppError('Select at least one batch (class group)', 400);
  }

  const { startTime, endTime, dayOfWeek } = input;
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw new AppError('Times must be HH:mm (24h)', 400);
  }
  if (startTime >= endTime) throw new AppError('Start time must be before end time', 400);

  const lecturer = await prisma.user.findUnique({
    where: { id: lecturerId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      timetableCode: true,
      departmentId: true,
    },
  });
  if (!lecturer) throw new AppError('Lecturer not found', 404);

  const lecturerInitials =
    effectiveTimetableCode(lecturer.firstName, lecturer.lastName, lecturer.timetableCode) ?? null;

  let courseId = input.courseId?.trim();
  if (!courseId) {
    courseId = await resolveOrCreateCourse(
      input.courseCode,
      input.courseName,
      lecturer.departmentId,
    );
  } else {
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new AppError('Course not found', 404);
  }

  const hallId = await resolveHallIdByName(input.hallName);
  if (input.hallDoorPassword !== undefined) {
    await prisma.lectureHall.update({
      where: { id: hallId },
      data: { doorPassword: input.hallDoorPassword?.trim() || null },
    });
  }

  const year = input.year ?? 2026;
  const month = input.month ?? 1;
  const week = input.week ?? 1;
  const semester = input.semester ?? 1;
  const notes = input.notes?.trim() || null;

  const created: TimetableSlot[] = [];
  const notifiedGroupIds = new Set<string>();

  for (const rawGroupId of input.groupIds) {
    const groupId = await resolveGroupIdToCanonical(rawGroupId);
    const conflicts = await detectConflicts({
      year,
      month,
      week,
      dayOfWeek,
      startTime,
      endTime,
      hallId,
      lecturerId,
      groupId,
    });
    if (conflicts.length > 0) {
      const group = await prisma.studentGroup.findUnique({
        where: { id: groupId },
        select: { name: true },
      });
      throw new AppError(
        `Conflict for ${group?.name ?? 'batch'}: ${conflicts[0].message}`,
        409,
      );
    }

    const entry = await prisma.masterTimetable.create({
      data: {
        year,
        month,
        week,
        dayOfWeek,
        startTime,
        endTime,
        semester,
        courseId,
        lecturerId,
        hallId,
        groupId,
        lecturerInitials,
        notes,
      },
      select: SLOT_SELECT,
    });
    created.push(entry as TimetableSlot);
    notifiedGroupIds.add(groupId);
  }

  await syncTeachingScheduleFromMaster(lecturerId);
  invalidateAll();
  if (notifiedGroupIds.size > 0) {
    await notifyTimetableChange([...notifiedGroupIds]);
  }

  return created;
}
