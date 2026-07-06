import prisma from '../config/database';
import { formatBatchTableTitle, extractBatchYearLabel } from '../config/fct-faculty-config';
import { resolveGroupIdsForStudent, parseEnrollmentFromGroupName } from './studentGroupResolver';
import { getPublishedGridForGroup } from './timetableTableService';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import {
  fetchMasterEntriesForLecturer,
  getLecturerCodes,
  syncTeachingScheduleFromMaster,
} from './lecturerTimetableService';

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
  enrollment?: { programCode: string; studyYear: string; pathwayCode: string; groupName: string; selectedBatchYearLabel?: string | null };
  /** Faithful FET grid for the student's batch (preferred for My Timetable UI) */
  grid?: TimetableGridSnapshot | null;
};

export async function getStudentTimetable(studentId: string): Promise<StudentTimetableResult> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { selectedBatchYearLabel: true, group: { select: { id: true, name: true } } },
  });

  const primaryMembership = memberships[0];
  const primaryGroup = primaryMembership?.group;
  const parsedEnrollment = primaryGroup ? parseEnrollmentFromGroupName(primaryGroup.name) : undefined;
  const displayGroupName =
    parsedEnrollment?.studyYear === 'Y1' && parsedEnrollment.programCode && primaryMembership?.selectedBatchYearLabel
      ? `Y1-${parsedEnrollment.programCode}-${primaryMembership.selectedBatchYearLabel.slice(-2)}`
      : primaryGroup?.name;
  const enrollment = primaryGroup
    ? {
        ...parsedEnrollment!,
        groupName: displayGroupName ?? primaryGroup.name,
        selectedBatchYearLabel: primaryMembership?.selectedBatchYearLabel ?? null,
      }
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

  let grid: TimetableGridSnapshot | null = null;
  const preferredBatchYear = primaryMembership?.selectedBatchYearLabel ?? null;
  if (primaryGroup?.name) {
    grid = await getPublishedGridForGroup(primaryGroup.name, undefined, preferredBatchYear);
    if (grid) {
      const friendlyTitle = formatBatchTableTitle(
        primaryGroup.name,
        preferredBatchYear ?? extractBatchYearLabel(grid.tableTitle, primaryGroup.name),
      );
      grid = {
        ...grid,
        tableTitle: friendlyTitle,
        groupName: primaryGroup.name,
      };
    }
  }

  if (preferredBatchYear && !grid) {
    return {
      weekly: organizeByDay([]),
      flat: [],
      lastUpdated: null,
      enrollment,
      grid: null,
    };
  }

  const periodFiltered =
    grid != null
      ? entries.filter(
          (e) => e.year === grid!.year && e.month === grid!.month && e.week === grid!.week,
        )
      : entries;

  const flat = deduplicateEntries(periodFiltered).map((entry) =>
    primaryGroup && displayGroupName && entry.group.name === primaryGroup.name
      ? { ...entry, group: { ...entry.group, name: displayGroupName, batchLabel: primaryMembership?.selectedBatchYearLabel ?? entry.group.batchLabel } }
      : entry,
  );
  const lastUpdated = await getEntriesLastUpdated(
    grid != null
      ? {
          groupId: { in: groupIds },
          year: grid.year,
          month: grid.month,
          week: grid.week,
        }
      : { groupId: { in: groupIds } },
  );

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
