import rateLimit from 'express-rate-limit';
import type { Request } from 'express';

const isDev = process.env.NODE_ENV !== 'production';

const emailCodeSendLimitMessage = {
  success: false,
  message: 'Too many verification emails requested. Please try again later.',
};

const emailCodeVerifyLimitMessage = {
  success: false,
  message: 'Too many verification attempts. Please wait and try again.',
};

/** @deprecated alias */
const passwordResetLimitMessage = emailCodeSendLimitMessage;

function emailKeyFromBody(req: Request, prefix: string): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return `${prefix}:${email || req.ip || 'unknown'}`;
}

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 200 : 20,
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Send-code endpoints: max 10 requests per IP per hour (production). */
export const emailCodeSendIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 50 : 10,
  message: emailCodeSendLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Send-code endpoints: max 3 requests per email per hour (production). */
export const emailCodeSendEmailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isDev ? 20 : 3,
  keyGenerator: (req) => emailKeyFromBody(req, 'email-code-send'),
  message: emailCodeSendLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Verify / reset / register-with-code: max 5 attempts per email per 15 minutes (production). */
export const emailCodeVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 30 : 5,
  keyGenerator: (req) => emailKeyFromBody(req, 'email-code-verify'),
  message: emailCodeVerifyLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

/** @deprecated use emailCodeSendIpLimiter */
export const passwordResetForgotIpLimiter = emailCodeSendIpLimiter;
/** @deprecated use emailCodeSendEmailLimiter */
export const passwordResetForgotEmailLimiter = emailCodeSendEmailLimiter;
/** @deprecated use emailCodeVerifyLimiter */
export const passwordResetAttemptLimiter = emailCodeVerifyLimiter;
