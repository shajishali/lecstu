import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { getStudentTimetable, getLecturerTimetable } from '../services/timetableService';
import {
  getStudentTodayNextClass,
  getStudentTodayOnCampus,
} from '../services/studentTodayCampusService';
import { getCached, setCached, invalidateAll, cacheStats } from '../services/timetableCache';
import { AppError } from '../middleware/errorHandler';

async function studentTimetableCacheKey(userId: string): Promise<string> {
  const membership = await prisma.studentGroupMember.findFirst({
    where: { studentId: userId },
    select: { groupId: true },
    orderBy: { createdAt: 'asc' },
  });
  return `timetable:STUDENT:${userId}:${membership?.groupId ?? 'none'}`;
}

export async function getMyTodayOnCampus(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    if (role !== 'STUDENT') {
      throw new AppError('Only students can access today on campus', 403);
    }
    const data = await getStudentTodayOnCampus(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyTodayNext(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    if (role !== 'STUDENT') {
      throw new AppError('Only students can access today on campus', 403);
    }
    const data = await getStudentTodayNextClass(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getMyTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const cacheKey =
      role === 'STUDENT'
        ? await studentTimetableCacheKey(userId)
        : `timetable:${role}:${userId}`;

    const bypassCache = req.query._ !== undefined || req.query.refresh === '1';

    const cached = bypassCache ? null : getCached(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json({ success: true, data: cached });
    }

    const data =
      role === 'STUDENT'
        ? await getStudentTimetable(userId)
        : await getLecturerTimetable(userId);

    setCached(cacheKey, data);
    res.set('X-Cache', 'MISS');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getStudentTimetableById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const cacheKey = await studentTimetableCacheKey(id);

    const cached = getCached(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json({ success: true, data: cached });
    }

    const data = await getStudentTimetable(id);
    setCached(cacheKey, data);
    res.set('X-Cache', 'MISS');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getLecturerTimetableById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const cacheKey = `timetable:LECTURER:${id}`;

    const cached = getCached(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json({ success: true, data: cached });
    }

    const data = await getLecturerTimetable(id);
    setCached(cacheKey, data);
    res.set('X-Cache', 'MISS');
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function invalidateCache(_req: Request, res: Response, next: NextFunction) {
  try {
    invalidateAll();
    res.json({ success: true, message: 'Timetable cache cleared', stats: cacheStats() });
  } catch (err) {
    next(err);
  }
}
