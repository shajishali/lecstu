import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { computeTodayIndoorRoutes } from '../services/indoorNavigationService';
import { computeRouteRequest } from '../modules/indoor-navigation/services/route.service';

export async function getIndoorRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string | undefined;
    const fromBuildingId = req.query.fromBuildingId as string | undefined;
    const toBuildingId = req.query.toBuildingId as string | undefined;
    const toHallId = req.query.toHallId as string | undefined;
    const toMarkerId = req.query.toMarkerId as string | undefined;
    const toOfficeId = req.query.toOfficeId as string | undefined;
    const q = req.query.q as string | undefined;
    const fromNodeId = req.query.fromNodeId as string | undefined;
    const fromMarkerId = req.query.fromMarkerId as string | undefined;
    const fromOfficeId = req.query.fromOfficeId as string | undefined;
    const floorRaw = req.query.floor;
    const fromFloorRaw = req.query.fromFloor;
    const floor =
      floorRaw !== undefined && floorRaw !== '' ? parseInt(String(floorRaw), 10) : undefined;
    const fromFloor =
      fromFloorRaw !== undefined && fromFloorRaw !== ''
        ? parseInt(String(fromFloorRaw), 10)
        : undefined;

    if (!toHallId && !toMarkerId && !toOfficeId && !q?.trim()) {
      throw new AppError('Provide toHallId, toMarkerId, toOfficeId, or q (room name)', 400);
    }

    const { formatted } = await computeRouteRequest({
      buildingId: toBuildingId || buildingId,
      fromBuildingId,
      toBuildingId,
      toHallId,
      toMarkerId,
      toOfficeId,
      q: q?.trim(),
      floor: floor !== undefined && !Number.isNaN(floor) ? floor : undefined,
      fromFloor: fromFloor !== undefined && !Number.isNaN(fromFloor) ? fromFloor : undefined,
      fromNodeId,
      fromMarkerId,
      fromOfficeId,
      forAdmin: req.user?.role === 'ADMIN',
    });

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

export async function getIndoorRouteToday(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, role } = req.user!;
    if (role !== 'STUDENT') {
      throw new AppError('Only students can access today\'s campus routes', 403);
    }
    const data = await computeTodayIndoorRoutes(userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
