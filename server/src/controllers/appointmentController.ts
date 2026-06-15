import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  validateBooking,
  validateStatusTransition,
} from '../services/appointmentBookingService';
import { createNotification } from '../services/notificationService';

const APPOINTMENT_SELECT = {
  id: true,
  dateTime: true,
  duration: true,
  status: true,
  reason: true,
  notes: true,
  rescheduledAt: true,
  reminderSentAt: true,
  cancellationReason: true,
  cancellationRequestedAt: true,
  cancellationPreviousStatus: true,
  createdAt: true,
  updatedAt: true,
  studentId: true,
  lecturerId: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImage: true,
    },
  },
  lecturer: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      profileImage: true,
      department: { select: { id: true, name: true, code: true } },
      lecturerOffice: { select: { roomNumber: true, building: true, floor: true } },
    },
  },
};

export async function createAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { lecturerId, dateTime, duration = 30, reason, notes } = req.body;

    const dt = new Date(dateTime);
    await validateBooking(lecturerId, userId, dt, duration || 30);

    const appointment = await prisma.appointment.create({
      data: {
        studentId: userId,
        lecturerId,
        dateTime: dt,
        duration: duration || 30,
        reason: reason || null,
        notes: notes || null,
        status: 'PENDING',
      },
      select: APPOINTMENT_SELECT,
    });

    const studentName = `${appointment.student.firstName} ${appointment.student.lastName}`;
    const dateStr = dt.toLocaleString();
    await createNotification({
      userId: lecturerId,
      type: 'APPOINTMENT_REQUEST',
      title: 'New appointment request',
      message: `${studentName} requested an appointment on ${dateStr}${reason ? `: ${reason}` : ''}`,
      metadata: { appointmentId: appointment.id },
    });

    res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

export async function listAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const { status, from, to, limit = 50, page = 1 } = req.query;

    const where: any = {};
    if (role === 'STUDENT') {
      where.studentId = userId;
    } else if (role === 'LECTURER') {
      where.lecturerId = userId;
    } else if (role === 'ADMIN') {
      // Admin can see all
    } else {
      where.OR = [{ studentId: userId }, { lecturerId: userId }];
    }

    if (status && typeof status === 'string') {
      const statuses = status.split(',').map((s) => s.trim().toUpperCase());
      if (statuses.length > 0) {
        where.status = { in: statuses };
      }
    }

    if (from && typeof from === 'string') {
      where.dateTime = where.dateTime || {};
      where.dateTime.gte = new Date(from);
    }
    if (to && typeof to === 'string') {
      where.dateTime = where.dateTime || {};
      where.dateTime.lte = new Date(to);
    }

    const skip = (Math.max(1, Number(page)) - 1) * Math.min(100, Math.max(1, Number(limit)));
    const take = Math.min(100, Math.max(1, Number(limit)));

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        select: APPOINTMENT_SELECT,
        orderBy: { dateTime: 'desc' },
        skip,
        take,
      }),
      prisma.appointment.count({ where }),
    ]);

    res.json({
      success: true,
      data: appointments,
      pagination: {
        page: Math.max(1, Number(page)),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_SELECT,
    });

    if (!appointment) throw new AppError('Appointment not found', 404);

    const canAccess =
      role === 'ADMIN' ||
      appointment.studentId === userId ||
      appointment.lecturerId === userId;
    if (!canAccess) throw new AppError('Access denied', 403);

    res.json({ success: true, data: appointment });
  } catch (err) {
    next(err);
  }
}

export async function acceptAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.lecturerId !== userId) throw new AppError('Only the lecturer can accept this appointment', 403);

    const currentStatus =
      appointment.status === 'PENDING_ADMIN' ? 'PENDING' : appointment.status;
    if (appointment.status === 'PENDING_ADMIN') {
      await prisma.appointment.update({
        where: { id },
        data: { status: 'PENDING' },
      });
    }

    validateStatusTransition(currentStatus, 'ACCEPTED');

    await validateBooking(
      appointment.lecturerId,
      appointment.studentId,
      appointment.dateTime,
      appointment.duration,
      id
    );

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'ACCEPTED' },
      select: APPOINTMENT_SELECT,
    });

    const lecturer = updated.lecturer as typeof updated.lecturer & { lecturerOffice?: { roomNumber: string; building: string; floor: number } };
    const lecturerName = `${lecturer.firstName} ${lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    const officeInfo = lecturer.lecturerOffice
      ? ` Meet at ${lecturer.lecturerOffice.building}, Room ${lecturer.lecturerOffice.roomNumber}`
      : '';
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_ACCEPTED',
      title: 'Appointment accepted',
      message: `${lecturerName} accepted your appointment on ${dateStr}${officeInfo}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Admin approves appointment request → notifies lecturer */
export async function adminApproveAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_SELECT,
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.status !== 'PENDING_ADMIN') {
      throw new AppError('Only appointments awaiting admin approval can be approved', 400);
    }

    validateStatusTransition(appointment.status, 'PENDING');

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'PENDING' },
      select: APPOINTMENT_SELECT,
    });

    const studentName = `${updated.student.firstName} ${updated.student.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.lecturerId,
      type: 'APPOINTMENT_REQUEST',
      title: 'New appointment request',
      message: `${studentName} requested an appointment on ${dateStr}${appointment.reason ? `: ${appointment.reason}` : ''}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Admin rejects appointment request → notifies student */
export async function adminRejectAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_SELECT,
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.status !== 'PENDING_ADMIN') {
      throw new AppError('Only appointments awaiting admin approval can be rejected', 400);
    }

    validateStatusTransition(appointment.status, 'REJECTED');

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason
          ? (appointment.notes ? `${appointment.notes}\n\nAdmin rejection: ${reason}` : `Admin rejection: ${reason}`)
          : appointment.notes,
      },
      select: APPOINTMENT_SELECT,
    });

    const lecturerName = `${updated.lecturer.firstName} ${updated.lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_ADMIN_REJECTED',
      title: 'Appointment request rejected',
      message: `Your appointment request with ${lecturerName} on ${dateStr} was rejected by admin.${reason ? ` Reason: ${reason}` : ''}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function rejectAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.lecturerId !== userId) throw new AppError('Only the lecturer can reject this appointment', 403);

    const currentStatus =
      appointment.status === 'PENDING_ADMIN' ? 'PENDING' : appointment.status;
    if (appointment.status === 'PENDING_ADMIN') {
      await prisma.appointment.update({
        where: { id },
        data: { status: 'PENDING' },
      });
    }

    validateStatusTransition(currentStatus, 'REJECTED');

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'REJECTED',
        notes: reason
          ? (appointment.notes ? `${appointment.notes}\n\nRejection reason: ${reason}` : `Rejection reason: ${reason}`)
          : appointment.notes,
      },
      select: APPOINTMENT_SELECT,
    });

    const lecturerName = `${updated.lecturer.firstName} ${updated.lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_REJECTED',
      title: 'Appointment rejected',
      message: `${lecturerName} rejected your appointment on ${dateStr}${reason ? `: ${reason}` : ''}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function rescheduleAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { dateTime, duration, reason } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.lecturerId !== userId) throw new AppError('Only the lecturer can reschedule this appointment', 403);

    if (!['PENDING', 'PENDING_ADMIN', 'ACCEPTED', 'SCHEDULED'].includes(appointment.status)) {
      throw new AppError('Only pending or accepted appointments can be rescheduled', 400);
    }

    const dt = new Date(dateTime);
    const newDuration = duration ?? appointment.duration;
    await validateBooking(
      appointment.lecturerId,
      appointment.studentId,
      dt,
      newDuration,
      id
    );

    const notesUpdate = reason
      ? (appointment.notes
          ? `${appointment.notes}\n\nReschedule: ${reason}`
          : `Reschedule: ${reason}`)
      : appointment.notes;

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        dateTime: dt,
        duration: newDuration,
        notes: notesUpdate,
        rescheduledAt: new Date(),
        status: 'PENDING', // Student must confirm new time
      },
      select: APPOINTMENT_SELECT,
    });

    const lecturer = updated.lecturer as typeof updated.lecturer & { lecturerOffice?: { roomNumber: string; building: string; floor: number } };
    const lecturerName = `${lecturer.firstName} ${lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    const officeInfo = lecturer.lecturerOffice
      ? ` Meet at ${lecturer.lecturerOffice.building}, Room ${lecturer.lecturerOffice.roomNumber}`
      : '';
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_RESCHEDULED',
      title: 'Appointment rescheduled',
      message: `${lecturerName} proposed a new time: ${dateStr}${officeInfo}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function confirmReschedule(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: APPOINTMENT_SELECT,
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.studentId !== userId) throw new AppError('Only the student can confirm the rescheduled time', 403);
    if (appointment.status !== 'PENDING' || !appointment.rescheduledAt) {
      throw new AppError('This appointment does not require confirmation', 400);
    }

    validateStatusTransition(appointment.status, 'SCHEDULED');

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'SCHEDULED' },
      select: APPOINTMENT_SELECT,
    });

    const student = updated.student;
    const studentName = `${student.firstName} ${student.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.lecturerId,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Student confirmed reschedule',
      message: `${studentName} confirmed the new time: ${dateStr}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Student requests cancellation (ACCEPTED/SCHEDULED) - requires lecturer approval */
export async function requestCancellation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;
    const { reason } = req.body;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.studentId !== userId) throw new AppError('Only the student can request cancellation', 403);
    if (!['ACCEPTED', 'SCHEDULED'].includes(appointment.status)) {
      throw new AppError('Only confirmed appointments require cancellation request. Use cancel for pending.', 400);
    }

    validateStatusTransition(appointment.status, 'CANCELLATION_REQUESTED');

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLATION_REQUESTED',
        cancellationReason: reason,
        cancellationRequestedAt: new Date(),
        cancellationPreviousStatus: appointment.status,
      },
      select: APPOINTMENT_SELECT,
    });

    const studentName = `${updated.student.firstName} ${updated.student.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.lecturerId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Cancellation requested',
      message: `${studentName} requested to cancel the appointment on ${dateStr}. Reason: ${reason}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Lecturer accepts cancellation request */
export async function acceptCancellation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.lecturerId !== userId) throw new AppError('Only the lecturer can approve cancellation', 403);
    if (appointment.status !== 'CANCELLATION_REQUESTED') {
      throw new AppError('No cancellation request pending', 400);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationPreviousStatus: null,
      },
      select: APPOINTMENT_SELECT,
    });

    const lecturerName = `${updated.lecturer.firstName} ${updated.lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Cancellation approved',
      message: `${lecturerName} approved your cancellation request for ${dateStr}`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Lecturer rejects cancellation request */
export async function rejectCancellation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new AppError('Appointment not found', 404);
    if (appointment.lecturerId !== userId) throw new AppError('Only the lecturer can reject cancellation', 403);
    if (appointment.status !== 'CANCELLATION_REQUESTED') throw new AppError('No cancellation request pending', 400);

    const revertStatus = (appointment.cancellationPreviousStatus || 'SCHEDULED') as 'ACCEPTED' | 'SCHEDULED';
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: revertStatus,
        cancellationReason: null,
        cancellationRequestedAt: null,
        cancellationPreviousStatus: null,
      },
      select: APPOINTMENT_SELECT,
    });

    const lecturerName = `${updated.lecturer.firstName} ${updated.lecturer.lastName}`;
    const dateStr = updated.dateTime.toLocaleString();
    await createNotification({
      userId: appointment.studentId,
      type: 'APPOINTMENT_ACCEPTED',
      title: 'Cancellation rejected',
      message: `${lecturerName} declined your cancellation. The appointment on ${dateStr} is still confirmed.`,
      metadata: { appointmentId: updated.id },
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const id = req.params.id as string;
    const { reason } = req.body || {};

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) throw new AppError('Appointment not found', 404);

    const isStudent = appointment.studentId === userId;
    const isLecturer = appointment.lecturerId === userId;
    const isAdmin = role === 'ADMIN';

    if (!isStudent && !isLecturer && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    if (!['PENDING', 'PENDING_ADMIN', 'ACCEPTED', 'SCHEDULED'].includes(appointment.status)) {
      throw new AppError('This appointment cannot be cancelled', 400);
    }

    if ((appointment.status === 'PENDING' || appointment.status === 'PENDING_ADMIN') && !isStudent && !isAdmin) {
      throw new AppError('Only the student who requested can cancel a pending appointment', 403);
    }

    if (isStudent && ['ACCEPTED', 'SCHEDULED'].includes(appointment.status)) {
      throw new AppError('Please use Request cancellation and provide a reason. The lecturer must approve.', 400);
    }

    if (isStudent && appointment.status === 'PENDING' && !reason?.trim()) {
      throw new AppError('Please provide a reason for cancelling', 400);
    }

    validateStatusTransition(appointment.status, 'CANCELLED');

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: reason && appointment.notes
          ? `${appointment.notes}\n\nCancellation reason: ${reason}`
          : reason
            ? `Cancellation reason: ${reason}`
            : appointment.notes,
      },
      select: APPOINTMENT_SELECT,
    });

    const dateStr = updated.dateTime.toLocaleString();
    const studentName = `${updated.student.firstName} ${updated.student.lastName}`;
    const lecturerName = `${updated.lecturer.firstName} ${updated.lecturer.lastName}`;
    if (isStudent) {
      await createNotification({
        userId: appointment.lecturerId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment cancelled',
        message: `${studentName} cancelled the appointment on ${dateStr}${reason ? `. Reason: ${reason}` : ''}`,
        metadata: { appointmentId: updated.id },
      });
    } else if (isLecturer) {
      await createNotification({
        userId: appointment.studentId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment cancelled',
        message: `${lecturerName} cancelled the appointment on ${dateStr}`,
        metadata: { appointmentId: updated.id },
      });
    } else {
      await createNotification({
        userId: appointment.lecturerId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment cancelled',
        message: `The appointment on ${dateStr} with ${studentName} was cancelled by an administrator`,
        metadata: { appointmentId: updated.id },
      });
      await createNotification({
        userId: appointment.studentId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Appointment cancelled',
        message: `The appointment on ${dateStr} with ${lecturerName} was cancelled by an administrator`,
        metadata: { appointmentId: updated.id },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Remove a cancelled/rejected/completed appointment from the list (permanent delete) */
export async function removeAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;
    const id = req.params.id as string;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new AppError('Appointment not found', 404);

    const isStudent = appointment.studentId === userId;
    const isLecturer = appointment.lecturerId === userId;
    const isAdmin = role === 'ADMIN';

    if (!isStudent && !isLecturer && !isAdmin) {
      throw new AppError('Access denied', 403);
    }

    if (!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(appointment.status)) {
      throw new AppError('Only cancelled, rejected, or completed appointments can be removed', 400);
    }

    await prisma.appointment.delete({ where: { id } });
    res.json({ success: true, message: 'Appointment removed' });
  } catch (err) {
    next(err);
  }
}
