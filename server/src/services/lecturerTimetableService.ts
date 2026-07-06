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

function dedupeTeachingBlocks(blocks: TeachingBlock[]): TeachingBlock[] {
  const byKey = new Map<string, TeachingBlock>();
  for (const block of blocks) {
    const key = `${block.dayOfWeek}|${block.startTime}|${block.endTime}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...block });
      continue;
    }
    if (block.label) {
      if (!existing.label) {
        existing.label = block.label;
      } else if (!existing.label.includes(block.label)) {
        existing.label = `${existing.label}; ${block.label}`;
      }
    }
    if (block.location && !existing.location) {
      existing.location = block.location;
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
  if (!raw) return false;

  const fullName = `${lecturer.firstName} ${lecturer.lastName}`.trim();
  const fullLower = fullName.toLowerCase();
  const rawLower = raw.toLowerCase();

  if (rawLower === fullLower) return true;
  if (rawLower.includes(fullLower) || fullLower.includes(rawLower)) return true;

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
    blocks.push({
      dayOfWeek: entry.dayOfWeek as DayOfWeek,
      startTime: entry.startTime,
      endTime: entry.endTime,
      label: entry.course.name || entry.course.code,
      location: entry.hall.name,
    });
  }

  const batchGrids = await fetchLatestPublishedBatchGrids();
  for (const { grid } of batchGrids) {
    const refs = extractSlotRefsFromGridSnapshot(grid);
    for (const ref of refs) {
      if (!slotRefMatchesLecturer(ref, lecturer, codes, index)) continue;
      blocks.push({
        dayOfWeek: ref.dayOfWeek as DayOfWeek,
        startTime: ref.startTime,
        endTime: ref.endTime,
        label: ref.courseName || null,
        location: ref.hallName || null,
      });
    }
  }

  return dedupeTeachingBlocks(blocks);
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
