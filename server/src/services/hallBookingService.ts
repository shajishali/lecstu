import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function getDayOfWeek(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Validates that a hall can be booked for the given date/time.
 * - Hall must exist and be active
 * - Slot must not conflict with timetable
 * - Slot must not conflict with approved hall bookings
 * - Cannot book in the past
 */
export async function validateHallBooking(
  hallId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
  options?: { skipPastDateCheck?: boolean }
): Promise<void> {
  const hall = await prisma.lectureHall.findFirst({
    where: { id: hallId, isActive: true },
  });
  if (!hall) throw new AppError('Hall not found', 404);

  if (!options?.skipPastDateCheck) {
    const now = new Date();
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    if (bookingDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      throw new AppError('Cannot book a hall in the past', 400);
    }
  }

  const dayOfWeek = getDayOfWeek(date);
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  if (startMin >= endMin) {
    throw new AppError('End time must be after start time', 400);
  }

  // Check timetable conflict
  const timetableEntries = await prisma.masterTimetable.findMany({
    where: { hallId, dayOfWeek: dayOfWeek as any, isActive: true },
    select: { startTime: true, endTime: true },
  });

  for (const entry of timetableEntries) {
    const slotStart = timeToMinutes(entry.startTime);
    const slotEnd = timeToMinutes(entry.endTime);
    if (startMin < slotEnd && endMin > slotStart) {
      throw new AppError(
        `Hall is occupied by timetable at ${entry.startTime}-${entry.endTime} on that day`,
        400
      );
    }
  }

  // Check approved hall bookings for same date
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const existingBookings = await prisma.hallBooking.findMany({
    where: {
      hallId,
      date: { gte: dateStart, lte: dateEnd },
      status: 'APPROVED',
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
    },
    select: { startTime: true, endTime: true },
  });

  for (const b of existingBookings) {
    const bStart = timeToMinutes(b.startTime);
    const bEnd = timeToMinutes(b.endTime);
    if (startMin < bEnd && endMin > bStart) {
      throw new AppError(
        `Hall is already booked at ${b.startTime}-${b.endTime} on that date`,
        400
      );
    }
  }
}
