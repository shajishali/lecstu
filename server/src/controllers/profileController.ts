import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        profileImage: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, phone, departmentId } = req.body;

    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) throw new AppError('Department not found', 404);
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(departmentId !== undefined && { departmentId: departmentId || null }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        profileImage: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatar(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('No image file provided', 400);

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { profileImage: true },
    });

    if (currentUser?.profileImage) {
      const oldPath = path.join(config.upload.uploadDir, path.basename(currentUser.profileImage));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { profileImage: imageUrl },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        profileImage: true,
        isActive: true,
        department: { select: { id: true, name: true, code: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Avatar uploaded',
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(_req: Request, res: Response, next: NextFunction) {
  try {
    const departments = await prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: { departments } });
  } catch (err) {
    next(err);
  }
}
