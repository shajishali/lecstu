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
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

function isPlaceholderHall(name: string | undefined): boolean {
  const n = (name || '').trim().toUpperCase();
  return !n || n === PLACEHOLDER_HALL_NAME || n === 'ONLINE' || n === '---';
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
  } = params;
  const conflicts: ConflictInfo[] = [];

  const skipHallCheck = isPlaceholderHall(hallName);
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
      lecturer: { select: { firstName: true, lastName: true, email: true } },
      group: { select: { name: true } },
      course: { select: { name: true, code: true } },
    },
  });

  for (const entry of sameDayEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;

    const timeStr = `${entry.startTime}–${entry.endTime}`;

    if (
      !skipHallCheck &&
      entry.hallId === hallId &&
      !isPlaceholderHall(entry.hall.name)
    ) {
      conflicts.push({
        type: 'HALL',
        message: `Hall "${entry.hall.name}" is already booked for ${entry.course.code} on ${dayOfWeek} ${timeStr}`,
        conflictingEntryId: entry.id,
        day: dayOfWeek,
        time: timeStr,
        entityName: entry.hall.name,
      });
    }

    if (
      !skipLecturerCheck &&
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

    if (entry.groupId === groupId) {
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
