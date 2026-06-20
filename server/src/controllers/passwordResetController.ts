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

    if (user) {
      const deliveryEmail = getPasswordResetDeliveryEmail(user);
      try {
        const { code } = await createResetToken(user.id);
        const delivery = await sendPasswordResetCodeEmail({
          to: deliveryEmail,
          firstName: user.firstName,
          code,
          expiryMinutes: RESET_CODE_EXPIRY_MINUTES,
        });
        if (!delivery.delivered) {
          logEmailVerificationEvent('forgot-password', req, { userId: user.id, success: false });
          console.warn(
            `[LECSTU][password-reset] Email not sent via SMTP (mode=${delivery.mode}). ` +
              'Disable "Console mode" in Admin → Settings, or check API terminal for the code.',
          );
          if (config.nodeEnv !== 'production') {
            devResetCode = code;
          }
        } else {
          emailDelivered = true;
          sentToMasked = maskEmail(deliveryEmail);
          logEmailVerificationEvent('forgot-password', req, { userId: user.id, success: true });
          console.log(`[LECSTU][password-reset] Reset code emailed to ${deliveryEmail}`);
        }
      } catch (err) {
        logEmailVerificationEvent('forgot-password', req, { userId: user.id, success: false });
        console.error('[LECSTU][password-reset] Failed to send reset email:', err);
      }
    }

    const emailMode = getEmailServiceMode();
    res.json({
      success: true,
      message: GENERIC_FORGOT_MESSAGE,
      ...(emailDelivered && sentToMasked ? { sentToMasked, emailDelivered: true } : {}),
      ...(config.nodeEnv !== 'production' && {
        devDelivery: emailMode,
        devResetCode,
        accountFound: Boolean(user),
        devHint: !user
          ? 'No LECSTU account uses this email. Enter your registered login email (e.g. @stu.kln.ac.lk). lecstu.system@gmail.com is the sender only — it does not receive reset codes unless set as recovery email on your account.'
          : emailMode === 'console'
            ? 'Console mode is ON — email was not sent. Turn off "Console mode" in Admin → Settings, or use the dev code below.'
            : emailDelivered
              ? user?.recoveryEmail
                ? 'SMTP accepted the message. Reset codes go to your recovery email (not your university inbox).'
                : 'SMTP accepted the message. @stu.kln.ac.lk uses Microsoft Outlook — check Junk Email and Quarantine, or add a personal recovery email in Profile.'
              : emailMode === 'smtp'
                ? 'Account found but email send failed. Check server logs or use the dev code below.'
                : 'SMTP not configured — set credentials in Admin → Settings → Email verification.',
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
