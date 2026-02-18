import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  getLecturerWeeklyAvailability,
  getLecturerDateAvailability,
} from '../services/lecturerAvailabilityService';

export async function listLecturers(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, departmentId } = req.query;

    const where: any = { role: 'LECTURER', isActive: true };

    if (departmentId && typeof departmentId === 'string') {
      where.departmentId = departmentId;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const lecturers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profileImage: true,
        department: { select: { id: true, name: true, code: true } },
        lecturerOffice: {
          select: { id: true, roomNumber: true, building: true, floor: true },
        },
        _count: {
          select: { timetableEntries: true },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    res.json({ success: true, data: lecturers });
  } catch (err) {
    next(err);
  }
}

export async function getLecturerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;

    const lecturer = await prisma.user.findFirst({
      where: { id, role: 'LECTURER' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        profileImage: true,
        department: { select: { id: true, name: true, code: true } },
        lecturerOffice: {
          select: { id: true, roomNumber: true, building: true, floor: true },
        },
        timetableEntries: {
          where: { isActive: true },
          select: {
            course: { select: { id: true, name: true, code: true } },
          },
          distinct: ['courseId'],
        },
      },
    });

    if (!lecturer) throw new AppError('Lecturer not found', 404);

    const courses = lecturer.timetableEntries.map((e) => e.course);

    res.json({
      success: true,
      data: {
        id: lecturer.id,
        firstName: lecturer.firstName,
        lastName: lecturer.lastName,
        email: lecturer.email,
        phone: lecturer.phone,
        profileImage: lecturer.profileImage,
        department: lecturer.department,
        office: lecturer.lecturerOffice,
        courses,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getLecturerAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { date } = req.query;

    const lecturer = await prisma.user.findFirst({
      where: { id, role: 'LECTURER' },
      select: { id: true },
    });
    if (!lecturer) throw new AppError('Lecturer not found', 404);

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
