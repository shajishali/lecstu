import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  bulkApproveMarkers,
  deleteFloorMarker,
  getFloorLocationsReview,
  placeBuildingConnectionMarker,
  purgeFloorPlanJunkMarkers,
  updateFloorMarkerDetails,
  updateFloorMarkerPosition,
  updateFloorPlanCalibration,
  assertFloorPlanNotLocked,
  lockFloorLocations,
  unlockFloorLocations,
  updateFloorPlanPublishStatus,
  updateMarkerReviewStatus,
} from '../services/floorPlanReviewService';
import { createIndoorMarker } from '../services/indoorMarkerService';
import {
  buildFloorNavigationGraph,
  clearAutoWalkingPaths,
  restoreWalkingPathsFromSnapshot,
  saveWalkingPathsSnapshot,
} from '../services/navGraphBuildService';
import { validateFloorNavGraph } from '../services/navGraphValidationService';
import type { FloorPlanPublishStatus, MapMarkerType } from '../generated/prisma/client';
import type { MarkerReviewStatus } from '../utils/markerMetadata';

export async function getFloorLocationsReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    if (Number.isNaN(floor)) throw new AppError('Invalid floor', 400);
    const data = await getFloorLocationsReview(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchFloorPlanCalibrationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const data = await updateFloorPlanCalibration(buildingId, floor, req.body);
    await logActionForRequest(req, 'UPDATE_FLOOR_CALIBRATION', 'FloorPlan', data.id, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getFloorNavGraphValidationHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const data = await validateFloorNavGraph(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function buildFloorNavGraphHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const force = req.body?.force === true;
    const build = await buildFloorNavigationGraph(buildingId, floor, undefined, { force });
    const validation = await validateFloorNavGraph(buildingId, floor);
    await logActionForRequest(req, 'BUILD_NAV_GRAPH', 'FloorPlan', buildingId, { floor, build });
    res.json({ success: true, data: { build, validation } });
  } catch (err) {
    next(err);
  }
}

export async function backupWalkingPathsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const snapshot = await saveWalkingPathsSnapshot(buildingId, floor);
    if (!snapshot) {
      throw new AppError('No manual path points on this floor to back up', 400);
    }
    await logActionForRequest(req, 'BACKUP_WALKING_PATHS', 'FloorPlan', buildingId, { floor });
    res.json({ success: true, data: snapshot });
  } catch (err) {
    next(err);
  }
}

export async function restoreWalkingPathsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const restored = await restoreWalkingPathsFromSnapshot(buildingId, floor);
    const validation = await validateFloorNavGraph(buildingId, floor);
    await logActionForRequest(req, 'RESTORE_WALKING_PATHS', 'FloorPlan', buildingId, {
      floor,
      restored,
    });
    res.json({ success: true, data: { restored, validation } });
  } catch (err) {
    next(err);
  }
}

export async function clearAutoPathPointsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const result = await clearAutoWalkingPaths(buildingId, floor);
    const validation = await validateFloorNavGraph(buildingId, floor);
    await logActionForRequest(req, 'CLEAR_AUTO_PATH_POINTS', 'FloorPlan', buildingId, {
      floor,
      ...result,
    });
    res.json({ success: true, data: { ...result, validation } });
  } catch (err) {
    next(err);
  }
}

export async function lockFloorLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const data = await lockFloorLocations(buildingId, floor);
    await logActionForRequest(req, 'LOCK_FLOOR_LOCATIONS', 'FloorPlan', buildingId, { floor });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function unlockFloorLocationsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const data = await unlockFloorLocations(buildingId, floor);
    await logActionForRequest(req, 'UNLOCK_FLOOR_LOCATIONS', 'FloorPlan', buildingId, { floor });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchFloorPlanPublishHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const publishStatus = req.body?.publishStatus as FloorPlanPublishStatus;
    if (!['DRAFT', 'REVIEWED', 'PUBLISHED'].includes(publishStatus)) {
      throw new AppError('publishStatus must be DRAFT, REVIEWED, or PUBLISHED', 400);
    }
    const data = await updateFloorPlanPublishStatus(buildingId, floor, publishStatus);
    await logActionForRequest(req, 'UPDATE_FLOOR_PUBLISH', 'FloorPlan', data.id, { publishStatus });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchMarkerReviewHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const reviewStatus = req.body?.reviewStatus as MarkerReviewStatus;
    if (!['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      throw new AppError('reviewStatus must be pending, approved, or rejected', 400);
    }
    const data = await updateMarkerReviewStatus(id, reviewStatus);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function bulkApproveMarkersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const markerIds = req.body?.markerIds as string[];
    const data = await bulkApproveMarkers(markerIds);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function purgeJunkMarkersHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const data = await purgeFloorPlanJunkMarkers(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function createFloorMarkerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const { type, label, x, y, hallId, officeId, legendNumber } = req.body;
    if (!type || !label) {
      throw new AppError('type and label are required', 400);
    }
    const parsedLegend =
      legendNumber != null && legendNumber !== ''
        ? parseInt(String(legendNumber), 10)
        : undefined;
    await assertFloorPlanNotLocked(buildingId, floor);
    const marker = await createIndoorMarker({
      buildingId,
      floor,
      type: type as MapMarkerType,
      label,
      x,
      y,
      hallId: hallId || null,
      officeId: officeId || null,
      legendNumber: parsedLegend != null && !Number.isNaN(parsedLegend) ? parsedLegend : undefined,
    });
    await logActionForRequest(req, 'CREATE_INDOOR_MARKER', 'MapMarker', marker.id, {
      buildingId,
      floor,
    });
    res.status(201).json({ success: true, data: marker });
  } catch (err) {
    next(err);
  }
}

export async function patchFloorMarkerPositionHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const markerId = req.params.markerId as string;
    const { x, y } = req.body;
    if (x === undefined || y === undefined) {
      throw new AppError('x and y are required', 400);
    }
    const data = await updateFloorMarkerPosition(
      buildingId,
      floor,
      markerId,
      Number(x),
      Number(y)
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchFloorMarkerDetailsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const markerId = req.params.markerId as string;
    const { label, type, legendNumber, hallId, officeId } = req.body;
    const parsedLegend =
      legendNumber === null || legendNumber === ''
        ? null
        : legendNumber != null
          ? parseInt(String(legendNumber), 10)
          : undefined;
    const data = await updateFloorMarkerDetails(buildingId, floor, markerId, {
      label,
      type: type as MapMarkerType | undefined,
      legendNumber: parsedLegend,
      hallId,
      officeId,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function patchFloorMarkerReviewHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const markerId = req.params.markerId as string;
    const reviewStatus = req.body?.reviewStatus as MarkerReviewStatus;
    if (!['pending', 'approved', 'rejected'].includes(reviewStatus)) {
      throw new AppError('reviewStatus must be pending, approved, or rejected', 400);
    }
    const data = await updateMarkerReviewStatus(markerId, reviewStatus);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function bulkApproveFloorMarkersHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const markerIds = (req.body?.markerIds as string[]) || [];
    const markers = await bulkApproveMarkers(markerIds);
    await logActionForRequest(req, 'BULK_APPROVE_FLOOR_MARKERS', 'MapBuilding', buildingId, {
      floor,
      count: markers.approved,
    });
    res.json({ success: true, data: markers });
  } catch (err) {
    next(err);
  }
}

export async function deleteFloorMarkerHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const markerId = req.params.markerId as string;
    const data = await deleteFloorMarker(buildingId, floor, markerId);
    await logActionForRequest(req, 'DELETE_FLOOR_MARKER', 'MapMarker', markerId, { buildingId, floor });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function placeConnectionMarkerHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const { targetBuildingCode, x, y } = req.body;
    if (!targetBuildingCode || x === undefined || y === undefined) {
      throw new AppError('targetBuildingCode, x, and y are required', 400);
    }
    const data = await placeBuildingConnectionMarker(
      buildingId,
      floor,
      targetBuildingCode,
      Number(x),
      Number(y)
    );
    await logActionForRequest(req, 'PLACE_BUILDING_CONNECTION', 'MapMarker', data.id, req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
