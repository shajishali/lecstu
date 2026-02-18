import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logAction } from '../services/auditLogger';

const INCLUDE = {
  building: { select: { id: true, name: true, code: true } },
  hall: { select: { id: true, name: true } },
  office: { select: { id: true, roomNumber: true, lecturer: { select: { firstName: true, lastName: true } } } },
};

export async function listMarkers(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor, type, search } = req.query as Record<string, string>;
    const where: any = {};
    if (buildingId) where.buildingId = buildingId;
    if (floor) where.floor = parseInt(floor);
    if (type) where.type = type;
    if (search) {
      where.label = { contains: search, mode: 'insensitive' };
    }

    const data = await prisma.mapMarker.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ building: { name: 'asc' } }, { floor: 'asc' }, { label: 'asc' }],
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getMarker(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const marker = await prisma.mapMarker.findUnique({ where: { id }, include: INCLUDE });
    if (!marker) throw new AppError('Marker not found', 404);
    res.json({ success: true, data: marker });
  } catch (err) { next(err); }
}

export async function createMarker(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor, type, label, x, y, hallId, officeId, metadata } = req.body;
    const marker = await prisma.mapMarker.create({
      data: {
        buildingId, floor: floor || 0, type, label,
        x: parseFloat(x), y: parseFloat(y),
        hallId: hallId || null, officeId: officeId || null,
        metadata,
      },
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'CREATE', 'MapMarker', marker.id, { label, type, buildingId });
    res.status(201).json({ success: true, data: marker });
  } catch (err) { next(err); }
}

export async function updateMarker(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapMarker.findUnique({ where: { id } });
    if (!existing) throw new AppError('Marker not found', 404);

    const data: any = { ...req.body };
    if (data.x !== undefined) data.x = parseFloat(data.x);
    if (data.y !== undefined) data.y = parseFloat(data.y);
    if (data.hallId === '') data.hallId = null;
    if (data.officeId === '') data.officeId = null;

    const marker = await prisma.mapMarker.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'UPDATE', 'MapMarker', id, req.body);
    res.json({ success: true, data: marker });
  } catch (err) { next(err); }
}

export async function deleteMarker(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapMarker.findUnique({ where: { id } });
    if (!existing) throw new AppError('Marker not found', 404);

    await prisma.mapMarker.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE', 'MapMarker', id, { label: existing.label });
    res.json({ success: true, message: 'Marker deleted' });
  } catch (err) { next(err); }
}

export async function getMarkerDropdowns(_req: Request, res: Response, next: NextFunction) {
  try {
    const [buildings, halls, offices] = await Promise.all([
      prisma.mapBuilding.findMany({ select: { id: true, name: true, code: true, floors: true }, orderBy: { name: 'asc' } }),
      prisma.lectureHall.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      prisma.lecturerOffice.findMany({
        select: { id: true, roomNumber: true, lecturer: { select: { firstName: true, lastName: true } } },
        orderBy: { roomNumber: 'asc' },
      }),
    ]);

    res.json({ success: true, data: { buildings, halls, offices } });
  } catch (err) { next(err); }
}
