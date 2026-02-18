import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logAction } from '../services/auditLogger';

const INCLUDE = {
  _count: { select: { timetableEntries: true } },
};

export async function listHalls(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, building, activeOnly } = req.query as Record<string, string>;
    const where: any = {};
    if (building) where.building = building;
    if (activeOnly === 'true') where.isActive = true;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { building: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.lectureHall.findMany({
      where,
      include: INCLUDE,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getHall(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const hall = await prisma.lectureHall.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!hall) throw new AppError('Hall not found', 404);
    res.json({ success: true, data: hall });
  } catch (err) { next(err); }
}

export async function createHall(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, building, floor, capacity, equipment } = req.body;
    const hall = await prisma.lectureHall.create({
      data: { name, building, floor: floor || 0, capacity, equipment: equipment || [] },
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'CREATE', 'LectureHall', hall.id, { name, building, capacity });
    res.status(201).json({ success: true, data: hall });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A hall with this name already exists', 409));
    next(err);
  }
}

export async function updateHall(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.lectureHall.findUnique({ where: { id } });
    if (!existing) throw new AppError('Hall not found', 404);

    const hall = await prisma.lectureHall.update({
      where: { id },
      data: req.body,
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'UPDATE', 'LectureHall', id, req.body);
    res.json({ success: true, data: hall });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A hall with this name already exists', 409));
    next(err);
  }
}

export async function deleteHall(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.lectureHall.findUnique({ where: { id }, include: INCLUDE });
    if (!existing) throw new AppError('Hall not found', 404);
    if (existing._count.timetableEntries > 0) {
      throw new AppError(`Cannot delete: hall has ${existing._count.timetableEntries} timetable entries`, 400);
    }

    await prisma.lectureHall.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE', 'LectureHall', id, { name: existing.name });
    res.json({ success: true, message: 'Hall deleted' });
  } catch (err) { next(err); }
}

export async function getBuildings(_req: Request, res: Response, next: NextFunction) {
  try {
    const halls = await prisma.lectureHall.findMany({ select: { building: true }, distinct: ['building'], orderBy: { building: 'asc' } });
    res.json({ success: true, data: halls.map((h) => h.building) });
  } catch (err) { next(err); }
}
