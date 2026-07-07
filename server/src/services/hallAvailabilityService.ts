import prisma from '../config/database';

interface OccupiedSlot {
  id: string;
  startTime: string;
  endTime: string;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string };
  group: { id: string; name: string };
}

interface FreeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface HallSchedule {
  hall: {
    id: string;
    name: string;
    building: string;
    floor: number;
    capacity: number;
    equipment: string[];
  };
  occupied: OccupiedSlot[];
  freeSlots: FreeSlot[];
}

const TIMETABLE_SELECT = {
  id: true,
  startTime: true,
  endTime: true,
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true } },
  group: { select: { id: true, name: true } },
};

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

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mergeOccupiedSlots(
  slots: { startTime: string; endTime: string }[]
): { startTime: string; endTime: string }[] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const merged: { startTime: string; endTime: string }[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (timeToMinutes(next.startTime) <= timeToMinutes(current.endTime)) {
      if (timeToMinutes(next.endTime) > timeToMinutes(current.endTime)) {
        current.endTime = next.endTime;
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function computeFreeSlots(occupied: { startTime: string; endTime: string }[], dayStart = DAY_START, dayEnd = DAY_END): FreeSlot[] {
  const merged = mergeOccupiedSlots(occupied);
  const sorted = [...merged].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const free: FreeSlot[] = [];
  let cursor = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);

  for (const slot of sorted) {
    const slotStart = timeToMinutes(slot.startTime);
    if (slotStart > cursor) {
      const durationMinutes = slotStart - cursor;
      if (durationMinutes > 0) {
        free.push({
          startTime: minutesToTime(cursor),
          endTime: slot.startTime,
          durationMinutes,
        });
      }
    }
    const slotEnd = timeToMinutes(slot.endTime);
    if (slotEnd > cursor) cursor = slotEnd;
  }

  if (cursor < end) {
    free.push({
      startTime: minutesToTime(cursor),
      endTime: dayEnd,
      durationMinutes: end - cursor,
    });
  }

  return free;
}

function getCurrentDayOfWeek(): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date().getDay()];
}

function getCurrentTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Get date string (YYYY-MM-DD) for the next occurrence of dayOfWeek (MONDAY=1, etc.) */
function getNextDateForDay(dayOfWeek: string): string {
  const dayMap: Record<string, number> = {
    SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
  };
  const target = dayMap[dayOfWeek.toUpperCase()] ?? 1;
  const today = new Date();
  const todayNum = today.getDay();
  let daysAhead = target - todayNum;
  if (daysAhead <= 0) daysAhead += 7;
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  return toLocalDateString(d);
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getUpcomingWeekdays(count = 5): { day: string; date: string }[] {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const result: { day: string; date: string }[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (result.length < count) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) {
      result.push({
        day: dayNames[dow],
        date: toLocalDateString(cursor),
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

async function getOccupiedSlotsForHallDay(
  hallId: string,
  day: string,
  date?: string
): Promise<OccupiedSlot[]> {
  const entries = await prisma.masterTimetable.findMany({
    where: { hallId, dayOfWeek: day as any, isActive: true },
    select: TIMETABLE_SELECT,
    orderBy: { startTime: 'asc' },
  });

  const occupied: OccupiedSlot[] = [...(entries as unknown as OccupiedSlot[])];

  if (date) {
    const dateStart = parseDateOnly(date);
    const dateEnd = new Date(dateStart);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const bookings = await prisma.hallBooking.findMany({
      where: {
        hallId,
        date: { gte: dateStart, lt: dateEnd },
        status: 'APPROVED',
      },
      select: { id: true, startTime: true, endTime: true, reason: true },
      orderBy: { startTime: 'asc' },
    });

    for (const b of bookings) {
      occupied.push({
        id: b.id,
        startTime: b.startTime,
        endTime: b.endTime,
        course: { id: 'booking', name: 'Hall Booking', code: 'BOOKED' },
        lecturer: { id: '', firstName: 'Student', lastName: 'Booking' },
        group: { id: '', name: b.reason || 'Reserved' },
      });
    }
  }

  return occupied.sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function getHallDaySchedule(
  hallId: string,
  day: string,
  date?: string
): Promise<HallSchedule> {
  const hall = await prisma.lectureHall.findUnique({ where: { id: hallId } });
  if (!hall) throw new Error('Hall not found');

  const occupied = await getOccupiedSlotsForHallDay(hallId, day, date);

  return {
    hall: {
      id: hall.id,
      name: hall.name,
      building: hall.building,
      floor: hall.floor,
      capacity: hall.capacity,
      equipment: hall.equipment,
    },
    occupied,
    freeSlots: computeFreeSlots(occupied),
  };
}

export interface DaySchedule {
  day: string;
  date: string;
  occupied: OccupiedSlot[];
  freeSlots: FreeSlot[];
}

export interface WeeklySchedule {
  hall: HallSchedule['hall'];
  days: DaySchedule[];
}

export async function getHallWeeklySchedule(hallId: string): Promise<WeeklySchedule> {
  const hall = await prisma.lectureHall.findUnique({ where: { id: hallId } });
  if (!hall) throw new Error('Hall not found');

  const weekdays = getUpcomingWeekdays(5);
  const days: DaySchedule[] = [];

  for (const { day, date } of weekdays) {
    const occupied = await getOccupiedSlotsForHallDay(hallId, day, date);
    days.push({
      day,
      date,
      occupied,
      freeSlots: computeFreeSlots(occupied),
    });
  }

  return {
    hall: {
      id: hall.id,
      name: hall.name,
      building: hall.building,
      floor: hall.floor,
      capacity: hall.capacity,
      equipment: hall.equipment,
    },
    days,
  };
}

export async function listActiveHalls(): Promise<HallSchedule['hall'][]> {
  const halls = await prisma.lectureHall.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      building: true,
      floor: true,
      capacity: true,
      equipment: true,
    },
  });
  return halls;
}

interface AvailableQuery {
  day: string;
  startTime?: string;
  endTime?: string;
  minCapacity?: number;
  building?: string;
  equipment?: string;
}

export interface AvailableHallResult {
  hall: {
    id: string;
    name: string;
    building: string;
    floor: number;
    capacity: number;
    equipment: string[];
  };
  freeSlots: FreeSlot[];
  matchingFreeSlots: FreeSlot[];
}

export async function findAvailableHalls(query: AvailableQuery): Promise<AvailableHallResult[]> {
  const hallWhere: any = { isActive: true };
  if (query.minCapacity) hallWhere.capacity = { gte: query.minCapacity };
  if (query.building) hallWhere.building = { equals: query.building, mode: 'insensitive' };

  let halls = await prisma.lectureHall.findMany({
    where: hallWhere,
    orderBy: { name: 'asc' },
  });

  if (query.equipment) {
    const reqEquip = query.equipment.split(',').map((e) => e.trim().toLowerCase());
    halls = halls.filter((h) =>
      reqEquip.every((req) => h.equipment.some((eq) => eq.toLowerCase().includes(req)))
    );
  }

  const hallIds = halls.map((h) => h.id);

  const entries = await prisma.masterTimetable.findMany({
    where: {
      hallId: { in: hallIds },
      dayOfWeek: query.day as any,
      isActive: true,
    },
    select: { hallId: true, startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });

  const occupancyMap = new Map<string, { startTime: string; endTime: string }[]>();
  for (const e of entries) {
    if (!occupancyMap.has(e.hallId)) occupancyMap.set(e.hallId, []);
    occupancyMap.get(e.hallId)!.push({ startTime: e.startTime, endTime: e.endTime });
  }

  const targetDate = getNextDateForDay(query.day);
  const targetDateStart = new Date(targetDate);
  targetDateStart.setHours(0, 0, 0, 0);
  const targetDateEnd = new Date(targetDateStart);
  targetDateEnd.setDate(targetDateEnd.getDate() + 1);
  const hallBookings = await prisma.hallBooking.findMany({
    where: {
      hallId: { in: hallIds },
      date: { gte: targetDateStart, lt: targetDateEnd },
      status: 'APPROVED',
    },
    select: { hallId: true, startTime: true, endTime: true },
  });
  for (const b of hallBookings) {
    if (!occupancyMap.has(b.hallId)) occupancyMap.set(b.hallId, []);
    occupancyMap.get(b.hallId)!.push({ startTime: b.startTime, endTime: b.endTime });
  }

  const results: AvailableHallResult[] = [];

  for (const hall of halls) {
    const occupied = occupancyMap.get(hall.id) || [];
    const freeSlots = computeFreeSlots(occupied);

    let matchingFreeSlots = freeSlots;
    if (query.startTime && query.endTime) {
      const qStart = timeToMinutes(query.startTime);
      const qEnd = timeToMinutes(query.endTime);
      matchingFreeSlots = freeSlots.filter((fs) => {
        const fsStart = timeToMinutes(fs.startTime);
        const fsEnd = timeToMinutes(fs.endTime);
        return fsStart <= qStart && fsEnd >= qEnd;
      });
    }

    if (matchingFreeSlots.length > 0) {
      results.push({
        hall: {
          id: hall.id,
          name: hall.name,
          building: hall.building,
          floor: hall.floor,
          capacity: hall.capacity,
          equipment: hall.equipment,
        },
        freeSlots,
        matchingFreeSlots,
      });
    }
  }

  return results;
}

export async function findAvailableNow(): Promise<AvailableHallResult[]> {
  const day = getCurrentDayOfWeek();
  const now = getCurrentTime();

  const today = new Date();
  const dateStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dateEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (['SATURDAY', 'SUNDAY'].includes(day)) {
    const halls = await prisma.lectureHall.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    const hallIds = halls.map((h) => h.id);
    const hallBookings = await prisma.hallBooking.findMany({
      where: {
        hallId: { in: hallIds },
        date: { gte: dateStart, lt: dateEnd },
        status: 'APPROVED',
      },
      select: { hallId: true },
    });
    const bookedHallIds = new Set(hallBookings.map((b) => b.hallId));
    return halls
      .filter((h) => !bookedHallIds.has(h.id))
      .map((h) => ({
        hall: {
          id: h.id,
          name: h.name,
          building: h.building,
          floor: h.floor,
          capacity: h.capacity,
          equipment: h.equipment,
        },
        freeSlots: [{ startTime: DAY_START, endTime: DAY_END, durationMinutes: 600 }],
        matchingFreeSlots: [{ startTime: DAY_START, endTime: DAY_END, durationMinutes: 600 }],
      }));
  }

  const halls = await prisma.lectureHall.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const hallIds = halls.map((h) => h.id);

  const entries = await prisma.masterTimetable.findMany({
    where: {
      hallId: { in: hallIds },
      dayOfWeek: day as any,
      isActive: true,
    },
    select: { hallId: true, startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });

  const occupancyMap = new Map<string, { startTime: string; endTime: string }[]>();
  for (const e of entries) {
    if (!occupancyMap.has(e.hallId)) occupancyMap.set(e.hallId, []);
    occupancyMap.get(e.hallId)!.push({ startTime: e.startTime, endTime: e.endTime });
  }

  const hallBookings = await prisma.hallBooking.findMany({
    where: {
      hallId: { in: hallIds },
      date: { gte: dateStart, lt: dateEnd },
      status: 'APPROVED',
    },
    select: { hallId: true, startTime: true, endTime: true },
  });
  for (const b of hallBookings) {
    if (!occupancyMap.has(b.hallId)) occupancyMap.set(b.hallId, []);
    occupancyMap.get(b.hallId)!.push({ startTime: b.startTime, endTime: b.endTime });
  }

  const results: AvailableHallResult[] = [];

  for (const hall of halls) {
    const occupied = occupancyMap.get(hall.id) || [];
    const freeSlots = computeFreeSlots(occupied);
    const currentSlot = freeSlots.find((fs) => fs.startTime <= now && fs.endTime > now);
    if (!currentSlot) continue;

    results.push({
      hall: {
        id: hall.id,
        name: hall.name,
        building: hall.building,
        floor: hall.floor,
        capacity: hall.capacity,
        equipment: hall.equipment,
      },
      freeSlots,
      matchingFreeSlots: [currentSlot],
    });
  }

  return results;
}

export async function getFilterOptions(): Promise<{ buildings: string[]; equipment: string[] }> {
  const halls = await prisma.lectureHall.findMany({
    where: { isActive: true },
    select: { building: true, equipment: true },
  });

  const buildings = [...new Set(halls.map((h) => h.building))].sort();
  const equipment = [...new Set(halls.flatMap((h) => h.equipment))].sort();

  return { buildings, equipment };
}
