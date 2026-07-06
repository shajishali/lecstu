export const APPOINTMENT_NOTIFICATION_TYPES = [
  'APPOINTMENT_REQUEST',
  'APPOINTMENT_ACCEPTED',
  'APPOINTMENT_REJECTED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REMINDER',
  'APPOINTMENT_ADMIN_APPROVED',
  'APPOINTMENT_ADMIN_REJECTED',
  'HALL_BOOKING_APPROVED',
  'HALL_BOOKING_REJECTED',
] as const;

export const TIMETABLE_NOTIFICATION_TYPES = ['TIMETABLE_CHANGE', 'LECTURE_REMINDER'] as const;

export const APPROVAL_NOTIFICATION_TYPES = ['HALL_BOOKING_REQUEST'] as const;

export const STUDENT_APPROVAL_NOTIFICATION_TYPES = [
  'HALL_BOOKING_APPROVED',
  'HALL_BOOKING_REJECTED',
] as const;

export interface SidebarNotificationSection {
  types: readonly string[];
  popoverTitle: string;
  viewAllPath: string;
  viewAllLabel: string;
  markReadOnVisit?: boolean;
  /** Pending hall bookings API count (admin: all pending; student: own pending) */
  usePendingHallBookings?: boolean;
  /** Pending appointment requests for lecturer/student */
  usePendingAppointments?: boolean;
}

export const SIDEBAR_NOTIFICATION_SECTIONS: Record<
  string,
  Record<string, SidebarNotificationSection>
> = {
  STUDENT: {
    '/approvals': {
      types: STUDENT_APPROVAL_NOTIFICATION_TYPES,
      popoverTitle: 'Approval updates',
      viewAllPath: '/approvals',
      viewAllLabel: 'View approvals',
      markReadOnVisit: true,
      usePendingHallBookings: true,
      usePendingAppointments: true,
    },
    '/appointments': {
      types: APPOINTMENT_NOTIFICATION_TYPES,
      popoverTitle: 'Appointment updates',
      viewAllPath: '/appointments',
      viewAllLabel: 'View appointments',
      markReadOnVisit: true,
    },
    '/timetable': {
      types: TIMETABLE_NOTIFICATION_TYPES,
      popoverTitle: 'Timetable updates',
      viewAllPath: '/timetable',
      viewAllLabel: 'View timetable',
      markReadOnVisit: true,
    },
  },
  LECTURER: {
    '/approvals': {
      types: ['APPOINTMENT_REQUEST'],
      popoverTitle: 'Pending requests',
      viewAllPath: '/approvals',
      viewAllLabel: 'View approvals',
      markReadOnVisit: true,
      usePendingAppointments: true,
    },
    '/appointments': {
      types: APPOINTMENT_NOTIFICATION_TYPES,
      popoverTitle: 'Appointment requests',
      viewAllPath: '/appointments',
      viewAllLabel: 'View appointments',
      markReadOnVisit: true,
    },
    '/lecturer/schedule': {
      types: TIMETABLE_NOTIFICATION_TYPES,
      popoverTitle: 'Schedule updates',
      viewAllPath: '/lecturer/schedule',
      viewAllLabel: 'View schedule',
      markReadOnVisit: true,
    },
  },
  ADMIN: {
    '/approvals': {
      types: APPROVAL_NOTIFICATION_TYPES,
      popoverTitle: 'Pending approvals',
      viewAllPath: '/approvals',
      viewAllLabel: 'View approvals',
      markReadOnVisit: true,
      usePendingHallBookings: true,
    },
  },
};

export function getSidebarSectionConfig(
  role: string | undefined,
  path: string,
): SidebarNotificationSection | undefined {
  if (!role) return undefined;
  return SIDEBAR_NOTIFICATION_SECTIONS[role]?.[path];
}

export function getNotificationNavigatePath(
  notification: { type: string; metadata?: { appointmentId?: string; hallBookingId?: string } },
  role?: string,
): string {
  if (
    notification.type === 'HALL_BOOKING_REQUEST' ||
    notification.type === 'HALL_BOOKING_APPROVED' ||
    notification.type === 'HALL_BOOKING_REJECTED'
  ) {
    return '/approvals';
  }
  if (notification.type === 'TIMETABLE_CHANGE' || notification.type === 'LECTURE_REMINDER') {
    return role === 'LECTURER' ? '/lecturer/schedule' : '/timetable';
  }
  if (
    notification.metadata?.appointmentId ||
    APPOINTMENT_NOTIFICATION_TYPES.includes(
      notification.type as (typeof APPOINTMENT_NOTIFICATION_TYPES)[number],
    )
  ) {
    return role === 'LECTURER' ? '/approvals' : '/appointments';
  }
  return '/notifications';
}
