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

function computeFreeSlots(occupied: { startTime: string; endTime: string }[], dayStart = DAY_START, dayEnd = DAY_END): FreeSlot[] {
  const sorted = [...occupied].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const free: FreeSlot[] = [];
  let cursor = timeToMinutes(dayStart);
  const end = timeToMinutes(dayEnd);

  for (const slot of sorted) {
    const slotStart = timeToMinutes(slot.startTime);
    if (slotStart > cursor) {
      free.push({
        startTime: minutesToTime(cursor),
        endTime: slot.startTime,
        durationMinutes: slotStart - cursor,
      });
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

export async function getHallDaySchedule(hallId: string, day: string): Promise<HallSchedule> {
  const hall = await prisma.lectureHall.findUnique({ where: { id: hallId } });
  if (!hall) throw new Error('Hall not found');

  const entries = await prisma.masterTimetable.findMany({
    where: { hallId, dayOfWeek: day as any, isActive: true },
    select: TIMETABLE_SELECT,
    orderBy: { startTime: 'asc' },
  });

  return {
    hall: {
      id: hall.id,
      name: hall.name,
      building: hall.building,
      floor: hall.floor,
      capacity: hall.capacity,
      equipment: hall.equipment,
    },
    occupied: entries as unknown as OccupiedSlot[],
    freeSlots: computeFreeSlots(entries),
  };
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

  if (['SATURDAY', 'SUNDAY'].includes(day)) {
    const halls = await prisma.lectureHall.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return halls.map((h) => ({
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

  const results: AvailableHallResult[] = [];

  for (const hall of halls) {
    const occupied = occupancyMap.get(hall.id) || [];
    const isBusy = occupied.some((s) => s.startTime <= now && s.endTime > now);

    if (!isBusy) {
      const freeSlots = computeFreeSlots(occupied);
      const currentSlot = freeSlots.find((fs) => fs.startTime <= now && fs.endTime > now);
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
        matchingFreeSlots: currentSlot ? [currentSlot] : freeSlots,
      });
    }
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
