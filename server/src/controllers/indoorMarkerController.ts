import { Request, Response, NextFunction } from 'express';
import { MapMarkerType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  createIndoorMarker,
  getIndoorEditorContext,
  updateIndoorMarker,
} from '../services/indoorMarkerService';
import prisma from '../config/database';

export async function getIndoorEditor(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floor = parseInt(String(req.query.floor ?? '0'), 10);
    if (!buildingId || Number.isNaN(floor)) {
      throw new AppError('buildingId and floor are required', 400);
    }
    const data = await getIndoorEditorContext(buildingId, floor);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listIndoorMarkers(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.query.buildingId as string;
    const floor = parseInt(String(req.query.floor ?? '0'), 10);
    if (!buildingId || Number.isNaN(floor)) {
      throw new AppError('buildingId and floor are required', 400);
    }
    const ctx = await getIndoorEditorContext(buildingId, floor);
    res.json({ success: true, data: ctx.markers });
  } catch (err) {
    next(err);
  }
}

export async function createIndoorMarkerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor, type, label, x, y, hallId, officeId, legendNumber } = req.body;
    if (!buildingId || !type || !label) {
      throw new AppError('buildingId, type, and label are required', 400);
    }
    const parsedLegend =
      legendNumber != null && legendNumber !== ''
        ? parseInt(String(legendNumber), 10)
        : undefined;
    const marker = await createIndoorMarker({
      buildingId,
      floor: parseInt(String(floor ?? 0), 10),
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

export async function updateIndoorMarkerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const marker = await updateIndoorMarker(id, req.body);
    await logActionForRequest(req, 'UPDATE_INDOOR_MARKER', 'MapMarker', id, req.body);
    res.json({ success: true, data: marker });
  } catch (err) {
    next(err);
  }
}

export async function updateIndoorMarkerPosition(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { x, y } = req.body;
    const marker = await updateIndoorMarker(id, { x, y });
    res.json({ success: true, data: marker });
  } catch (err) {
    next(err);
  }
}

export async function deleteIndoorMarker(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapMarker.findUnique({ where: { id } });
    if (!existing) throw new AppError('Marker not found', 404);
    await prisma.mapMarker.delete({ where: { id } });
    const { markFloorPlanStaleAfterEdit } = await import('../services/floorPlanReviewService');
    await markFloorPlanStaleAfterEdit(existing.buildingId, existing.floor);
    await logActionForRequest(req, 'DELETE_INDOOR_MARKER', 'MapMarker', id, {
      label: existing.label,
    });
    res.json({ success: true, message: 'Marker deleted' });
  } catch (err) {
    next(err);
  }
}
