import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { hashPassword, comparePassword } from '../utils/password';
import {
  createResetToken,
  verifyResetCode,
  verifyResetCodeByEmail,
  markResetTokenUsed,
  purgeExpiredResetTokens,
  RESET_CODE_EXPIRY_MINUTES,
} from '../services/passwordResetService';
import { sendPasswordResetCodeEmail, getEmailServiceMode, maskEmail } from '../services/emailService';
import { logEmailVerificationEvent } from '../utils/emailVerificationAudit';
import { config } from '../config';
import { getUniversityDeliveryWarning, isUniversityEmail } from '../utils/emailDomains';

const GENERIC_FORGOT_MESSAGE =
  'If that email is registered, we sent a reset code. Check your inbox and spam folder.';

const GENERIC_INVALID_CODE_MESSAGE = 'Invalid or expired reset code. Request a new code and try again.';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPasswordResetDeliveryEmail(user: { email: string; recoveryEmail: string | null }): string {
  const recovery = user.recoveryEmail?.trim();
  return recovery || user.email;
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    void purgeExpiredResetTokens().catch(() => {});

    const user = await prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [
          { email: { equals: normalizedEmail, mode: 'insensitive' } },
          { recoveryEmail: { equals: normalizedEmail, mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, recoveryEmail: true, firstName: true },
    });

    let sentToMasked: string | undefined;
    let emailDelivered = false;
    let devResetCode: string | undefined;
    let deliveryWarning: string | undefined;
    let smtpError: string | undefined;
    let deliveryEmail: string | undefined;
    let code: string | undefined;

    if (user) {
      deliveryEmail = getPasswordResetDeliveryEmail(user);
      const token = await createResetToken(user.id);
      code = token.code;

      try {
        const delivery = await sendPasswordResetCodeEmail({
          to: deliveryEmail,
          firstName: user.firstName,
          code,
          expiryMinutes: RESET_CODE_EXPIRY_MINUTES,
        });
        emailDelivered = delivery.delivered;
        deliveryWarning = delivery.deliveryWarning || undefined;
        logEmailVerificationEvent('forgot-password', req, {
          userId: user.id,
          success: delivery.delivered,
        });
        if (delivery.delivered) {
          sentToMasked = maskEmail(deliveryEmail);
          console.log(`[LECSTU][password-reset] Reset code emailed to ${deliveryEmail}`);
        } else {
          console.warn(
            `[LECSTU][password-reset] Email not sent via SMTP (mode=${delivery.mode}). ` +
              'Disable "Console mode" in Admin → Settings, or check API terminal for the code.',
          );
        }
      } catch (err) {
        logEmailVerificationEvent('forgot-password', req, { userId: user.id, success: false });
        smtpError = err instanceof Error ? err.message : 'SMTP send failed';
        console.error('[LECSTU][password-reset] Failed to send reset email:', err);
      }
    }

    const isDev = config.nodeEnv !== 'production';
    if (isDev && user && code) {
      devResetCode = code;
    }

    const universityWarning = deliveryEmail ? getUniversityDeliveryWarning(deliveryEmail) : null;
    const combinedWarning =
      deliveryWarning ||
      universityWarning ||
      (!emailDelivered && isDev
        ? 'Gmail SMTP login failed. Regenerate an app password for SMTP_USER in server/.env, then restart the server.'
        : undefined);

    const emailMode = getEmailServiceMode();
    res.json({
      success: true,
      message: emailDelivered
        ? 'Reset code sent. Check your inbox and spam or junk folder.'
        : user
          ? 'Reset code generated. Email could not be delivered — use the code shown below or fix SMTP settings.'
          : GENERIC_FORGOT_MESSAGE,
      ...(emailDelivered && sentToMasked ? { sentToMasked, emailDelivered: true } : { emailDelivered: false }),
      ...(combinedWarning ? { deliveryWarning: combinedWarning } : {}),
      ...(isDev && {
        devDelivery: emailMode,
        devResetCode,
        accountFound: Boolean(user),
        devHint: !user
          ? 'No LECSTU account uses this email. Enter your registered login email (e.g. @stu.kln.ac.lk). lecstu.system@gmail.com is the sender only — it does not receive reset codes unless set as recovery email on your account.'
          : emailMode === 'console'
            ? 'Console mode is ON — email was not sent. Turn off "Console mode" in Admin → Settings, or use the dev code below.'
            : emailDelivered
              ? user?.recoveryEmail
                ? 'Reset code sent to your recovery email inbox.'
                : deliveryEmail && isUniversityEmail(deliveryEmail)
                  ? 'Code sent from LECSTU. University Outlook may quarantine external mail — also use the dev code below if needed.'
                  : 'Reset code sent. Check inbox and spam.'
              : 'Email not sent — use the dev code below or check SMTP settings in server/.env.',
      }),
    });
  } catch (err) {
    next(err);
  }
}

export async function verifyResetCodeEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code).trim();

    const result = await verifyResetCodeByEmail(email, code);
    if (!result.valid) {
      logEmailVerificationEvent('verify-reset-code', req, { success: false });
      throw new AppError(GENERIC_INVALID_CODE_MESSAGE, 400);
    }

    logEmailVerificationEvent('verify-reset-code', req, { userId: result.userId, success: true });
    res.json({ success: true, valid: true });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code).trim();
    const newPassword = String(req.body.newPassword);

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        isActive: true,
      },
      select: { id: true, password: true },
    });

    if (!user) {
      logEmailVerificationEvent('reset-password', req, { success: false });
      throw new AppError(GENERIC_INVALID_CODE_MESSAGE, 400);
    }

    const verification = await verifyResetCode(user.id, code);
    if (!verification.valid) {
      logEmailVerificationEvent('reset-password', req, { userId: user.id, success: false });
      throw new AppError(GENERIC_INVALID_CODE_MESSAGE, 400);
    }

    const samePassword = await comparePassword(newPassword, user.password);
    if (samePassword) {
      logEmailVerificationEvent('reset-password', req, { userId: user.id, success: false });
      throw new AppError('New password must be different from the current password', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(newPassword) },
    });
    await markResetTokenUsed(verification.tokenId);

    logEmailVerificationEvent('reset-password', req, { userId: user.id, success: true });

    res.json({
      success: true,
      message: 'Password updated successfully. You can sign in with your new password.',
    });
  } catch (err) {
    next(err);
  }
}
