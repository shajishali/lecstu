import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/** In production, reject non-HTTPS auth requests (supports reverse-proxy via X-Forwarded-Proto). */
export function requireHttpsInProduction(req: Request, res: Response, next: NextFunction): void {
  if (config.nodeEnv !== 'production') {
    next();
    return;
  }

  const forwardedProto = req.header('x-forwarded-proto');
  const isSecure = req.secure || forwardedProto === 'https';

  if (!isSecure) {
    res.status(403).json({
      success: false,
      message: 'HTTPS is required for authentication requests.',
    });
    return;
  }

  next();
}
