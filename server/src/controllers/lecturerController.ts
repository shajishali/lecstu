import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import {
  getLecturerWeeklyAvailability,
  getLecturerDateAvailability,
} from '../services/lecturerAvailabilityService';
import {
  getDirectoryLecturerProfile,
  isFetVirtualLecturerId,
  listDirectoryLecturers,
} from '../services/lecturerDirectoryService';
import {
  listLecturerScheduleSlots,
  replaceLecturerSchedule,
  type ScheduleSlotInput,
} from '../services/lecturerScheduleService';
import { updateLecturerMasterSlot } from '../services/lecturerTimetableService';
import prisma from '../config/database';

export async function listLecturers(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, departmentId } = req.query;
    const lecturers = await listDirectoryLecturers({
      search: typeof search === 'string' ? search : undefined,
      departmentId: typeof departmentId === 'string' ? departmentId : undefined,
    });

    res.json({
      success: true,
      data: lecturers.map((l) => ({
        id: l.id,
        firstName: l.firstName,
        lastName: l.lastName,
        designation: l.designation,
        email: l.email,
        phone: l.phone,
        profileImage: l.profileImage,
        timetableCode: l.timetableCode,
        derivedFromName: l.derivedFromName,
        bookable: l.bookable,
        isFetOnly: l.isFetOnly,
        department: l.department,
        lecturerOffice: l.lecturerOffice,
        teachingHalls: l.teachingHalls,
        _count: { scheduleSlots: l.scheduleSlotCount },
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getLecturerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    if (isFetVirtualLecturerId(id)) {
      throw new AppError('Lecturer not found', 404);
    }
    const profile = await getDirectoryLecturerProfile(id);
    if (!profile) throw new AppError('Lecturer not found', 404);

    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function getLecturerAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { date } = req.query;

    if (isFetVirtualLecturerId(id)) {
      throw new AppError('Lecturer not found', 404);
    }

    const profile = await getDirectoryLecturerProfile(id);
    if (!profile) throw new AppError('Lecturer not found', 404);

    if (date && typeof date === 'string') {
      const availability = await getLecturerDateAvailability(id, date);
      return res.json({ success: true, data: availability });
    }

    const availability = await getLecturerWeeklyAvailability(id);
    res.json({ success: true, data: availability });
  } catch (err) {
    next(err);
  }
}

export async function getMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const lecturerId = req.user!.userId;
    const slots = await listLecturerScheduleSlots(lecturerId);
    res.json({ success: true, data: slots });
  } catch (err) {
    next(err);
  }
}

export async function putMySchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const lecturerId = req.user!.userId;
    const { slots } = req.body as { slots?: ScheduleSlotInput[] };
    if (!Array.isArray(slots)) {
      throw new AppError('Body must include slots array', 400);
    }
    const saved = await replaceLecturerSchedule(lecturerId, slots);
    res.json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
}

export async function patchMyTimetableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const lecturerId = req.user!.userId;
    const slotId = req.params.slotId as string;
    const {
      dayOfWeek,
      startTime,
      endTime,
      year,
      month,
      week,
      courseName,
      hallName,
      hallDoorPassword,
      notes,
    } = req.body as {
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
      year?: number;
      month?: number;
      week?: number;
      courseName?: string;
      hallName?: string;
      hallDoorPassword?: string | null;
      notes?: string | null;
    };

    const hasPatch =
      dayOfWeek ||
      startTime ||
      endTime ||
      year != null ||
      month != null ||
      week != null ||
      courseName?.trim() ||
      hallName?.trim() ||
      hallDoorPassword !== undefined ||
      notes !== undefined;
    if (!hasPatch) {
      throw new AppError('Provide at least one field to update', 400);
    }

    const updated = await updateLecturerMasterSlot(lecturerId, slotId, {
      dayOfWeek: dayOfWeek as never,
      startTime,
      endTime,
      year,
      month,
      week,
      courseName,
      hallName,
      hallDoorPassword,
      notes,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(_req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: departments });
  } catch (err) {
    next(err);
  }
}
