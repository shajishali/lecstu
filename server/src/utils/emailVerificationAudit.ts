import { Request } from 'express';

export type EmailVerificationAction =
  | 'forgot-password'
  | 'verify-reset-code'
  | 'reset-password'
  | 'profile-password-request-code'
  | 'profile-password-change'
  | 'registration-send-code'
  | 'registration-verify-code'
  | 'register';

export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function logEmailVerificationEvent(
  action: EmailVerificationAction,
  req: Request,
  meta: { userId?: string; email?: string; success: boolean },
): void {
  const emailPart = meta.email ? ` email=${meta.email}` : '';
  console.log(
    `[LECSTU][email-verification] action=${action} ip=${clientIp(req)} userId=${meta.userId ?? 'n/a'}${emailPart} success=${meta.success} at=${new Date().toISOString()}`,
  );
}

/** @deprecated Use logEmailVerificationEvent */
export function logPasswordResetSecurityEvent(
  action: 'forgot-password' | 'verify-reset-code' | 'reset-password',
  req: Request,
  meta: { userId?: string; success: boolean },
): void {
  logEmailVerificationEvent(action, req, meta);
}
