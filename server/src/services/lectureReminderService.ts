import prisma from '../config/database';
import { createNotification } from './notificationService';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import type { DayOfWeek } from '../generated/prisma/client';

const REMINDER_MINUTES = 30;
const WINDOW_MARGIN_MINUTES = 5;

const DAY_ORDER = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const SLOT_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  year: true,
  month: true,
  week: true,
  lecturerInitials: true,
  groupId: true,
  course: { select: { code: true, name: true } },
  lecturer: { select: { firstName: true, lastName: true, email: true } },
  hall: { select: { name: true, building: true } },
} as const;

type TimetableEntry = {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  year: number;
  month: number;
  week: number;
  lecturerInitials: string | null;
  groupId: string;
  course: { code: string; name: string };
  lecturer: { firstName: string; lastName: string; email: string };
  hall: { name: string; building: string };
};

function getServerDayOfWeek(): DayOfWeek {
  return DAY_ORDER[new Date().getDay()] as DayOfWeek;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

function periodKey(entry: { year: number; month: number; week: number }): string {
  return `${entry.year}-${entry.month}-${entry.week}`;
}

function pickLatestPeriodKey(entries: TimetableEntry[]): string | null {
  const keys = [...new Set(entries.map(periodKey))];
  if (keys.length === 0) return null;
  keys.sort((a, b) => {
    const [ay, am, aw] = a.split('-').map(Number);
    const [by, bm, bw] = b.split('-').map(Number);
    if (ay !== by) return by - ay;
    if (am !== bm) return bm - am;
    return bw - aw;
  });
  return keys[0];
}

function lecturerDisplayName(entry: TimetableEntry): string {
  if (entry.lecturerInitials?.trim()) return entry.lecturerInitials.trim();
  if (entry.lecturer.email === UNASSIGNED_LECTURER_EMAIL) return 'TBD';
  return `${entry.lecturer.firstName} ${entry.lecturer.lastName}`.trim() || 'TBD';
}

function minutesUntilStart(startTime: string, nowMinutes: number): number {
  return parseTimeToMinutes(startTime) - nowMinutes;
}

function isInReminderWindow(minutesUntil: number): boolean {
  return (
    minutesUntil >= REMINDER_MINUTES - WINDOW_MARGIN_MINUTES &&
    minutesUntil <= REMINDER_MINUTES + WINDOW_MARGIN_MINUTES
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadSentReminderKeys(userIds: string[], todayStart: Date): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();

  const sent = await prisma.notification.findMany({
    where: {
      userId: { in: userIds },
      type: 'LECTURE_REMINDER',
      createdAt: { gte: todayStart },
    },
    select: { userId: true, metadata: true },
  });

  const keys = new Set<string>();
  for (const row of sent) {
    const slotId = (row.metadata as { slotId?: string } | null)?.slotId;
    if (slotId) keys.add(`${row.userId}:${slotId}`);
  }
  return keys;
}

function buildReminderMessage(entry: TimetableEntry): string {
  const lecturer = lecturerDisplayName(entry);
  const courseLabel = entry.course.code
    ? `${entry.course.code} ${entry.course.name}`.trim()
    : entry.course.name;
  const location = entry.hall.name || entry.hall.building;
  return `${courseLabel}\nLecturer: ${lecturer}\nRoom: ${location}\nTime: ${entry.startTime}-${entry.endTime}`;
}

/**
 * Notify students 30 minutes before today's scheduled lectures.
 */
export async function sendUpcomingLectureReminders(): Promise<void> {
  const dayOfWeek = getServerDayOfWeek();
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayStart = startOfToday();

  const allEntries = (await prisma.masterTimetable.findMany({
    where: { dayOfWeek, isActive: true },
    select: SLOT_SELECT,
  })) as TimetableEntry[];

  if (allEntries.length === 0) return;

  const latestPeriodByGroup = new Map<string, string>();
  for (const groupId of [...new Set(allEntries.map((e) => e.groupId))]) {
    const groupEntries = allEntries.filter((e) => e.groupId === groupId);
    const latest = pickLatestPeriodKey(groupEntries);
    if (latest) latestPeriodByGroup.set(groupId, latest);
  }

  const dueSlots = allEntries.filter((entry) => {
    const latest = latestPeriodByGroup.get(entry.groupId);
    if (latest && periodKey(entry) !== latest) return false;
    return isInReminderWindow(minutesUntilStart(entry.startTime, nowMinutes));
  });

  if (dueSlots.length === 0) return;

  const groupIds = [...new Set(dueSlots.map((s) => s.groupId))];
  const members = await prisma.studentGroupMember.findMany({
    where: { groupId: { in: groupIds } },
    select: { studentId: true, groupId: true },
  });

  const studentsByGroup = new Map<string, string[]>();
  for (const m of members) {
    const list = studentsByGroup.get(m.groupId) ?? [];
    list.push(m.studentId);
    studentsByGroup.set(m.groupId, list);
  }

  const studentIds = [...new Set(members.map((m) => m.studentId))];
  const sentKeys = await loadSentReminderKeys(studentIds, todayStart);

  let sentCount = 0;

  for (const slot of dueSlots) {
    const studentIdsForSlot = studentsByGroup.get(slot.groupId) ?? [];
    for (const studentId of studentIdsForSlot) {
      const key = `${studentId}:${slot.id}`;
      if (sentKeys.has(key)) continue;

      await createNotification({
        userId: studentId,
        type: 'LECTURE_REMINDER',
        title: 'Class in 30 minutes',
        message: buildReminderMessage(slot),
        metadata: {
          slotId: slot.id,
          groupId: slot.groupId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          courseCode: slot.course.code,
          courseName: slot.course.name,
          lecturerName: lecturerDisplayName(slot),
          hallName: slot.hall.name,
          hallBuilding: slot.hall.building,
        },
      });

      sentKeys.add(key);
      sentCount += 1;
    }
  }

  if (sentCount > 0) {
    console.log(`[LECSTU] Sent ${sentCount} lecture reminder(s) for ${dayOfWeek}`);
  }
}
