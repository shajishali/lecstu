import prisma from '../config/database';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';
import { getStudentTimetable, type TimetableSlot } from './timetableService';
import { resolveSlotOnlineFromGrid } from './timetableGridBuilder';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  getCampusDateIso,
  getCampusDayOfWeek,
  getCampusTimeStr,
  getCampusTimezone,
  isTimeInSlot,
  parseTimeToMinutes,
} from '../utils/campusTime';

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
  isNext: boolean;
  isUpcoming: boolean;
  isOnline: boolean;
}

export interface TodayOnCampusResult {
  date: string;
  dayOfWeek: string;
  slots: TodayCampusSlot[];
  hasMultipleLocations: boolean;
  locationCount: number;
  onlineCount: number;
  onCampusCount: number;
  hasOnlineClasses: boolean;
  hasOnCampusClasses: boolean;
  serverTime: string;
  campusTimezone: string;
}

export interface TodayNextClassResult {
  date: string;
  dayOfWeek: string;
  serverTime: string;
  campusTimezone: string;
  current: TodayCampusSlot | null;
  next: TodayCampusSlot | null;
  slots: TodayCampusSlot[];
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

function resolveSlotIsOnline(
  slot: TimetableSlot,
  grid: TimetableGridSnapshot | null,
): boolean {
  return resolveSlotOnlineFromGrid(grid, {
    dayOfWeek: slot.dayOfWeek,
    startTime: slot.startTime,
    endTime: slot.endTime,
    course: slot.course,
    hall: slot.hall,
    notes: slot.notes,
    lecturerInitials: slot.lecturerInitials,
  });
}

async function enrichTodaySlots(
  entries: TimetableSlot[],
  campusTime: string,
  grid: TimetableGridSnapshot | null,
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

  const nowMinutes = parseTimeToMinutes(campusTime);
  const slots = entries.map((slot) => {
    const mapB = resolveMapBuilding(slot.hall.building, mapBuildings);
    const marker = markerByHall.get(slot.hall.id);
    const floor = marker?.floor ?? 0;
    const startMinutes = parseTimeToMinutes(slot.startTime);
    const isNow = isTimeInSlot(campusTime, slot.startTime, slot.endTime);
    const isUpcoming = nowMinutes < startMinutes;

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
        floor: marker?.floor ?? 0,
      },
      mapBuildingId: mapB?.id ?? marker?.buildingId ?? null,
      mapBuildingName: mapB?.name ?? null,
      mapBuildingCode: mapB?.code ?? null,
      markerId: marker?.id ?? null,
      floor,
      isNow,
      isNext: false,
      isUpcoming,
      isOnline: resolveSlotIsOnline(slot, grid),
    };
  });

  const hasCurrent = slots.some((s) => s.isNow);
  if (hasCurrent) return slots;

  const nextSlot = slots.find((s) => parseTimeToMinutes(s.startTime) > nowMinutes);
  if (!nextSlot) return slots;

  return slots.map((s) => ({ ...s, isNext: s.id === nextSlot.id }));
}

async function getTodayRawSlots(studentId: string): Promise<{
  dayOfWeek: string;
  campusTime: string;
  entries: TimetableSlot[];
  grid: TimetableGridSnapshot | null;
}> {
  const dayOfWeek = getCampusDayOfWeek();
  const campusTime = getCampusTimeStr();
  const { flat, grid } = await getStudentTimetable(studentId);
  const gridSnapshot = grid ?? null;

  if (flat.length === 0) {
    return { dayOfWeek, campusTime, entries: [], grid: gridSnapshot };
  }

  const period = pickLatestPeriodKey(flat);
  const entries = flat
    .filter((s) => s.dayOfWeek === dayOfWeek && (!period || periodKey(s) === period))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return { dayOfWeek, campusTime, entries, grid: gridSnapshot };
}

export async function getStudentTodayOnCampus(studentId: string): Promise<TodayOnCampusResult> {
  const { dayOfWeek, campusTime, entries, grid } = await getTodayRawSlots(studentId);
  const slots = await enrichTodaySlots(entries, campusTime, grid);

  const onCampusSlots = slots.filter((s) => !s.isOnline);
  const locationKeys = new Set(onCampusSlots.map((s) => `${s.hall.building}|${s.hall.id}`));
  const onlineCount = slots.filter((s) => s.isOnline).length;
  const onCampusCount = slots.length - onlineCount;

  return {
    date: getCampusDateIso(),
    dayOfWeek,
    slots,
    hasMultipleLocations: locationKeys.size >= 2,
    locationCount: locationKeys.size,
    onlineCount,
    onCampusCount,
    hasOnlineClasses: onlineCount > 0,
    hasOnCampusClasses: onCampusCount > 0,
    serverTime: campusTime,
    campusTimezone: getCampusTimezone(),
  };
}

export async function getStudentTodayNextClass(studentId: string): Promise<TodayNextClassResult> {
  const { dayOfWeek, campusTime, entries, grid } = await getTodayRawSlots(studentId);
  const slots = await enrichTodaySlots(entries, campusTime, grid);

  let current: TodayCampusSlot | null = null;
  let next: TodayCampusSlot | null = null;
  const nowMinutes = parseTimeToMinutes(campusTime);

  for (const s of slots) {
    if (isTimeInSlot(campusTime, s.startTime, s.endTime)) {
      current = s;
    }
  }

  if (!current) {
    next = slots.find((s) => parseTimeToMinutes(s.startTime) > nowMinutes) ?? null;
  } else {
    const idx = slots.findIndex((s) => s.id === current!.id);
    next =
      slots.slice(idx + 1).find((s) => parseTimeToMinutes(s.startTime) > nowMinutes) ?? null;
  }

  return {
    date: getCampusDateIso(),
    dayOfWeek,
    serverTime: campusTime,
    campusTimezone: getCampusTimezone(),
    current,
    next: next ?? (!current ? slots.find((s) => parseTimeToMinutes(s.startTime) > nowMinutes) ?? null : null),
    slots,
  };
}
