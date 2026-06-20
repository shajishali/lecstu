import prisma from '../config/database';
import { createNotification } from './notificationService';
import { sendUpcomingLectureReminders } from './lectureReminderService';

const REMINDER_MINUTES = 30;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

function formatTime(d: Date): string {
  return d.toLocaleString();
}

export async function sendUpcomingReminders(): Promise<void> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMINDER_MINUTES - 5) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMINDER_MINUTES + 5) * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      dateTime: { gte: windowStart, lte: windowEnd },
      reminderSentAt: null,
      status: { in: ['ACCEPTED', 'SCHEDULED'] },
    },
    select: {
      id: true,
      dateTime: true,
      duration: true,
      studentId: true,
      lecturerId: true,
      student: { select: { firstName: true, lastName: true } },
      lecturer: {
        select: {
          firstName: true,
          lastName: true,
          lecturerOffice: { select: { building: true, roomNumber: true } },
        },
      },
    },
  });

  for (const appt of appointments) {
    const lecturer = appt.lecturer as typeof appt.lecturer & {
      lecturerOffice?: { building: string; roomNumber: string };
    };
    const dateStr = formatTime(appt.dateTime);
    const place = lecturer.lecturerOffice
      ? ` at ${lecturer.lecturerOffice.building}, Room ${lecturer.lecturerOffice.roomNumber}`
      : '';

    await createNotification({
      userId: appt.studentId,
      type: 'APPOINTMENT_REMINDER',
      title: 'Meeting in 30 minutes',
      message: `Your appointment with ${lecturer.firstName} ${lecturer.lastName} is at ${dateStr}${place}`,
      metadata: { appointmentId: appt.id },
    });

    await createNotification({
      userId: appt.lecturerId,
      type: 'APPOINTMENT_REMINDER',
      title: 'Meeting in 30 minutes',
      message: `Your appointment with ${appt.student.firstName} ${appt.student.lastName} is at ${dateStr}${place}`,
      metadata: { appointmentId: appt.id },
    });

    await prisma.appointment.update({
      where: { id: appt.id },
      data: { reminderSentAt: new Date() },
    });
  }
}

let intervalId: NodeJS.Timeout | null = null;

function runReminderCheck(): void {
  void sendUpcomingReminders().catch((err) => {
    console.warn('[LECSTU] Appointment reminder check failed:', err);
  });
  void sendUpcomingLectureReminders().catch((err) => {
    console.warn('[LECSTU] Lecture reminder check failed:', err);
  });
}

export function startReminderJob(): void {
  if (intervalId) return;
  runReminderCheck();
  intervalId = setInterval(runReminderCheck, CHECK_INTERVAL_MS);
  console.log('[LECSTU] Reminder job started — appointments + lectures (every 5 min)');
}
