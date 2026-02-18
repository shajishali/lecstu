import prisma from '../config/database';

const SLOT_INCLUDE = {
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true } },
  group: { select: { id: true, name: true, batchYear: true } },
};

export interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; capacity: number };
  group: { id: string; name: string; batchYear: number };
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

export async function getStudentTimetable(studentId: string): Promise<{ weekly: WeeklyTimetable; flat: TimetableSlot[] }> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { groupId: true },
  });

  const groupIds = memberships.map((m) => m.groupId);

  if (groupIds.length === 0) {
    return { weekly: organizeByDay([]), flat: [] };
  }

  const entries = await prisma.masterTimetable.findMany({
    where: { groupId: { in: groupIds }, isActive: true },
    include: SLOT_INCLUDE,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  }) as unknown as TimetableSlot[];

  const flat = deduplicateEntries(entries);
  return { weekly: organizeByDay(flat), flat };
}

export async function getLecturerTimetable(lecturerId: string): Promise<{ weekly: WeeklyTimetable; flat: TimetableSlot[] }> {
  const entries = await prisma.masterTimetable.findMany({
    where: { lecturerId, isActive: true },
    include: SLOT_INCLUDE,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  }) as unknown as TimetableSlot[];

  return { weekly: organizeByDay(entries), flat: entries };
}
