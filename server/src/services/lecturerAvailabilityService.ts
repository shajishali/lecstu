import prisma from '../config/database';
import { isFetVirtualLecturerId } from './lecturerDirectoryService';
import { getLecturerBusySlots } from './lecturerScheduleService';

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface ScheduleSlot extends TimeSlot {
  slotType: string;
  label: string | null;
  location: string | null;
}

interface AppointmentSlot extends TimeSlot {
  id: string;
  status: string;
  studentName: string;
}

export interface DayAvailability {
  day: string;
  /** Lecturer-managed busy/teaching blocks (not from FET import) */
  schedule: ScheduleSlot[];
  appointments: AppointmentSlot[];
  freeSlots: TimeSlot[];
}

export type WeeklyAvailability = DayAvailability[];

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_START = '08:00';
const DAY_END = '18:00';

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function computeFreeSlots(occupied: TimeSlot[]): TimeSlot[] {
  const sorted = [...occupied].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const free: TimeSlot[] = [];
  let cursor = timeToMinutes(DAY_START);
  const end = timeToMinutes(DAY_END);

  for (const slot of sorted) {
    const slotStart = timeToMinutes(slot.startTime);
    if (slotStart > cursor) {
      free.push({ startTime: minutesToTime(cursor), endTime: slot.startTime });
    }
    const slotEnd = timeToMinutes(slot.endTime);
    if (slotEnd > cursor) cursor = slotEnd;
  }

  if (cursor < end) {
    free.push({ startTime: minutesToTime(cursor), endTime: DAY_END });
  }

  return free;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getLecturerWeeklyAvailability(lecturerId: string): Promise<WeeklyAvailability> {
  if (isFetVirtualLecturerId(lecturerId)) {
    return DAYS.map((day) => ({ day, schedule: [], appointments: [], freeSlots: [] }));
  }

  const scheduleRows = await getLecturerBusySlots(lecturerId);
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 5);

  const appointments = await prisma.appointment.findMany({
    where: {
      lecturerId,
      status: { in: ['ACCEPTED', 'SCHEDULED', 'PENDING', 'CANCELLATION_REQUESTED'] },
      dateTime: { gte: startOfWeek, lt: endOfWeek },
    },
    select: {
      id: true,
      dateTime: true,
      duration: true,
      status: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dateTime: 'asc' },
  });

  const result: WeeklyAvailability = [];

  for (const day of DAYS) {
    const daySchedule = scheduleRows
      .filter((e) => e.dayOfWeek === day)
      .map((e) => ({
        startTime: e.startTime,
        endTime: e.endTime,
        slotType: e.slotType,
        label: e.label,
        location: e.location,
      }));

    const dayIdx = DAYS.indexOf(day);
    const dayAppts = appointments
      .filter((a) => {
        const d = new Date(a.dateTime);
        return d.getDay() === dayIdx + 1;
      })
      .map((a) => {
        const dt = new Date(a.dateTime);
        const startMin = dt.getHours() * 60 + dt.getMinutes();
        const endMin = startMin + a.duration;
        return {
          id: a.id,
          startTime: minutesToTime(startMin),
          endTime: minutesToTime(endMin),
          status: a.status,
          studentName: `${a.student.firstName} ${a.student.lastName}`,
        };
      });

    const allOccupied: TimeSlot[] = [
      ...daySchedule.map((t) => ({ startTime: t.startTime, endTime: t.endTime })),
      ...dayAppts.map((a) => ({ startTime: a.startTime, endTime: a.endTime })),
    ];

    result.push({
      day,
      schedule: daySchedule,
      appointments: dayAppts,
      freeSlots: computeFreeSlots(allOccupied),
    });
  }

  return result;
}

export async function getLecturerDateAvailability(
  lecturerId: string,
  date: string,
): Promise<DayAvailability> {
  const targetDate = new Date(date);
  const jsDay = targetDate.getDay();
  const dayName = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][jsDay];

  if (isFetVirtualLecturerId(lecturerId)) {
    return { day: dayName, schedule: [], appointments: [], freeSlots: [] };
  }

  const scheduleRows = await getLecturerBusySlots(lecturerId, dayName as never);
  const schedule = scheduleRows.map((e) => ({
    startTime: e.startTime,
    endTime: e.endTime,
    slotType: e.slotType,
    label: e.label,
    location: e.location,
  }));

  const dayStart = new Date(targetDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(targetDate);
  dayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      lecturerId,
      status: { in: ['ACCEPTED', 'SCHEDULED', 'PENDING', 'CANCELLATION_REQUESTED'] },
      dateTime: { gte: dayStart, lte: dayEnd },
    },
    select: {
      id: true,
      dateTime: true,
      duration: true,
      status: true,
      student: { select: { firstName: true, lastName: true } },
    },
    orderBy: { dateTime: 'asc' },
  });

  const dayAppts = appointments.map((a) => {
    const dt = new Date(a.dateTime);
    const startMin = dt.getHours() * 60 + dt.getMinutes();
    const endMin = startMin + a.duration;
    return {
      id: a.id,
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(endMin),
      status: a.status,
      studentName: `${a.student.firstName} ${a.student.lastName}`,
    };
  });

  const allOccupied: TimeSlot[] = [
    ...schedule.map((t) => ({ startTime: t.startTime, endTime: t.endTime })),
    ...dayAppts.map((a) => ({ startTime: a.startTime, endTime: a.endTime })),
  ];

  return {
    day: dayName,
    schedule,
    appointments: dayAppts,
    freeSlots: computeFreeSlots(allOccupied),
  };
}
