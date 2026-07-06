import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  assignStudentToGroup,
  validateStudentEnrollmentInput,
} from '../services/studentEnrollmentService';
import { invalidateUser as invalidateTimetableCacheForUser } from '../services/timetableCache';
import {
  deriveTimetableCodeFromName,
} from '../services/lecturerInitialsMatch';
import { userProfileSelect } from '../constants/userProfileSelect';
import { comparePassword, hashPassword } from '../utils/password';
import {
  createResetToken,
  verifyResetCode,
  markResetTokenUsed,
  purgeExpiredResetTokens,
  RESET_CODE_EXPIRY_MINUTES,
} from '../services/passwordResetService';
import {
  sendPasswordResetCodeEmail,
  getEmailServiceMode,
  maskEmail,
} from '../services/emailService';
import { logEmailVerificationEvent } from '../utils/emailVerificationAudit';
import { getUniversityDeliveryWarning, isUniversityEmail } from '../utils/emailDomains';

const FCT_BUILDING_DEFAULT =
  'Faculty of Computing and Technology, University of Kelaniya';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getProfileCodeDeliveryEmail(user: { email: string; recoveryEmail: string | null }): string {
  const recovery = user.recoveryEmail?.trim();
  return recovery ? normalizeEmail(recovery) : normalizeEmail(user.email);
}

async function syncLecturerOffice(
  userId: string,
  office: { roomNumber?: string; building?: string; floor?: number | string } | null | undefined,
) {
  if (office === undefined) return;

  const room = typeof office?.roomNumber === 'string' ? office.roomNumber.trim() : '';
  const building = typeof office?.building === 'string' ? office.building.trim() : '';

  if (!room && !building) {
    await prisma.lecturerOffice.deleteMany({ where: { lecturerId: userId } });
    return;
  }
  if (!room || !building) {
    throw new AppError('Office room number and building are both required', 400);
  }

  const floorRaw = office?.floor;
  const floor =
    typeof floorRaw === 'number' && Number.isFinite(floorRaw)
      ? Math.max(0, Math.floor(floorRaw))
      : Math.max(0, parseInt(String(floorRaw ?? 0), 10) || 0);

  await prisma.lecturerOffice.upsert({
    where: { lecturerId: userId },
    create: { lecturerId: userId, roomNumber: room, building, floor },
    update: { roomNumber: room, building, floor },
  });
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: userProfileSelect,
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { firstName, lastName, phone, email, recoveryEmail, departmentId, groupId, timetableCode, office } = req.body;
    const userId = req.user!.userId;

    // Validate departmentId if provided; if it references a deleted department, treat as "clear" (null)
    let resolvedDepartmentId: string | null = departmentId === undefined ? undefined : (departmentId || null);
    if (resolvedDepartmentId) {
      const dept = await prisma.department.findUnique({ where: { id: resolvedDepartmentId } });
      if (!dept) {
        // Orphaned reference (e.g. after seed reset) — clear it instead of failing
        resolvedDepartmentId = null;
      }
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!currentUser) throw new AppError('User not found', 404);

    // Class group & department for students are set only via PATCH /profile/enrollment
    const profileData: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      email?: string;
      recoveryEmail?: string | null;
      departmentId?: string | null;
      timetableCode?: string | null;
    } = {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone: phone || null }),
    };

    if (email !== undefined) {
      const normalizedEmail = normalizeEmail(String(email));
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (existingEmail) {
        throw new AppError('This email is already registered to another account.', 409);
      }
      profileData.email = normalizedEmail;
    }

    if (recoveryEmail !== undefined) {
      const normalized =
        recoveryEmail && String(recoveryEmail).trim()
          ? normalizeEmail(String(recoveryEmail))
          : null;
      const currentEmail = email !== undefined
        ? normalizeEmail(String(email))
        : (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email.toLowerCase();
      if (normalized && normalized === currentEmail) {
        throw new AppError('Recovery email must be different from your login email', 400);
      }
      if (normalized) {
        const taken = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: normalized, mode: 'insensitive' } },
              { recoveryEmail: { equals: normalized, mode: 'insensitive' } },
            ],
            NOT: { id: userId },
          },
          select: { id: true },
        });
        if (taken) {
          throw new AppError('This recovery email is already used by another account.', 409);
        }
      }
      profileData.recoveryEmail = normalized;
    }

    if (currentUser.role !== 'STUDENT' && departmentId !== undefined) {
      profileData.departmentId = resolvedDepartmentId ?? null;
    }
    if (currentUser.role === 'LECTURER') {
      const existing = await prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, timetableCode: true },
      });
      const nextFirst = firstName !== undefined ? String(firstName).trim() : existing?.firstName ?? '';
      const nextLast = lastName !== undefined ? String(lastName).trim() : existing?.lastName ?? '';

      if (timetableCode !== undefined) {
        const code = typeof timetableCode === 'string' ? timetableCode.trim().toUpperCase() : '';
        profileData.timetableCode = code || deriveTimetableCodeFromName(nextFirst, nextLast) || null;
      } else if (!existing?.timetableCode?.trim()) {
        const auto = deriveTimetableCodeFromName(nextFirst, nextLast);
        if (auto) profileData.timetableCode = auto;
      }
    }

    if (Object.keys(profileData).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: profileData });
    }

    if (currentUser.role === 'LECTURER' && office !== undefined) {
      await syncLecturerOffice(userId, office);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    });
    if (!user) throw new AppError('User not found', 404);

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
      select: userProfileSelect,
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

/** Annual re-enrollment: update study year / program / pathway and class group */
export async function updateStudentEnrollment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!currentUser) throw new AppError('User not found', 404);
    if (currentUser.role !== 'STUDENT') {
      throw new AppError('Only students can update academic enrollment.', 403);
    }

    const { programCode, studyYear, pathwayCode, groupId, batchYearLabel } = req.body;
    const validated = validateStudentEnrollmentInput(
      String(programCode),
      String(studyYear),
      pathwayCode ? String(pathwayCode) : null,
    );

    const enrollment = await assignStudentToGroup(
      userId,
      validated.programCode,
      validated.studyYear,
      validated.pathwayCode,
      groupId ? String(groupId) : undefined,
      batchYearLabel ? String(batchYearLabel) : null,
    );

    invalidateTimetableCacheForUser(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userProfileSelect,
    });

    res.json({
      success: true,
      message: `Enrollment updated for ${enrollment.groupName}. Your timetable will match this group.`,
      data: { user, groupName: enrollment.groupName },
    });
  } catch (err) {
    next(err);
  }
}

export async function getGroups(_req: Request, res: Response, next: NextFunction) {
  try {
    const groups = await prisma.studentGroup.findMany({
      select: {
        id: true,
        name: true,
        batchYear: true,
        batchLabel: true,
        departmentId: true,
        pathway: { select: { id: true, name: true, code: true } },
        _count: {
          select: {
            timetableEntries: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ name: 'asc' }],
    });

    const groupsWithCounts = groups.map(({ _count, ...g }) => ({
      ...g,
      entryCount: _count.timetableEntries,
    }));

    res.json({ success: true, data: { groups: groupsWithCounts } });
  } catch (err) {
    next(err);
  }
}

export async function requestPasswordChangeCode(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { currentPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        password: true,
        firstName: true,
        lastName: true,
        email: true,
        recoveryEmail: true,
        isActive: true,
      },
    });
    if (!user || !user.isActive) throw new AppError('User not found', 404);

    const valid = await comparePassword(String(currentPassword), user.password);
    if (!valid) throw new AppError('Current password is incorrect. Please try again.', 400);

    void purgeExpiredResetTokens().catch(() => {});

    const deliveryEmail = getProfileCodeDeliveryEmail(user);
    const { code } = await createResetToken(user.id);

    let emailDelivered = false;
    let deliveryWarning: string | undefined;
    try {
      const delivery = await sendPasswordResetCodeEmail({
        to: deliveryEmail,
        firstName: user.firstName,
        code,
        expiryMinutes: RESET_CODE_EXPIRY_MINUTES,
      });
      emailDelivered = delivery.delivered;
      deliveryWarning = delivery.deliveryWarning || undefined;
      if (emailDelivered) {
        console.log(`[LECSTU][profile-password] Reset code emailed to ${deliveryEmail}`);
      }
    } catch (err) {
      console.error(`[LECSTU][profile-password] Failed to email ${deliveryEmail}:`, err);
    }

    logEmailVerificationEvent('profile-password-request-code', req, {
      userId: user.id,
      success: emailDelivered,
    });

    const isDev = config.nodeEnv !== 'production';
    const universityWarning = getUniversityDeliveryWarning(deliveryEmail);
    const combinedWarning =
      deliveryWarning ||
      universityWarning ||
      (!emailDelivered && isDev
        ? 'Gmail SMTP login failed. Regenerate an app password for SMTP_USER in server/.env, then restart the server.'
        : undefined);

    const emailMode = getEmailServiceMode();
    const sentToMasked = maskEmail(deliveryEmail);
    res.json({
      success: true,
      message: emailDelivered
        ? `Verification code sent to ${sentToMasked}. Enter it below to set your new password.`
        : 'Verification code created. Email could not be delivered — check SMTP settings or use the dev code below.',
      sentToMasked,
      emailDelivered,
      ...(combinedWarning ? { deliveryWarning: combinedWarning } : {}),
      ...(isDev && {
        devDelivery: emailMode,
        devResetCode: code,
        devHint: emailMode === 'console'
          ? 'Console mode is ON — check the API terminal for the code.'
          : emailDelivered
            ? user.recoveryEmail
              ? 'Code sent to your recovery email inbox.'
              : isUniversityEmail(deliveryEmail)
                ? 'University Outlook may quarantine external mail — also use the dev code below if needed.'
                : 'Check your inbox and spam folder for the 6-digit code.'
            : 'Email not sent — use the dev code below or fix SMTP in server/.env.',
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyPasswordChangeCode(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const code = String(req.body.verificationCode || '').trim();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user || !user.isActive) throw new AppError('User not found', 404);

    const verification = await verifyResetCode(user.id, code);
    if (!verification.valid) {
      logEmailVerificationEvent('profile-password-verify-code', req, { userId: user.id, success: false });
      throw new AppError('Invalid or expired verification code. Check the code and try again.', 400);
    }

    logEmailVerificationEvent('profile-password-verify-code', req, { userId: user.id, success: true });
    res.json({ success: true, valid: true, message: 'Code verified. You can set your new password.' });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, password: true },
    });
    if (!user) throw new AppError('User not found', 404);

    if (user.role === 'STUDENT' || user.role === 'LECTURER') {
      throw new AppError(
        'Use the password section below: verify your current password, then enter the email code.',
        403,
      );
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 400);

    if (currentPassword === newPassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(newPassword) },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function confirmPasswordChange(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { verificationCode, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, password: true },
    });
    if (!user) throw new AppError('User not found', 404);

    const code = String(verificationCode || '').trim();
    const verification = await verifyResetCode(user.id, code);
    if (!verification.valid) {
      logEmailVerificationEvent('profile-password-change', req, { userId: user.id, success: false });
      throw new AppError('Invalid or expired verification code. Request a new code and try again.', 400);
    }

    const samePassword = await comparePassword(String(newPassword), user.password);
    if (samePassword) {
      throw new AppError('New password must be different from the current password', 400);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { password: await hashPassword(String(newPassword)) },
    });
    await markResetTokenUsed(verification.tokenId);

    logEmailVerificationEvent('profile-password-change', req, { userId: user.id, success: true });
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}
