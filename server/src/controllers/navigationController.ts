import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { detectNavigationIntent } from '../services/navigationIntentService';
import { generateAiDirections, isNavigationEngineHealthy } from '../services/floorNavigationEngineService';
import { executeUnifiedNavigationQuery } from '../services/unifiedNavigationQueryService';

export async function postDetectIntent(req: Request, res: Response, next: NextFunction) {
  try {
    const message = (req.body?.message as string) || '';
    if (!message.trim()) throw new AppError('message is required', 400);
    const result = await detectNavigationIntent(message.trim());
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function getEngineHealth(_req: Request, res: Response) {
  const healthy = await isNavigationEngineHealthy();
  res.json({
    success: true,
    data: {
      engine: 'indoor-navigation-engine',
      healthy,
      url: process.env.INDOOR_NAVIGATION_URL || 'http://localhost:8004',
    },
  });
}

export async function postNavigationQuery(req: Request, res: Response, next: NextFunction) {
  try {
    const message = (req.body?.message as string)?.trim();
    const buildingId = req.body?.buildingId as string | undefined;
    const fromNodeId = req.body?.fromNodeId as string | undefined;

    if (!message) throw new AppError('message is required', 400);

    const data = await executeUnifiedNavigationQuery({
      message,
      buildingId,
      fromNodeId,
      userId: req.user?.userId,
      userRole: req.user?.role,
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function postGenerateDirections(req: Request, res: Response, next: NextFunction) {
  try {
    const { destinationLabel, buildingName, polyline, pathNodes } = req.body ?? {};
    if (!polyline?.length && !pathNodes?.length) {
      throw new AppError('polyline or pathNodes required', 400);
    }

    const ai = await generateAiDirections({
      destinationLabel: destinationLabel || 'destination',
      buildingName,
      polyline: polyline || [],
      pathNodes,
    });

    if (!ai) throw new AppError('Navigation engine unavailable', 503);
    res.json({ success: true, data: ai });
  } catch (err) {
    next(err);
  }
}
