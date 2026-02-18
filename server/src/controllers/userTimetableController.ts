import { Request, Response, NextFunction } from 'express';
import { getStudentTimetable, getLecturerTimetable } from '../services/timetableService';
import { getCached, setCached, invalidateAll, cacheStats } from '../services/timetableCache';
import { AppError } from '../middleware/errorHandler';

export async function getMyTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    const cacheKey = `timetable:${role}:${userId}`;

    const cached = getCached(cacheKey);
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
    const cacheKey = `timetable:STUDENT:${id}`;

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
