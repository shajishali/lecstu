import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import {
  computeIndoorRouteFlexible,
  computeTodayIndoorRoutes,
  formatIndoorRouteResponse,
} from '../services/indoorNavigationService';
import { generateAiDirections } from '../services/floorNavigationEngineService';

async function enrichWithAiDirections(
  formatted: ReturnType<typeof formatIndoorRouteResponse>
) {
  if (!formatted.found || !('polyline' in formatted) || !formatted.polyline?.length) {
    return formatted;
  }

  const ai = await generateAiDirections({
    destinationLabel: formatted.destinationLabel || 'destination',
    buildingName: formatted.building?.name,
    polyline: formatted.polyline,
  });

  if (!ai?.steps?.length) return formatted;

  const destFloor = formatted.marker?.floor ?? formatted.segments[formatted.segments.length - 1]?.floor ?? 0;
  return {
    ...formatted,
    steps: ai.steps.map((s) => ({
      instruction: s.instruction,
      floor: s.floor ?? destFloor,
    })),
    stepDetails: ai.steps.map((s) => ({
      instruction: s.instruction,
      floor: s.floor ?? destFloor,
    })),
    aiDirections: ai,
    confidence: ai.confidence,
    directionEngine: ai.engine,
  };
}

export async function getIndoorRoute(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string | undefined;
    const fromBuildingId = req.query.fromBuildingId as string | undefined;
    const toBuildingId = req.query.toBuildingId as string | undefined;
    const toHallId = req.query.toHallId as string | undefined;
    const toMarkerId = req.query.toMarkerId as string | undefined;
    const q = req.query.q as string | undefined;
    const fromNodeId = req.query.fromNodeId as string | undefined;
    const fromMarkerId = req.query.fromMarkerId as string | undefined;
    const floorRaw = req.query.floor;
    const fromFloorRaw = req.query.fromFloor;
    const floor =
      floorRaw !== undefined && floorRaw !== '' ? parseInt(String(floorRaw), 10) : undefined;
    const fromFloor =
      fromFloorRaw !== undefined && fromFloorRaw !== ''
        ? parseInt(String(fromFloorRaw), 10)
        : undefined;

    if (!toHallId && !toMarkerId && !q?.trim()) {
      throw new AppError('Provide toHallId, toMarkerId, or q (room name)', 400);
    }

    const raw = await computeIndoorRouteFlexible({
      buildingId: toBuildingId || buildingId,
      fromBuildingId,
      toBuildingId,
      toHallId,
      toMarkerId,
      q: q?.trim(),
      floor: floor !== undefined && !Number.isNaN(floor) ? floor : undefined,
      fromFloor: fromFloor !== undefined && !Number.isNaN(fromFloor) ? fromFloor : undefined,
      fromNodeId,
      fromMarkerId,
    });

    const formatted = await enrichWithAiDirections(formatIndoorRouteResponse(raw));
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
