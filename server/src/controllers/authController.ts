import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  TokenPayload,
} from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import {
  assignStudentToGroup,
  getRegisterOptions,
} from '../services/studentEnrollmentService';
import { deriveTimetableCodeFromName } from '../services/lecturerInitialsMatch';
import { userProfileSelect } from '../constants/userProfileSelect';
import type { StudyYear } from '../../prisma/fct-faculty-config';
import {
  consumeRegistrationVerification,
} from '../services/registrationVerificationService';
import { logEmailVerificationEvent } from '../utils/emailVerificationAudit';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getRegistrationOptions(_req: Request, res: Response) {
  res.json({ success: true, data: getRegisterOptions() });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      departmentId,
      phone,
      programCode,
      studyYear,
      pathwayCode,
      verificationCode,
      recoveryEmail,
    } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const code = String(verificationCode || '').trim();
    if (!/^\d{6}$/.test(code)) {
      throw new AppError('Email verification code is required. Send and enter the 6-digit code.', 400);
    }

    const verification = await consumeRegistrationVerification(normalizedEmail, code);
    if (!verification.valid) {
      logEmailVerificationEvent('register', req, { email: normalizedEmail, success: false });
      throw new AppError('Invalid or expired verification code. Request a new code and try again.', 400);
    }

    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existing) {
      throw new AppError(
        'This email is already registered. Sign in with that email or use a different one.',
        409,
      );
    }

    if (departmentId && role !== 'STUDENT') {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept) {
        throw new AppError('Department not found', 404);
      }
    }

    const hashedPassword = await hashPassword(password);

    let resolvedDepartmentId: string | null = departmentId || null;

    const lecturerCode =
      role === 'LECTURER' ? deriveTimetableCodeFromName(String(firstName), String(lastName)) : null;

    let normalizedRecovery: string | null = null;
    if (recoveryEmail && String(recoveryEmail).trim()) {
      normalizedRecovery = normalizeEmail(String(recoveryEmail));
      if (normalizedRecovery === normalizedEmail) {
        throw new AppError('Recovery email must be different from your login email', 400);
      }
    }

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        recoveryEmail: normalizedRecovery,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        departmentId: role === 'STUDENT' ? null : resolvedDepartmentId,
        phone: phone || null,
        ...(lecturerCode ? { timetableCode: lecturerCode } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: { select: { id: true, name: true, code: true } },
        createdAt: true,
      },
    });

    if (role === 'STUDENT') {
      const enrollment = await assignStudentToGroup(
        user.id,
        programCode,
        studyYear as StudyYear,
        pathwayCode || undefined,
      );
      resolvedDepartmentId = enrollment.departmentId;
    }

    const userWithGroups = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: { select: { id: true, name: true, code: true } },
        studentGroupMemberships: {
          select: {
            group: {
              select: {
                id: true,
                name: true,
                batchYear: true,
                batchLabel: true,
                pathway: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        createdAt: true,
      },
    });

    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    logEmailVerificationEvent('register', req, { userId: user.id, email: normalizedEmail, success: true });

    res.status(201).json({
      success: true,
      message:
        role === 'STUDENT'
          ? 'Registration successful. You are linked to your class group for timetable and hall booking.'
          : 'Registration successful',
      data: { user: userWithGroups ?? user, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: {
        department: { select: { id: true, name: true, code: true } },
        studentGroupMemberships: {
          select: { group: { select: { id: true, name: true, batchYear: true, batchLabel: true, pathway: { select: { id: true, name: true, code: true } } } } },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Account is deactivated. Contact admin.', 403);
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: userWithoutPassword, accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.refresh_token ||
      (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
    if (!token) {
      throw new AppError('Refresh token not found', 401);
    }

    let decoded: TokenPayload;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      clearAuthCookies(res);
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      clearAuthCookies(res);
      throw new AppError('User not found or deactivated', 401);
    }

    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.json({
      success: true,
      message: 'Token refreshed',
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookies(res);
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.json({ success: true, data: { user: null } });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: userProfileSelect,
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}
