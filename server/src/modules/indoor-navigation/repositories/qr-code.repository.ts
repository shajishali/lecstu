import { randomBytes } from 'crypto';
import prisma from '../../../config/database';
import { AppError } from '../../../middleware/errorHandler';

export async function listQrCodes(buildingId: string) {
  return prisma.navQrCode.findMany({
    where: { buildingId },
    include: {
      navNode: { select: { id: true, label: true, floor: true, type: true } },
    },
    orderBy: [{ navNode: { floor: 'asc' } }, { label: 'asc' }],
  });
}

export async function createQrCode(input: {
  buildingId: string;
  navNodeId: string;
  label?: string;
  code?: string;
}) {
  const node = await prisma.navNode.findFirst({
    where: { id: input.navNodeId, buildingId: input.buildingId },
  });
  if (!node) throw new AppError('Navigation node not found in this building', 404);

  const code = input.code?.trim() || `LEC-${input.buildingId.slice(0, 4)}-${node.floor}-${randomBytes(4).toString('hex').toUpperCase()}`;

  return prisma.navQrCode.create({
    data: {
      buildingId: input.buildingId,
      navNodeId: input.navNodeId,
      label: input.label?.trim() || node.label,
      code,
    },
    include: {
      navNode: { select: { id: true, label: true, floor: true, type: true } },
    },
  });
}

export async function deleteQrCode(id: string) {
  await prisma.navQrCode.delete({ where: { id } });
}

export async function findQrByCode(code: string) {
  return prisma.navQrCode.findFirst({
    where: { code, isActive: true },
    include: {
      navNode: true,
      building: { select: { id: true, name: true, code: true } },
    },
  });
}
