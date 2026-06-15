import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  autoPairBuildingFloorConnectors,
  deleteCrossBuildingEdge,
  listBuildingFloorConnectors,
  pairBuildingFloorNodes,
  suggestBuildingFloorPairs,
} from '../services/buildingConnectorService';

export async function getBuildingConnectorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const data = await listBuildingFloorConnectors(buildingId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBuildingConnectorSuggestionsHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const suggestions = await suggestBuildingFloorPairs(buildingId);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
}

export async function pairBuildingFloorNodesHandler(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const buildingId = req.params.id as string;
    const { fromNodeId, toNodeId } = req.body;
    if (!fromNodeId || !toNodeId) {
      throw new AppError('fromNodeId and toNodeId are required', 400);
    }
    const edge = await pairBuildingFloorNodes(fromNodeId, toNodeId);
    await logActionForRequest(req, 'PAIR_BUILDING_CONNECTOR', 'NavEdge', edge.id, {
      buildingId,
      fromNodeId,
      toNodeId,
    });
    const data = await listBuildingFloorConnectors(buildingId);
    res.status(201).json({ success: true, data: { edge, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function autoPairBuildingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const dryRun = req.body?.dryRun === true;
    const result = await autoPairBuildingFloorConnectors(buildingId, dryRun);
    if (!dryRun) {
      await logActionForRequest(req, 'AUTO_PAIR_BUILDING', 'MapBuilding', buildingId, result);
    }
    const data = await listBuildingFloorConnectors(buildingId);
    res.json({ success: true, data: { ...result, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function deleteBuildingEdgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const edgeId = req.params.edgeId as string;
    await deleteCrossBuildingEdge(edgeId);
    await logActionForRequest(req, 'DELETE_BUILDING_CONNECTOR', 'NavEdge', edgeId, { buildingId });
    const data = await listBuildingFloorConnectors(buildingId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
