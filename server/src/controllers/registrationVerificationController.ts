import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { config } from '../config';
import {
  createRegistrationVerificationToken,
  verifyRegistrationCode,
  purgeExpiredRegistrationVerificationTokens,
  REGISTRATION_CODE_EXPIRY_MINUTES,
} from '../services/registrationVerificationService';
import {
  sendRegistrationVerificationEmail,
  getEmailServiceMode,
  maskEmail,
} from '../services/emailService';
import { logEmailVerificationEvent } from '../utils/emailVerificationAudit';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getCodeDeliveryEmail(loginEmail: string, recoveryEmail?: string | null): string {
  const recovery = recoveryEmail?.trim();
  return recovery ? normalizeEmail(recovery) : normalizeEmail(loginEmail);
}

export async function sendRegistrationCode(req: Request, res: Response, next: NextFunction) {
  try {
    const loginEmail = normalizeEmail(req.body.email);
    const recoveryEmail =
      typeof req.body.recoveryEmail === 'string' && req.body.recoveryEmail.trim()
        ? normalizeEmail(req.body.recoveryEmail)
        : null;
    const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : null;

    if (recoveryEmail && recoveryEmail === loginEmail) {
      throw new AppError('Recovery email must be different from your login email', 400);
    }

    void purgeExpiredRegistrationVerificationTokens().catch(() => {});

    const existing = await prisma.user.findFirst({
      where: { email: { equals: loginEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(
        'This email is already registered. Sign in or use a different email.',
        409,
      );
    }

    const deliveryEmail = getCodeDeliveryEmail(loginEmail, recoveryEmail);
    const { code } = await createRegistrationVerificationToken(loginEmail);

    let emailDelivered = false;
    let devVerificationCode: string | undefined;

    try {
      const delivery = await sendRegistrationVerificationEmail({
        to: deliveryEmail,
        firstName,
        code,
        expiryMinutes: REGISTRATION_CODE_EXPIRY_MINUTES,
      });
      emailDelivered = delivery.delivered;
      logEmailVerificationEvent('registration-send-code', req, {
        email: loginEmail,
        success: delivery.delivered,
      });
      if (!delivery.delivered && config.nodeEnv !== 'production') {
        devVerificationCode = code;
      }
    } catch (err) {
      logEmailVerificationEvent('registration-send-code', req, { email: loginEmail, success: false });
      console.error('[LECSTU][registration] Failed to send verification email:', err);
      if (config.nodeEnv !== 'production') {
        devVerificationCode = code;
      }
    }

    res.json({
      success: true,
      message: 'If this email is available, we sent a verification code.',
      ...(emailDelivered ? { sentToMasked: maskEmail(deliveryEmail), emailDelivered: true } : {}),
      ...(config.nodeEnv !== 'production' && {
        devDelivery: getEmailServiceMode(),
        devVerificationCode: emailDelivered ? undefined : devVerificationCode,
        devHint: emailDelivered
          ? recoveryEmail
            ? 'Verification code sent to your recovery email inbox.'
            : 'Verification code sent. Check inbox and spam.'
          : 'Email not sent — use the dev code below or check SMTP settings.',
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyRegistrationCodeEndpoint(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code).trim();

    const result = await verifyRegistrationCode(email, code);
    if (!result.valid) {
      logEmailVerificationEvent('registration-verify-code', req, { email, success: false });
      throw new AppError('Invalid or expired verification code. Request a new code and try again.', 400);
    }

    logEmailVerificationEvent('registration-verify-code', req, { email, success: true });
    res.json({ success: true, valid: true, message: 'Email verified. You can complete registration.' });
  } catch (err) {
    next(err);
  }
}
