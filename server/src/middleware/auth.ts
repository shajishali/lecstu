import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { AppError } from './errorHandler';
import { config } from '../config';
import prisma from '../config/database';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/** Like authenticate but does not throw when no token - sets req.user = undefined */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    req.user = undefined;
    next();
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    req.user = undefined;
    next();
  }
}

/** Supports JWT or chatbot API key + user ID for Rasa actions */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-chatbot-api-key'] as string | undefined;
  const chatbotUserId = req.headers['x-chatbot-user-id'] as string | undefined;

  if (apiKey && chatbotUserId && config.chatbot?.apiKey && apiKey === config.chatbot.apiKey) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: chatbotUserId, isActive: true },
        select: { id: true, email: true, role: true },
      });
      if (!user) {
        throw new AppError('Invalid chatbot user', 401);
      }
      req.user = { userId: user.id, email: user.email, role: user.role };
      next();
    } catch (err) {
      next(err);
    }
    return;
  }

  const token =
    req.cookies?.access_token ||
    req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AppError('Authentication required', 401);
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403);
    }

    next();
  };
}
