import prisma from '../config/database';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';
import { getStudentTimetable, type TimetableSlot } from './timetableService';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';

const DAY_ORDER = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export interface TodayCampusSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  course: { id: string; name: string; code: string };
  lecturerName: string;
  lecturerId: string;
  hall: { id: string; name: string; building: string; floor: number };
  mapBuildingId: string | null;
  mapBuildingName: string | null;
  mapBuildingCode: string | null;
  markerId: string | null;
  floor: number;
  isNow: boolean;
  isUpcoming: boolean;
}

export interface TodayOnCampusResult {
  date: string;
  dayOfWeek: string;
  slots: TodayCampusSlot[];
  hasMultipleLocations: boolean;
  locationCount: number;
  serverTime: string;
}

export interface TodayNextClassResult {
  date: string;
  dayOfWeek: string;
  serverTime: string;
  current: TodayCampusSlot | null;
  next: TodayCampusSlot | null;
  slots: TodayCampusSlot[];
}

function getServerDayOfWeek(): string {
  return DAY_ORDER[new Date().getDay()];
}

function getServerTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getServerDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodKey(slot: TimetableSlot): string {
  return `${slot.year}-${slot.month}-${slot.week}`;
}

function pickLatestPeriodKey(flat: TimetableSlot[]): string | null {
  const keys = [...new Set(flat.map(periodKey))];
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

function lecturerDisplayName(slot: TimetableSlot): string {
  if (slot.lecturerInitials?.trim()) return slot.lecturerInitials.trim();
  if (slot.lecturer.email === UNASSIGNED_LECTURER_EMAIL) return 'TBD';
  return `${slot.lecturer.firstName} ${slot.lecturer.lastName}`.trim() || 'TBD';
}

function resolveMapBuilding(
  hallBuilding: string,
  mapBuildings: { id: string; name: string; code: string }[]
) {
  const norm = hallBuilding.trim().toLowerCase();
  if (!norm) return null;

  for (const b of mapBuildings) {
    const def = getFacultyBuildingByCode(b.code);
    const labels = [b.name, b.code, def?.hallBuildingLabel, def?.name].filter(Boolean) as string[];
    for (const label of labels) {
      const l = label.toLowerCase();
      if (norm.includes(l) || l.includes(norm)) return b;
    }
  }
  return null;
}

async function enrichTodaySlots(
  entries: TimetableSlot[],
  serverTime: string
): Promise<TodayCampusSlot[]> {
  const mapBuildings = await prisma.mapBuilding.findMany({
    select: { id: true, name: true, code: true },
  });
  const hallIds = [...new Set(entries.map((e) => e.hall.id))];
  const markers =
    hallIds.length > 0
      ? await prisma.mapMarker.findMany({
          where: { hallId: { in: hallIds } },
          select: { id: true, hallId: true, buildingId: true, floor: true },
        })
      : [];
  const markerByHall = new Map(
    markers.filter((m) => m.hallId).map((m) => [m.hallId!, m])
  );

  return entries.map((slot) => {
    const mapB = resolveMapBuilding(slot.hall.building, mapBuildings);
    const marker = markerByHall.get(slot.hall.id);
    const floor = marker?.floor ?? slot.hall.floor ?? 0;
    const isNow = slot.startTime <= serverTime && serverTime < slot.endTime;
    const isUpcoming = serverTime < slot.startTime;

    return {
      id: slot.id,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      course: slot.course,
      lecturerName: lecturerDisplayName(slot),
      lecturerId: slot.lecturer.id,
      hall: {
        id: slot.hall.id,
        name: slot.hall.name,
        building: slot.hall.building,
        floor: slot.hall.floor,
      },
      mapBuildingId: mapB?.id ?? marker?.buildingId ?? null,
      mapBuildingName: mapB?.name ?? null,
      mapBuildingCode: mapB?.code ?? null,
      markerId: marker?.id ?? null,
      floor,
      isNow,
      isUpcoming,
    };
  });
}

async function getTodayRawSlots(studentId: string): Promise<{
  dayOfWeek: string;
  serverTime: string;
  entries: TimetableSlot[];
}> {
  const dayOfWeek = getServerDayOfWeek();
  const serverTime = getServerTimeStr();
  const { flat } = await getStudentTimetable(studentId);

  if (flat.length === 0) {
    return { dayOfWeek, serverTime, entries: [] };
  }

  const period = pickLatestPeriodKey(flat);
  const entries = flat
    .filter((s) => s.dayOfWeek === dayOfWeek && (!period || periodKey(s) === period))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return { dayOfWeek, serverTime, entries };
}

export async function getStudentTodayOnCampus(studentId: string): Promise<TodayOnCampusResult> {
  const { dayOfWeek, serverTime, entries } = await getTodayRawSlots(studentId);
  const slots = await enrichTodaySlots(entries, serverTime);

  const locationKeys = new Set(slots.map((s) => `${s.hall.building}|${s.hall.id}`));

  return {
    date: getServerDateIso(),
    dayOfWeek,
    slots,
    hasMultipleLocations: locationKeys.size >= 2,
    locationCount: locationKeys.size,
    serverTime,
  };
}

export async function getStudentTodayNextClass(studentId: string): Promise<TodayNextClassResult> {
  const { dayOfWeek, serverTime, entries } = await getTodayRawSlots(studentId);
  const slots = await enrichTodaySlots(entries, serverTime);

  let current: TodayCampusSlot | null = null;
  let next: TodayCampusSlot | null = null;

  for (const s of slots) {
    if (s.startTime <= serverTime && serverTime < s.endTime) {
      current = s;
    }
  }

  if (!current) {
    next = slots.find((s) => s.startTime > serverTime) ?? null;
  } else {
    const idx = slots.findIndex((s) => s.id === current!.id);
    next = slots.slice(idx + 1).find((s) => s.startTime > serverTime) ?? null;
  }

  return {
    date: getServerDateIso(),
    dayOfWeek,
    serverTime,
    current,
    next: next ?? (!current ? slots.find((s) => s.startTime > serverTime) ?? null : null),
    slots,
  };
}
