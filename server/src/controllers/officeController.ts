import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logAction } from '../services/auditLogger';

const INCLUDE = {
  lecturer: { select: { id: true, firstName: true, lastName: true, email: true } },
};

export async function listOffices(req: Request, res: Response, next: NextFunction) {
  try {
    const { search, building } = req.query as Record<string, string>;
    const where: any = {};
    if (building) where.building = building;
    if (search) {
      where.OR = [
        { roomNumber: { contains: search, mode: 'insensitive' } },
        { building: { contains: search, mode: 'insensitive' } },
        { lecturer: { firstName: { contains: search, mode: 'insensitive' } } },
        { lecturer: { lastName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const data = await prisma.lecturerOffice.findMany({
      where,
      include: INCLUDE,
      orderBy: { roomNumber: 'asc' },
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

export async function getOffice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const office = await prisma.lecturerOffice.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!office) throw new AppError('Office not found', 404);
    res.json({ success: true, data: office });
  } catch (err) { next(err); }
}

export async function createOffice(req: Request, res: Response, next: NextFunction) {
  try {
    const { roomNumber, building, floor, lecturerId } = req.body;
    const office = await prisma.lecturerOffice.create({
      data: { roomNumber, building, floor: floor || 0, lecturerId },
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'CREATE', 'LecturerOffice', office.id, { roomNumber, building, lecturerId });
    res.status(201).json({ success: true, data: office });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('This lecturer already has an office assigned', 409));
    next(err);
  }
}

export async function updateOffice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.lecturerOffice.findUnique({ where: { id } });
    if (!existing) throw new AppError('Office not found', 404);

    const office = await prisma.lecturerOffice.update({
      where: { id },
      data: req.body,
      include: INCLUDE,
    });
    await logAction((req as any).user.id, 'UPDATE', 'LecturerOffice', id, req.body);
    res.json({ success: true, data: office });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('This lecturer already has an office assigned', 409));
    next(err);
  }
}

export async function deleteOffice(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.lecturerOffice.findUnique({ where: { id } });
    if (!existing) throw new AppError('Office not found', 404);

    await prisma.lecturerOffice.delete({ where: { id } });
    await logAction((req as any).user.id, 'DELETE', 'LecturerOffice', id, { roomNumber: existing.roomNumber });
    res.json({ success: true, message: 'Office deleted' });
  } catch (err) { next(err); }
}

export async function getAvailableLecturers(_req: Request, res: Response, next: NextFunction) {
  try {
    const assigned = await prisma.lecturerOffice.findMany({ select: { lecturerId: true } });
    const assignedIds = assigned.map((o) => o.lecturerId);

    const lecturers = await prisma.user.findMany({
      where: { role: 'LECTURER', id: { notIn: assignedIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    });

    res.json({ success: true, data: lecturers });
  } catch (err) { next(err); }
}
