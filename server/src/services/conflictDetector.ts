import prisma from '../config/database';

export interface ConflictInfo {
  type: 'HALL' | 'LECTURER' | 'GROUP';
  message: string;
  conflictingEntryId: string;
  day: string;
  time: string;
  entityName: string;
}

interface SlotParams {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  hallId: string;
  lecturerId: string;
  groupId: string;
  excludeId?: string;
}

function timesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

export async function detectConflicts(params: SlotParams): Promise<ConflictInfo[]> {
  const { dayOfWeek, startTime, endTime, hallId, lecturerId, groupId, excludeId } = params;
  const conflicts: ConflictInfo[] = [];

  const sameDayEntries = await prisma.masterTimetable.findMany({
    where: {
      dayOfWeek: dayOfWeek as any,
      isActive: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    include: {
      hall: { select: { name: true } },
      lecturer: { select: { firstName: true, lastName: true } },
      group: { select: { name: true } },
      course: { select: { name: true, code: true } },
    },
  });

  for (const entry of sameDayEntries) {
    if (!timesOverlap(startTime, endTime, entry.startTime, entry.endTime)) continue;

    const timeStr = `${entry.startTime}–${entry.endTime}`;

    if (entry.hallId === hallId) {
      conflicts.push({
        type: 'HALL',
        message: `Hall "${entry.hall.name}" is already booked for ${entry.course.code} on ${dayOfWeek} ${timeStr}`,
        conflictingEntryId: entry.id,
        day: dayOfWeek,
        time: timeStr,
        entityName: entry.hall.name,
      });
    }

    if (entry.lecturerId === lecturerId) {
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
