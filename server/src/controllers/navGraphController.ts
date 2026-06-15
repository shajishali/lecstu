import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { NavNodeType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  createNavEdge,
  createNavNode,
  deleteNavEdge,
  deleteNavNode,
  getNavEditorContext,
  getNavGraphForFloor,
  syncNavNodesFromMarkers,
  updateNavNode,
} from '../services/indoorNavigationService';

export async function getNavEditor(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floor = parseInt(String(req.query.floor ?? '0'), 10);
    if (!buildingId || Number.isNaN(floor)) {
      throw new AppError('buildingId and floor are required', 400);
    }
    const data = await getNavEditorContext(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getPublicNavGraph(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floor = parseInt(String(req.query.floor ?? '0'), 10);
    if (!buildingId || Number.isNaN(floor)) {
      throw new AppError('buildingId and floor are required', 400);
    }
    const data = await getNavGraphForFloor(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** @deprecated Prefer GET /api/map/indoor-route — same handler via map routes */
export { getIndoorRoute as getNavRoute } from './indoorRouteController';

export async function createNavNodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor, label, x, y, type, mapMarkerId } = req.body;
    if (!buildingId || !label || type == null) {
      throw new AppError('buildingId, label, and type are required', 400);
    }
    const node = await createNavNode({
      buildingId,
      floor: parseInt(String(floor ?? 0), 10),
      label,
      x,
      y,
      type: type as NavNodeType,
      mapMarkerId: mapMarkerId || null,
    });
    await logActionForRequest(req, 'CREATE_NAV_NODE', 'NavNode', node.id, { buildingId, floor });
    res.status(201).json({ success: true, data: node });
  } catch (err) {
    next(err);
  }
}

export async function updateNavNodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const node = await updateNavNode(id, req.body);
    await logActionForRequest(req, 'UPDATE_NAV_NODE', 'NavNode', id, req.body);
    res.json({ success: true, data: node });
  } catch (err) {
    next(err);
  }
}

export async function deleteNavNodeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const removed = await deleteNavNode(id);
    await logActionForRequest(req, 'DELETE_NAV_NODE', 'NavNode', id, { label: removed.label });
    res.json({ success: true, message: 'Node deleted' });
  } catch (err) {
    next(err);
  }
}

export async function createNavEdgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { fromNodeId, toNodeId, weight, bidirectional, label } = req.body;
    if (!fromNodeId || !toNodeId) {
      throw new AppError('fromNodeId and toNodeId are required', 400);
    }
    const edge = await createNavEdge({ fromNodeId, toNodeId, weight, bidirectional, label });
    const from = await prisma.navNode.findUnique({ where: { id: fromNodeId }, select: { buildingId: true, floor: true } });
    if (from) {
      const { saveWalkingPathsSnapshot } = await import('../services/navGraphBuildService');
      void saveWalkingPathsSnapshot(from.buildingId, from.floor);
    }
    await logActionForRequest(req, 'CREATE_NAV_EDGE', 'NavEdge', edge.id, { fromNodeId, toNodeId });
    res.status(201).json({ success: true, data: edge });
  } catch (err) {
    next(err);
  }
}

export async function deleteNavEdgeHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.navEdge.findUnique({
      where: { id },
      include: { from: { select: { buildingId: true, floor: true } } },
    });
    await deleteNavEdge(id);
    if (existing?.from) {
      const { saveWalkingPathsSnapshot } = await import('../services/navGraphBuildService');
      void saveWalkingPathsSnapshot(existing.from.buildingId, existing.from.floor);
    }
    await logActionForRequest(req, 'DELETE_NAV_EDGE', 'NavEdge', id, {});
    res.json({ success: true, message: 'Edge deleted' });
  } catch (err) {
    next(err);
  }
}

export async function syncNavFromMarkers(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor } = req.body;
    if (!buildingId) throw new AppError('buildingId is required', 400);
    const result = await syncNavNodesFromMarkers(
      buildingId,
      floor !== undefined ? parseInt(String(floor), 10) : undefined
    );
    await logActionForRequest(req, 'SYNC_NAV_FROM_MARKERS', 'MapBuilding', buildingId, result);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
