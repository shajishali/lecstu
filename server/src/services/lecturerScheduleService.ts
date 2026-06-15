import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import type { DayOfWeek, LecturerSlotType } from '../generated/prisma/client';

export interface ScheduleSlotInput {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotType?: LecturerSlotType;
  label?: string | null;
  location?: string | null;
}

export interface ScheduleSlotDto {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotType: LecturerSlotType;
  label: string | null;
  location: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function validateSlotInput(slot: ScheduleSlotInput, index: number): void {
  if (!TIME_RE.test(slot.startTime) || !TIME_RE.test(slot.endTime)) {
    throw new AppError(`Slot ${index + 1}: times must be HH:mm (24h)`, 400);
  }
  if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
    throw new AppError(`Slot ${index + 1}: end time must be after start time`, 400);
  }
}

function slotsOverlap(a: ScheduleSlotInput, b: ScheduleSlotInput): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aStart = timeToMinutes(a.startTime);
  const aEnd = timeToMinutes(a.endTime);
  const bStart = timeToMinutes(b.startTime);
  const bEnd = timeToMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

export async function listLecturerScheduleSlots(lecturerId: string): Promise<ScheduleSlotDto[]> {
  const rows = await prisma.lecturerScheduleSlot.findMany({
    where: { lecturerId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    slotType: r.slotType,
    label: r.label,
    location: r.location,
  }));
}

export async function replaceLecturerSchedule(
  lecturerId: string,
  slots: ScheduleSlotInput[],
): Promise<ScheduleSlotDto[]> {
  for (let i = 0; i < slots.length; i++) {
    validateSlotInput(slots[i], i);
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) {
        throw new AppError(
          `Overlapping slots on ${slots[i].dayOfWeek}: ${slots[i].startTime}–${slots[i].endTime} and ${slots[j].startTime}–${slots[j].endTime}`,
          400,
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.lecturerScheduleSlot.deleteMany({ where: { lecturerId } });
    if (slots.length > 0) {
      await tx.lecturerScheduleSlot.createMany({
        data: slots.map((s) => ({
          lecturerId,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          slotType: s.slotType ?? 'BUSY',
          label: s.label?.trim() || null,
          location: s.location?.trim() || null,
        })),
      });
    }
  });

  return listLecturerScheduleSlots(lecturerId);
}

/** Slots that block student booking (teaching + busy; not office hours alone). */
export async function getLecturerBusySlots(lecturerId: string, dayOfWeek?: DayOfWeek) {
  return prisma.lecturerScheduleSlot.findMany({
    where: {
      lecturerId,
      slotType: { in: ['TEACHING', 'BUSY'] },
      ...(dayOfWeek ? { dayOfWeek } : {}),
    },
    select: { dayOfWeek: true, startTime: true, endTime: true, slotType: true, label: true, location: true },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
}
