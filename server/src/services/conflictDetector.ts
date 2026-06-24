import prisma from '../config/database';

export const PLACEHOLDER_HALL_NAME = 'TBD';
export const UNASSIGNED_LECTURER_EMAIL = 'unassigned@lecstu.edu';

export interface ConflictInfo {
  type: 'HALL' | 'LECTURER' | 'GROUP';
  message: string;
  conflictingEntryId: string;
  day: string;
  time: string;
  entityName: string;
}

interface SlotParams {
  year?: number;
  month?: number;
  week?: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  hallId: string;
  lecturerId: string;
  groupId: string;
  excludeId?: string;
  /** When set, hall/lecturer placeholder clashes are ignored (bulk FET import). */
  hallName?: string;
  unassignedLecturerId?: string;
  /** Admin grid: allow this slot to share a hall with another batch at the same time. */
  hallIsShared?: boolean;
  /** Admin grid replace: skip clashes with this group's existing slots (they will be replaced). */
  replacingGroupId?: string;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

function isPlaceholderHall(name: string | undefined): boolean {
  const n = (name || '').trim().toUpperCase();
  return !n || n === PLACEHOLDER_HALL_NAME || n === 'ONLINE' || n === '---';
}

/** Shared venue — append "COMMON" to the room (e.g. AB-LCH-09-1 COMMON) to allow another class at the same time. */
export function isCommonHall(name: string | undefined): boolean {
  const n = (name || '').trim().toUpperCase();
  if (!n || isPlaceholderHall(n)) return false;
  return /\bCOMMON\b/.test(n);
}

/** Strip admin COMMON marker from hall text shown to students. */
export function cleanHallDisplayName(name: string): string {
  const cleaned = (name || '').replace(/\s+COMMON\b/gi, '').trim();
  return cleaned || PLACEHOLDER_HALL_NAME;
}

function isPlaceholderLecturer(
  lecturerId: string,
  unassignedLecturerId: string | undefined,
  email?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): boolean {
  if (unassignedLecturerId && lecturerId === unassignedLecturerId) return true;
  if ((email || '').toLowerCase() === UNASSIGNED_LECTURER_EMAIL) return true;
  const label = `${firstName || ''} ${lastName || ''}`.trim().toLowerCase();
  return label.includes('unassigned');
}

function formatDayLabel(day: string): string {
  const d = (day || '').trim().toLowerCase();
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : day;
}

function formatLecturerLabel(
  lecturer: { firstName: string; lastName: string; email: string },
  unassignedLecturerId?: string,
  lecturerId?: string,
): string {
  if (
    lecturerId &&
    isPlaceholderLecturer(lecturerId, unassignedLecturerId, lecturer.email, lecturer.firstName, lecturer.lastName)
  ) {
    return 'Unassigned lecturer';
  }
  const name = `${lecturer.firstName || ''} ${lecturer.lastName || ''}`.trim();
  return name || 'Unknown lecturer';
}

function formatHallConflictMessage(
  entry: {
    hall: { name: string };
    group: { name: string };
    course: { code: string };
    lecturer: { firstName: string; lastName: string; email: string };
    lecturerId: string;
    startTime: string;
    endTime: string;
  },
  dayOfWeek: string,
  unassignedLecturerId?: string,
): string {
  const hall = entry.hall.name;
  const day = formatDayLabel(dayOfWeek);
  const timeStr = `${entry.startTime}–${entry.endTime}`;
  const batch = entry.group.name;
  const course = entry.course.code;
  const lecturer = formatLecturerLabel(entry.lecturer, unassignedLecturerId, entry.lecturerId);
  return (
    `${hall} is already booked on ${day} ${timeStr} by batch "${batch}" ` +
    `(${course}, ${lecturer}). ` +
    `Tick "Shared room (admin only)" on both classes if these batches share the same lecture.`
  );
}

export async function detectConflicts(params: SlotParams): Promise<ConflictInfo[]> {
  const {
    year,
    month,
    week,
    dayOfWeek,
    startTime,
    endTime,
    hallId,
    lecturerId,
    groupId,
    excludeId,
    hallName,
    unassignedLecturerId,
    hallIsShared,
    replacingGroupId,
  } = params;
  const conflicts: ConflictInfo[] = [];

  const skipHallCheck =
    isPlaceholderHall(hallName) || isCommonHall(hallName) || hallIsShared === true;
  const skipLecturerCheck = isPlaceholderLecturer(lecturerId, unassignedLecturerId);

  const where: Record<string, unknown> = {
    dayOfWeek: dayOfWeek as never,
    isActive: true,
    ...(excludeId ? { NOT: { id: excludeId } } : {}),
  };
  if (year != null) where.year = year;
  if (month != null) where.month = month;
  if (week != null) where.week = week;

  const sameDayEntries = await prisma.masterTimetable.findMany({
    where,
    include: {
      hall: { select: { name: true } },
      lecturer: { select: { id: true, firstName: true, lastName: true, email: true } },
      group: { select: { name: true } },
      course: { select: { name: true, code: true } },
    },
  });

  for (const entry of sameDayEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;

    // Replacing a batch table: ignore clashes with that group's own existing slots.
    if (replacingGroupId && entry.groupId === replacingGroupId) continue;

    const timeStr = `${entry.startTime}–${entry.endTime}`;
    const existingHallIsShared = entry.hallIsShared === true;
    let reportedHallForEntry = false;

    if (
      !skipHallCheck &&
      !existingHallIsShared &&
      !isCommonHall(entry.hall.name) &&
      entry.hallId === hallId &&
      !isPlaceholderHall(entry.hall.name)
    ) {
      conflicts.push({
        type: 'HALL',
        message: formatHallConflictMessage(entry, dayOfWeek, unassignedLecturerId),
        conflictingEntryId: entry.id,
        day: dayOfWeek,
        time: timeStr,
        entityName: entry.hall.name,
      });
      reportedHallForEntry = true;
    }

    if (
      !skipLecturerCheck &&
      entry.groupId === groupId &&
      entry.lecturerId === lecturerId &&
      !isPlaceholderLecturer(
        entry.lecturerId,
        unassignedLecturerId,
        entry.lecturer.email,
        entry.lecturer.firstName,
        entry.lecturer.lastName,
      )
    ) {
      conflicts.push({
        type: 'LECTURER',
        message: `Lecturer "${entry.lecturer.firstName} ${entry.lecturer.lastName}" is already teaching ${entry.course.code} on ${dayOfWeek} ${timeStr}`,
        conflictingEntryId: entry.id,
        day: dayOfWeek,
        time: timeStr,
        entityName: `${entry.lecturer.firstName} ${entry.lecturer.lastName}`,
      });
    }

    if (entry.groupId === groupId && !reportedHallForEntry) {
      conflicts.push({
        type: 'GROUP',
        message: `Group "${entry.group.name}" already has ${entry.course.code} on ${dayOfWeek} ${timeStr}`,
        conflictingEntryId: entry.id,
        day: dayOfWeek,
        time: timeStr,
        entityName: entry.group.name,
      });
    }
  }

  return conflicts;
}
