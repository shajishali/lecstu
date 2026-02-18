import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logAction } from '../services/auditLogger';

const INCLUDE = {
  _count: { select: { markers: true, floorPlans: true } },
  floorPlans: { select: { id: true, floor: true, imagePath: true }, orderBy: { floor: 'asc' as const } },
};

export async function listBuildings(req: Request, res: Response, next: NextFunction) {
  try {
    const { search } = req.query as Record<string, string>;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.mapBuilding.findMany({
      where,
      include: INCLUDE,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const building = await prisma.mapBuilding.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        markers: {
          include: {
            hall: { select: { id: true, name: true } },
            office: { select: { id: true, roomNumber: true, lecturer: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { floor: 'asc' },
        },
      },
    });
    if (!building) throw new AppError('Building not found', 404);
    res.json({ success: true, data: building });
  } catch (err) { next(err); }
}

export async function createBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, code, latitude, longitude, floors, metadata } = req.body;
    const building = await prisma.mapBuilding.create({
      data: { name, code, latitude: parseFloat(latitude), longitude: parseFloat(longitude), floors: floors || 1, metadata },
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'CREATE', 'MapBuilding', building.id, { name, code });
    res.status(201).json({ success: true, data: building });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A building with this code already exists', 409));
    next(err);
  }
}

export async function updateBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapBuilding.findUnique({ where: { id } });
    if (!existing) throw new AppError('Building not found', 404);

    const data: any = { ...req.body };
    if (data.latitude) data.latitude = parseFloat(data.latitude);
    if (data.longitude) data.longitude = parseFloat(data.longitude);

    const building = await prisma.mapBuilding.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'UPDATE', 'MapBuilding', id, req.body);
    res.json({ success: true, data: building });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A building with this code already exists', 409));
    next(err);
  }
}

export async function deleteBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapBuilding.findUnique({ where: { id } });
    if (!existing) throw new AppError('Building not found', 404);

    await prisma.mapBuilding.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE', 'MapBuilding', id, { name: existing.name });
    res.json({ success: true, message: 'Building deleted' });
  } catch (err) { next(err); }
}

export async function uploadFloorPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(req.body.floor);
    if (isNaN(floor)) throw new AppError('Floor number is required', 400);
    if (!req.file) throw new AppError('Floor plan image is required', 400);

    const building = await prisma.mapBuilding.findUnique({ where: { id: buildingId } });
    if (!building) throw new AppError('Building not found', 404);

    const existing = await prisma.floorPlan.findUnique({
      where: { buildingId_floor: { buildingId, floor } },
    });

    if (existing) {
      const oldPath = path.resolve(__dirname, '../../uploads', path.basename(existing.imagePath));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

      const updated = await prisma.floorPlan.update({
        where: { id: existing.id },
        data: { imagePath: `/uploads/${req.file.filename}`, bounds: req.body.bounds ? JSON.parse(req.body.bounds) : undefined },
      });
      await logAction((req as any).user.id, 'UPDATE_FLOORPLAN', 'MapBuilding', buildingId, { floor });
      res.json({ success: true, data: updated });
    } else {
      const created = await prisma.floorPlan.create({
        data: {
          buildingId,
          floor,
          imagePath: `/uploads/${req.file.filename}`,
          bounds: req.body.bounds ? JSON.parse(req.body.bounds) : undefined,
        },
      });
      await logAction((req as any).user.id, 'UPLOAD_FLOORPLAN', 'MapBuilding', buildingId, { floor });
      res.status(201).json({ success: true, data: created });
    }
  } catch (err) { next(err); }
}

export async function deleteFloorPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.planId as string;
    const plan = await prisma.floorPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError('Floor plan not found', 404);

    const oldPath = path.resolve(__dirname, '../../uploads', path.basename(plan.imagePath));
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    await prisma.floorPlan.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE_FLOORPLAN', 'MapBuilding', plan.buildingId, { floor: plan.floor });
    res.json({ success: true, message: 'Floor plan deleted' });
  } catch (err) { next(err); }
}
