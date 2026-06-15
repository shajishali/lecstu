import type { Request, Response, NextFunction } from 'express';
import { logAction } from '../services/auditLogger';

export async function trackChat(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.json({ success: true }); // No user - skip tracking, avoid 401
    }

    const { userMessage, botResponse } = req.body as { userMessage?: string; botResponse?: string | string[] };
    const message = typeof userMessage === 'string' ? userMessage : '';
    const response = Array.isArray(botResponse)
      ? botResponse.join(' ')
      : typeof botResponse === 'string'
        ? botResponse
        : '';

    if (!message.trim()) {
      return res.status(400).json({ success: false, message: 'userMessage required' });
    }

    await logAction(userId, 'QUERY', 'Chatbot', undefined, {
      userMessage: message.trim(),
      botResponse: response.trim() || undefined,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
