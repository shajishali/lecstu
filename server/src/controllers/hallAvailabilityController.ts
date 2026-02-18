import { Request, Response, NextFunction } from 'express';
import {
  findAvailableHalls,
  findAvailableNow,
  getHallDaySchedule,
  getFilterOptions,
} from '../services/hallAvailabilityService';
import { AppError } from '../middleware/errorHandler';

export async function getAvailableHalls(req: Request, res: Response, next: NextFunction) {
  try {
    const { day, startTime, endTime, minCapacity, building, equipment } = req.query;

    if (!day || typeof day !== 'string') {
      throw new AppError('Query parameter "day" is required (e.g. MONDAY)', 400);
    }

    const results = await findAvailableHalls({
      day: (day as string).toUpperCase(),
      startTime: startTime as string | undefined,
      endTime: endTime as string | undefined,
      minCapacity: minCapacity ? parseInt(minCapacity as string) : undefined,
      building: building as string | undefined,
      equipment: equipment as string | undefined,
    });

    res.json({
      success: true,
      data: results,
      meta: { day, totalResults: results.length },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAvailableNow(_req: Request, res: Response, next: NextFunction) {
  try {
    const results = await findAvailableNow();

    res.json({
      success: true,
      data: results,
      meta: {
        checkedAt: new Date().toISOString(),
        totalAvailable: results.length,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getHallSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const day = (req.query.day as string) || getCurrentDayName();

    const schedule = await getHallDaySchedule(id, day.toUpperCase());

    res.json({ success: true, data: schedule });
  } catch (err) {
    if ((err as Error).message === 'Hall not found') {
      return next(new AppError('Hall not found', 404));
    }
    next(err);
  }
}

export async function getFilters(_req: Request, res: Response, next: NextFunction) {
  try {
    const options = await getFilterOptions();
    res.json({ success: true, data: options });
  } catch (err) {
    next(err);
  }
}

function getCurrentDayName(): string {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date().getDay()];
}
