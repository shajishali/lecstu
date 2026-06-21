import { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../generated/prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { hashPassword } from '../utils/password';
import {
  assignStudentToGroup,
  validateStudentEnrollmentInput,
} from '../services/studentEnrollmentService';
import { deriveTimetableCodeFromName } from '../services/lecturerInitialsMatch';
import { invalidateLecturerDisplayIndex } from '../services/lecturerDisplayService';
import { logActionForRequest } from '../services/auditLogger';
import type { StudyYear } from '../config/fct-faculty-config';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const userListSelect = {
  id: true,
  email: true,
  recoveryEmail: true,
  firstName: true,
  lastName: true,
  role: true,
  phone: true,
  designation: true,
  timetableCode: true,
  isActive: true,
  createdAt: true,
  department: { select: { id: true, name: true, code: true } },
  studentGroupMemberships: {
    select: {
      group: { select: { id: true, name: true, batchLabel: true } },
    },
  },
  lecturerOffice: { select: { id: true, roomNumber: true, building: true } },
} as const;

const userDetailSelect = {
  ...userListSelect,
  updatedAt: true,
} as const;

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.query.role as string | undefined;
    const active = req.query.active as string | undefined;
    const q = (req.query.q as string | undefined)?.trim();

    const where: {
      role?: UserRole;
      isActive?: boolean;
      OR?: Array<Record<string, unknown>>;
    } = {};

    if (role && ['ADMIN', 'LECTURER', 'STUDENT'].includes(role)) {
      where.role = role as UserRole;
    }
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;

    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { timetableCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    res.json({ success: true, data: users });
  } catch (err) {
    next(err);
  }
}

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: paramId(req) },
      select: userDetailSelect,
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      phone,
      departmentId,
      designation,
      timetableCode,
      programCode,
      studyYear,
      pathwayCode,
    } = req.body;

    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existing) {
      throw new AppError('A user with this email already exists', 409);
    }

    if (role === 'LECTURER' || role === 'ADMIN') {
      if (departmentId) {
        const dept = await prisma.department.findUnique({ where: { id: departmentId } });
        if (!dept) throw new AppError('Department not found', 404);
      }
    }

    const hashedPassword = await hashPassword(password);
    const actorId = req.user!.userId;
    let resolvedTimetableCode: string | null = null;
    if (role === 'LECTURER') {
      resolvedTimetableCode =
        (timetableCode && String(timetableCode).trim().toUpperCase()) ||
        deriveTimetableCodeFromName(String(firstName), String(lastName));
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        role,
        phone: phone?.trim() || null,
        departmentId: role === 'STUDENT' ? null : departmentId || null,
        designation: role === 'LECTURER' ? designation?.trim() || null : null,
        timetableCode: resolvedTimetableCode,
        ...(role === 'LECTURER'
          ? { adminLastModifiedAt: new Date(), adminLastModifiedById: actorId }
          : {}),
      },
      select: userDetailSelect,
    });

    if (role === 'STUDENT') {
      const enrollment = validateStudentEnrollmentInput(
        programCode,
        studyYear,
        pathwayCode,
      );
      await assignStudentToGroup(
        user.id,
        enrollment.programCode,
        enrollment.studyYear as StudyYear,
        enrollment.pathwayCode,
      );
    }

    if (role === 'LECTURER') {
      invalidateLecturerDisplayIndex();
      await logActionForRequest(req, 'CREATE', 'User', user.id, {
        role,
        email: normalizedEmail,
      });
    }

    const full = await prisma.user.findUnique({
      where: { id: user.id },
      select: userDetailSelect,
    });

    res.status(201).json({ success: true, data: full });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const actorId = req.user!.userId;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404);

    const {
      firstName,
      lastName,
      phone,
      recoveryEmail,
      departmentId,
      designation,
      timetableCode,
      isActive,
      programCode,
      studyYear,
      pathwayCode,
    } = req.body;

    if (isActive === false && id === actorId) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    if (isActive === false && existing.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true, id: { not: id } },
      });
      if (activeAdmins === 0) {
        throw new AppError('Cannot deactivate the last active admin account', 400);
      }
    }

    const data: Record<string, unknown> = {};
    if (firstName !== undefined) data.firstName = String(firstName).trim();
    if (lastName !== undefined) data.lastName = String(lastName).trim();
    if (phone !== undefined) data.phone = phone?.trim() || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (recoveryEmail !== undefined) {
      const normalized =
        recoveryEmail && String(recoveryEmail).trim()
          ? normalizeEmail(String(recoveryEmail))
          : null;
      if (normalized && normalized === existing.email.toLowerCase()) {
        throw new AppError('Recovery email must be different from the login email', 400);
      }
      if (normalized) {
        const taken = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: normalized, mode: 'insensitive' } },
              { recoveryEmail: { equals: normalized, mode: 'insensitive' } },
            ],
            NOT: { id },
          },
          select: { id: true },
        });
        if (taken) {
          throw new AppError('This recovery email is already used by another account', 409);
        }
      }
      data.recoveryEmail = normalized;
    }

    if (existing.role === 'LECTURER' || existing.role === 'ADMIN') {
      if (departmentId !== undefined) {
        if (departmentId) {
          const dept = await prisma.department.findUnique({ where: { id: departmentId } });
          if (!dept) throw new AppError('Department not found', 404);
        }
        data.departmentId = departmentId || null;
      }
    }

    if (existing.role === 'LECTURER') {
      if (designation !== undefined) data.designation = designation?.trim() || null;
      if (timetableCode !== undefined) {
        data.timetableCode = timetableCode?.trim()
          ? String(timetableCode).trim().toUpperCase()
          : deriveTimetableCodeFromName(
              String(data.firstName ?? existing.firstName),
              String(data.lastName ?? existing.lastName),
            );
      }
      data.adminLastModifiedAt = new Date();
      data.adminLastModifiedById = actorId;
    }

    await prisma.user.update({ where: { id }, data });

    if (existing.role === 'LECTURER') {
      invalidateLecturerDisplayIndex();
      await logActionForRequest(req, 'UPDATE', 'User', id, {
        role: existing.role,
        email: existing.email,
      });
    }

    if (
      existing.role === 'STUDENT' &&
      programCode !== undefined &&
      studyYear !== undefined
    ) {
      const enrollment = validateStudentEnrollmentInput(
        programCode,
        studyYear,
        pathwayCode,
      );
      await assignStudentToGroup(
        id,
        enrollment.programCode,
        enrollment.studyYear as StudyYear,
        enrollment.pathwayCode,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: userDetailSelect,
    });

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        email: true,
        firstName: true,
        lastName: true,
        timetableCode: true,
      },
    });
    if (!existing) throw new AppError('User not found', 404);
    if (existing.role !== 'LECTURER') {
      throw new AppError('Only lecturer accounts can be removed from the directory', 400);
    }

    await prisma.user.delete({ where: { id } });
    invalidateLecturerDisplayIndex();
    await logActionForRequest(req, 'DELETE', 'User', id, {
      email: existing.email,
      name: `${existing.firstName} ${existing.lastName}`,
      timetableCode: existing.timetableCode,
    });

    res.json({ success: true, message: 'Lecturer removed' });
  } catch (err) {
    next(err);
  }
}

export async function resetUserPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const id = paramId(req);
    const { password } = req.body;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new AppError('User not found', 404);

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });

    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}
