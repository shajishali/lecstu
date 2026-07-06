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
import {
  getRecoveryEmailRequiredMessage,
  needsRecoveryEmailForCodeDelivery,
} from '../utils/emailDomains';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getCodeDeliveryEmail(recoveryEmail: string): string {
  return normalizeEmail(recoveryEmail);
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

    if (needsRecoveryEmailForCodeDelivery(recoveryEmail)) {
      throw new AppError(getRecoveryEmailRequiredMessage(), 400);
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

    const deliveryEmail = getCodeDeliveryEmail(recoveryEmail!);
    const { code } = await createRegistrationVerificationToken(loginEmail);

    let emailDelivered = false;
    let devVerificationCode: string | undefined;
    let deliveryWarning: string | undefined;
    let smtpError: string | undefined;

    try {
      const delivery = await sendRegistrationVerificationEmail({
        to: deliveryEmail,
        firstName,
        code,
        expiryMinutes: REGISTRATION_CODE_EXPIRY_MINUTES,
      });
      emailDelivered = delivery.delivered;
      deliveryWarning = delivery.deliveryWarning || undefined;
      logEmailVerificationEvent('registration-send-code', req, {
        email: loginEmail,
        success: delivery.delivered,
      });
    } catch (err) {
      logEmailVerificationEvent('registration-send-code', req, { email: loginEmail, success: false });
      const message = err instanceof Error ? err.message : 'SMTP send failed';
      smtpError = message;
      console.error('[LECSTU][registration] Failed to send verification email:', err);
    }

    const isDev = config.nodeEnv !== 'production';
    if (isDev) {
      devVerificationCode = code;
    }

    const combinedWarning =
      deliveryWarning ||
      (!emailDelivered && isDev
        ? 'Gmail SMTP login failed. Regenerate an app password for SMTP_USER in server/.env, then restart the server.'
        : undefined);

    res.json({
      success: true,
      message: emailDelivered
        ? 'Verification code sent to your personal email. Check your inbox and spam folder.'
        : 'Verification code generated. Email could not be delivered — use the code shown below or fix SMTP settings.',
      ...(emailDelivered ? { sentToMasked: maskEmail(deliveryEmail), emailDelivered: true } : { emailDelivered: false }),
      ...(combinedWarning ? { deliveryWarning: combinedWarning } : {}),
      ...(isDev && {
        devDelivery: getEmailServiceMode(),
        devVerificationCode,
        devHint: emailDelivered
          ? 'Verification code sent to your personal recovery email.'
          : 'Email not sent — use the dev code below or check SMTP settings in server/.env.',
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
