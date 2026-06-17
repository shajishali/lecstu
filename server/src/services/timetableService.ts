import prisma from '../config/database';
import { resolveGroupIdsForStudent, parseEnrollmentFromGroupName } from './studentGroupResolver';
import { getPublishedGridForGroup } from './timetableTableService';
import { enrichGridFromSlots, type GridSlotRef } from './timetableGridBuilder';
import { backfillSlotRefsForGroup } from './timetableRepairService';
import { getLecturerDisplayIndex } from './lecturerDisplayService';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  fetchMasterEntriesForLecturer,
  getLecturerCodes,
  syncTeachingScheduleFromMaster,
} from './lecturerTimetableService';
import type { TimetableGridSnapshot } from '../types/timetableGrid';

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
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true, doorPassword: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
};

export interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  month: number;
  week: number;
  lecturerInitials: string | null;
  notes: string | null;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; designation: string | null; email: string };
  hall: { id: string; name: string; building: string; capacity: number; doorPassword?: string | null };
  group: { id: string; name: string; batchYear: number; batchLabel: string | null };
}

export type WeeklyTimetable = Record<string, TimetableSlot[]>;

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function organizeByDay(entries: TimetableSlot[]): WeeklyTimetable {
  const weekly: WeeklyTimetable = {};
  for (const day of DAY_ORDER) {
    weekly[day] = [];
  }
  for (const entry of entries) {
    if (!weekly[entry.dayOfWeek]) weekly[entry.dayOfWeek] = [];
    weekly[entry.dayOfWeek].push(entry);
  }
  for (const day of Object.keys(weekly)) {
    weekly[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return weekly;
}

function deduplicateEntries(entries: TimetableSlot[]): TimetableSlot[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

async function getEntriesLastUpdated(
  where: Parameters<typeof prisma.masterTimetable.aggregate>[0]['where'],
): Promise<string | null> {
  const result = await prisma.masterTimetable.aggregate({
    where: { ...where, isActive: true },
    _max: { updatedAt: true },
  });
  return result._max.updatedAt?.toISOString() ?? null;
}

export type StudentTimetableResult = {
  weekly: WeeklyTimetable;
  flat: TimetableSlot[];
  lastUpdated: string | null;
  enrollment?: { programCode: string; studyYear: string; pathwayCode: string; groupName: string };
  /** Faithful FET grid for the student's batch (preferred for My Timetable UI) */
  grid?: TimetableGridSnapshot | null;
};

export async function getStudentTimetable(studentId: string): Promise<StudentTimetableResult> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { group: { select: { id: true, name: true } } },
  });

  const primaryGroup = memberships[0]?.group;
  const enrollment = primaryGroup
    ? { ...parseEnrollmentFromGroupName(primaryGroup.name), groupName: primaryGroup.name }
    : undefined;

  const groupIds = await resolveGroupIdsForStudent(studentId);

  if (groupIds.length === 0) {
    return { weekly: organizeByDay([]), flat: [], lastUpdated: null, enrollment };
  }

  const entries = await prisma.masterTimetable.findMany({
    where: { groupId: { in: groupIds }, isActive: true },
    select: SLOT_SELECT,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  }) as TimetableSlot[];

  const flat = deduplicateEntries(entries);
  const lastUpdated = await getEntriesLastUpdated({ groupId: { in: groupIds } });

  let grid: TimetableGridSnapshot | null = null;
  if (primaryGroup?.name) {
    grid = await getPublishedGridForGroup(primaryGroup.name);
  }

  if (grid && flat.length > 0) {
    const lecturerDisplay = await getLecturerDisplayIndex();
    const slotRefs = backfillSlotRefsForGroup(
      primaryGroup.name,
      flat.map((e) => {
        let lecturerName = e.lecturerInitials?.trim() || undefined;
        if (!lecturerName && e.lecturer.email !== UNASSIGNED_LECTURER_EMAIL) {
          lecturerName = `${e.lecturer.firstName} ${e.lecturer.lastName}`.trim() || undefined;
        }
        return {
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          courseName: e.course.name,
          hallName: e.hall.name,
          lecturerName,
        };
      }),
    );
    grid = enrichGridFromSlots(grid, slotRefs, { lecturerDisplay });
  }

  return { weekly: organizeByDay(flat), flat, lastUpdated, enrollment, grid };
}

/** Lecturer teaching timetable from admin import (matched by lecturerId + FET initials). */
export async function getLecturerTimetable(lecturerId: string): Promise<{
  weekly: WeeklyTimetable;
  flat: TimetableSlot[];
  lastUpdated: string | null;
  timetableCodes: string[];
  scheduleSlots: {
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    slotType: string;
    label: string | null;
    location: string | null;
  }[];
}> {
  const [flat, timetableCodes, personalSlots] = await Promise.all([
    fetchMasterEntriesForLecturer(lecturerId),
    getLecturerCodes(lecturerId),
    prisma.lecturerScheduleSlot.findMany({
      where: { lecturerId, slotType: { in: ['BUSY', 'OFFICE_HOUR'] } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
  ]);

  const deduped = deduplicateEntries(flat);

  const orConditions: Array<{ lecturerId: string } | { lecturerInitials: { in: string[] } }> = [
    { lecturerId },
  ];
  if (timetableCodes.length > 0) {
    orConditions.push({ lecturerInitials: { in: timetableCodes } });
  }
  const lastUpdated = await getEntriesLastUpdated({ OR: orConditions });

  // Keep appointment availability in sync with assigned teaching slots.
  await syncTeachingScheduleFromMaster(lecturerId);

  return {
    weekly: organizeByDay(deduped),
    flat: deduped,
    lastUpdated,
    timetableCodes,
    scheduleSlots: personalSlots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      slotType: s.slotType,
      label: s.label,
      location: s.location,
    })),
  };
}
