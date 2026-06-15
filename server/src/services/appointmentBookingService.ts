import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

const MIN_NOTICE_HOURS = 24;
const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function getDayOfWeek(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Validates that a booking can be created.
 * - Lecturer must be free (no teaching, no other ACCEPTED/PENDING appointment)
 * - Student must have no conflicting appointment
 * - Cannot book in the past
 * - Must respect minimum notice period (24 hours)
 */
export async function validateBooking(
  lecturerId: string,
  studentId: string,
  dateTime: Date,
  duration: number,
  excludeAppointmentId?: string
): Promise<void> {
  // 1. Prevent booking in the past
  const now = new Date();
  if (dateTime < now) {
    throw new AppError('Cannot book an appointment in the past', 400);
  }

  // 2. Enforce minimum notice period (24 hours ahead)
  const minTime = new Date(now.getTime() + MIN_NOTICE_HOURS * 60 * 60 * 1000);
  if (dateTime < minTime) {
    throw new AppError(
      `Appointments must be booked at least ${MIN_NOTICE_HOURS} hours in advance`,
      400
    );
  }

  // 3. Lecturer must exist and have LECTURER role
  const lecturer = await prisma.user.findFirst({
    where: { id: lecturerId, role: 'LECTURER', isActive: true },
  });
  if (!lecturer) {
    throw new AppError('Lecturer not found', 404);
  }

  // 4. Student cannot book with self
  if (lecturerId === studentId) {
    throw new AppError('Cannot book an appointment with yourself', 400);
  }

  const endTime = new Date(dateTime.getTime() + duration * 60 * 1000);
  const dayOfWeek = getDayOfWeek(dateTime);
  const startTimeStr = formatTime(dateTime);
  const endTimeStr = formatTime(endTime);
  const startMinutes = timeToMinutes(startTimeStr);
  const endMinutes = timeToMinutes(endTimeStr);

  // 5. Check lecturer busy/teaching blocks (lecturer-managed schedule, not FET import)
  const busySlots = await prisma.lecturerScheduleSlot.findMany({
    where: {
      lecturerId,
      dayOfWeek: dayOfWeek as never,
      slotType: { in: ['TEACHING', 'BUSY'] },
    },
    select: { startTime: true, endTime: true, label: true },
  });

  for (const slot of busySlots) {
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    if (startMinutes < slotEnd && endMinutes > slotStart) {
      const hint = slot.label ? ` (${slot.label})` : '';
      throw new AppError(
        `Lecturer is unavailable at ${slot.startTime}–${slot.endTime} on that day${hint}`,
        400,
      );
    }
  }

  // 6. Check lecturer other appointments
  const lecturerAppointments = await prisma.appointment.findMany({
    where: {
      lecturerId,
      status: { in: ['ACCEPTED', 'SCHEDULED', 'PENDING', 'CANCELLATION_REQUESTED'] },
      dateTime: { lt: endTime },
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
    },
    select: { id: true, dateTime: true, duration: true },
  });

  for (const appt of lecturerAppointments) {
    const apptStart = appt.dateTime.getTime();
    const apptEnd = apptStart + appt.duration * 60 * 1000;
    const reqStart = dateTime.getTime();
    const reqEnd = dateTime.getTime() + duration * 60 * 1000;
    if (reqStart < apptEnd && reqEnd > apptStart) {
      throw new AppError(
        'Lecturer has another appointment at that time',
        400
      );
    }
  }

  // 7. Check student conflicting appointment
  const studentAppointments = await prisma.appointment.findMany({
    where: {
      studentId,
      status: { in: ['ACCEPTED', 'SCHEDULED', 'PENDING', 'CANCELLATION_REQUESTED'] },
      dateTime: { lt: endTime },
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
    },
    select: { dateTime: true, duration: true },
  });

  for (const appt of studentAppointments) {
    const apptStart = appt.dateTime.getTime();
    const apptEnd = apptStart + appt.duration * 60 * 1000;
    const reqStart = dateTime.getTime();
    const reqEnd = dateTime.getTime() + duration * 60 * 1000;
    if (reqStart < apptEnd && reqEnd > apptStart) {
      throw new AppError(
        'You already have a conflicting appointment at that time',
        400
      );
    }
  }
}

/** Valid status transitions */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_ADMIN: ['PENDING', 'REJECTED'], // admin approves→PENDING (lecturer sees), rejects→REJECTED
  PENDING: ['ACCEPTED', 'SCHEDULED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['SCHEDULED', 'COMPLETED', 'CANCELLATION_REQUESTED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'CANCELLATION_REQUESTED', 'CANCELLED'],
  CANCELLATION_REQUESTED: ['CANCELLED', 'ACCEPTED', 'SCHEDULED'], // lecturer accepts→CANCELLED, rejects→revert
  REJECTED: [], // terminal
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

export function validateStatusTransition(
  from: string,
  to: string
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AppError(
      `Invalid status transition: ${from} → ${to}`,
      400
    );
  }
}
