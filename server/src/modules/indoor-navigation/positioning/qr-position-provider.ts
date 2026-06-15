import prisma from '../../../config/database';
import type { PositionProvider, ResolvedPosition } from './types';

export class QrPositionProvider implements PositionProvider {
  readonly source = 'QR_CODE' as const;

  async resolvePosition(input: unknown): Promise<ResolvedPosition | null> {
    const code = typeof input === 'string' ? input.trim() : (input as { code?: string })?.code?.trim();
    if (!code) return null;

    const qr = await prisma.navQrCode.findFirst({
      where: { code, isActive: true },
      include: { navNode: { select: { id: true, floor: true, label: true } } },
    });
    if (!qr?.navNode) return null;

    return {
      nodeId: qr.navNode.id,
      floor: qr.navNode.floor,
      label: qr.label || qr.navNode.label,
      source: 'QR_CODE',
    };
  }
}
