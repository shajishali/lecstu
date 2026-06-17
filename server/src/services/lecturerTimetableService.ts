import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { detectConflicts } from './conflictDetector';
import { lecturerCodesFromName } from './lecturerInitialsMatch';
import { invalidateAll } from './timetableCache';
import { notifyTimetableChange } from './notificationService';
import type { DayOfWeek } from '../generated/prisma/client';
import type { TimetableSlot } from './timetableService';

const SLOT_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  semester: true,
  year: true,
  month: true,
  week: true,
  lecturerInitials: true,
  notes: true,
  lecturerId: true,
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true, doorPassword: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getLecturerCodes(lecturerId: string): Promise<string[]> {
  const lecturer = await prisma.user.findUnique({
    where: { id: lecturerId },
    select: { firstName: true, lastName: true, timetableCode: true },
  });
  if (!lecturer) return [];
  return lecturerCodesFromName(lecturer.firstName, lecturer.lastName, lecturer.timetableCode);
}

function initialsMatch(codes: string[], initials: string | null | undefined): boolean {
  const raw = (initials || '').trim();
  if (!raw || codes.length === 0) return false;
  const upper = raw.toUpperCase();
  return codes.some((c) => c.toUpperCase() === upper);
}

export function lecturerOwnsMasterSlot(
  lecturerId: string,
  codes: string[],
  slot: { lecturerId: string; lecturerInitials: string | null },
): boolean {
  if (slot.lecturerId === lecturerId) return true;
  return initialsMatch(codes, slot.lecturerInitials);
}

async function resolveHallIdByName(hallName: string): Promise<string> {
  const trimmed = hallName.trim();
  if (!trimmed) throw new AppError('Place is required', 400);

  const existing = await prisma.lectureHall.findFirst({
    where: { name: { equals: trimmed, mode: 'insensitive' } },
  });
  if (existing) return existing.id;

  const { parseLectureHall } = await import('../../prisma/fct-faculty-config');
  const parsed = parseLectureHall(trimmed);
  const created = await prisma.lectureHall.create({
    data: {
      name: parsed.name,
      building: parsed.building,
      floor: parsed.floor,
      capacity: parsed.capacity,
      equipment: parsed.equipment,
    },
  });
  return created.id;
}

export async function fetchMasterEntriesForLecturer(lecturerId: string): Promise<TimetableSlot[]> {
  const codes = await getLecturerCodes(lecturerId);
  const orConditions: Array<{ lecturerId: string } | { lecturerInitials: { in: string[] } }> = [
    { lecturerId },
  ];
  if (codes.length > 0) {
    orConditions.push({ lecturerInitials: { in: codes } });
  }

  const entries = await prisma.masterTimetable.findMany({
    where: { isActive: true, OR: orConditions },
    select: SLOT_SELECT,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });

  return entries as TimetableSlot[];
}

/** Keep LecturerScheduleSlot TEACHING rows aligned with master timetable (for availability/booking). */
export async function syncTeachingScheduleFromMaster(lecturerId: string): Promise<void> {
  const flat = await fetchMasterEntriesForLecturer(lecturerId);

  await prisma.$transaction(async (tx) => {
    await tx.lecturerScheduleSlot.deleteMany({ where: { lecturerId, slotType: 'TEACHING' } });
    if (flat.length > 0) {
      await tx.lecturerScheduleSlot.createMany({
        data: flat.map((e) => ({
          lecturerId,
          dayOfWeek: e.dayOfWeek as DayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          slotType: 'TEACHING' as const,
          label: e.course.name,
          location: e.hall.name,
        })),
      });
    }
  });
}

export interface LecturerMasterSlotUpdate {
  dayOfWeek?: DayOfWeek;
  startTime?: string;
  endTime?: string;
  year?: number;
  month?: number;
  week?: number;
  courseName?: string;
  hallName?: string;
  hallDoorPassword?: string | null;
  notes?: string | null;
}

export async function updateLecturerMasterSlot(
  lecturerId: string,
  slotId: string,
  patch: LecturerMasterSlotUpdate,
): Promise<TimetableSlot> {
  const codes = await getLecturerCodes(lecturerId);
  const existing = await prisma.masterTimetable.findUnique({
    where: { id: slotId },
    select: { ...SLOT_SELECT, groupId: true },
  });
  if (!existing) throw new AppError('Timetable entry not found', 404);
  if (!lecturerOwnsMasterSlot(lecturerId, codes, existing)) {
    throw new AppError('You can only edit your own assigned lectures', 403);
  }

  const dayOfWeek = patch.dayOfWeek ?? existing.dayOfWeek;
  const startTime = patch.startTime ?? existing.startTime;
  const endTime = patch.endTime ?? existing.endTime;
  const year = patch.year ?? existing.year ?? 2026;
  const month = patch.month ?? existing.month ?? 1;
  const week = patch.week ?? existing.week ?? 1;

  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
    throw new AppError('Times must be HH:mm (24h)', 400);
  }
  if (startTime >= endTime) throw new AppError('Start time must be before end time', 400);
  if (month < 1 || month > 12) throw new AppError('Month must be between 1 and 12', 400);
  if (week < 1 || week > 53) throw new AppError('Week must be between 1 and 53', 400);

  let hallId = existing.hall.id;
  if (patch.hallName !== undefined) {
    hallId = await resolveHallIdByName(patch.hallName);
  }

  if (patch.hallDoorPassword !== undefined) {
    await prisma.lectureHall.update({
      where: { id: hallId },
      data: { doorPassword: patch.hallDoorPassword?.trim() || null },
    });
  }

  const conflicts = await detectConflicts({
    year,
    month,
    week,
    dayOfWeek,
    startTime,
    endTime,
    hallId,
    lecturerId: existing.lecturerId,
    groupId: existing.group.id,
    excludeId: slotId,
  });
  if (conflicts.length > 0) {
    throw new AppError(`Schedule conflict: ${conflicts[0].message}`, 409);
  }

  if (patch.courseName?.trim()) {
    await prisma.course.update({
      where: { id: existing.course.id },
      data: { name: patch.courseName.trim() },
    });
  }

  const updateData: {
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    year: number;
    month: number;
    week: number;
    hallId: string;
    notes?: string | null;
    lecturerId?: string;
  } = {
    dayOfWeek: dayOfWeek as DayOfWeek,
    startTime,
    endTime,
    year,
    month,
    week,
    hallId,
  };

  if (patch.notes !== undefined) {
    updateData.notes = patch.notes?.trim() || null;
  }
  if (existing.lecturerId !== lecturerId) {
    updateData.lecturerId = lecturerId;
  }

  const updated = await prisma.masterTimetable.update({
    where: { id: slotId },
    data: updateData,
    select: SLOT_SELECT,
  });

  await syncTeachingScheduleFromMaster(lecturerId);
  invalidateAll();
  await notifyTimetableChange([existing.group.id]);

  return updated as TimetableSlot;
}
