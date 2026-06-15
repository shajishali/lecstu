import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  autoPairVerticalConnectors,
  deleteVerticalEdge,
  listVerticalConnectors,
  pairVerticalNodes,
  suggestVerticalPairs,
} from '../services/verticalConnectorService';

export async function getVerticalConnectorsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const data = await listVerticalConnectors(buildingId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getVerticalSuggestionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const suggestions = await suggestVerticalPairs(buildingId);
    res.json({ success: true, data: suggestions });
  } catch (err) {
    next(err);
  }
}

export async function pairVerticalNodesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const { fromNodeId, toNodeId } = req.body;
    if (!fromNodeId || !toNodeId) {
      throw new AppError('fromNodeId and toNodeId are required', 400);
    }
    const edge = await pairVerticalNodes(fromNodeId, toNodeId);
    await logActionForRequest(req, 'PAIR_VERTICAL_CONNECTOR', 'NavEdge', edge.id, {
      buildingId,
      fromNodeId,
      toNodeId,
    });
    const data = await listVerticalConnectors(buildingId);
    res.status(201).json({ success: true, data: { edge, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function autoPairVerticalHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const dryRun = req.body?.dryRun === true;
    const result = await autoPairVerticalConnectors(buildingId, dryRun);
    if (!dryRun) {
      await logActionForRequest(req, 'AUTO_PAIR_VERTICAL', 'MapBuilding', buildingId, result);
    }
    const data = await listVerticalConnectors(buildingId);
    res.json({ success: true, data: { ...result, ...data } });
  } catch (err) {
    next(err);
  }
}

export async function deleteVerticalEdgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const edgeId = req.params.edgeId as string;
    await deleteVerticalEdge(edgeId);
    await logActionForRequest(req, 'DELETE_VERTICAL_CONNECTOR', 'NavEdge', edgeId, { buildingId });
    const data = await listVerticalConnectors(buildingId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
