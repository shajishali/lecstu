import prisma from '../../../config/database';
import type { NavigationSessionStatus, PositionSource } from '../../../generated/prisma/client';

const SESSION_TTL_HOURS = 8;

export async function getActiveSession(userId: string, buildingId?: string) {
  return prisma.navigationSession.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      ...(buildingId ? { buildingId } : {}),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function createOrUpdateSession(input: {
  userId: string;
  buildingId: string;
  currentNodeId?: string | null;
  currentFloor?: number | null;
  destinationNodeId?: string | null;
  positionSource?: PositionSource;
  routePayload?: unknown;
  stepIndex?: number;
}) {
  const existing = await getActiveSession(input.userId, input.buildingId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  const data = {
    buildingId: input.buildingId,
    currentNodeId: input.currentNodeId ?? null,
    currentFloor: input.currentFloor ?? null,
    destinationNodeId: input.destinationNodeId ?? null,
    positionSource: input.positionSource ?? ('ENTRANCE_DEFAULT' as PositionSource),
    routePayload: input.routePayload ?? undefined,
    stepIndex: input.stepIndex ?? 0,
    expiresAt,
    status: 'ACTIVE' as NavigationSessionStatus,
  };

  if (existing) {
    return prisma.navigationSession.update({ where: { id: existing.id }, data });
  }

  return prisma.navigationSession.create({
    data: { userId: input.userId, ...data },
  });
}

export async function updateSessionPosition(
  sessionId: string,
  userId: string,
  nodeId: string,
  floor: number,
  source: PositionSource
) {
  const session = await prisma.navigationSession.findFirst({
    where: { id: sessionId, userId, status: 'ACTIVE' },
  });
  if (!session) return null;

  return prisma.navigationSession.update({
    where: { id: sessionId },
    data: {
      currentNodeId: nodeId,
      currentFloor: floor,
      positionSource: source,
    },
  });
}

export async function getSessionById(sessionId: string, userId: string) {
  return prisma.navigationSession.findFirst({
    where: { id: sessionId, userId },
  });
}

export async function updateSessionStepIndex(sessionId: string, userId: string, stepIndex: number) {
  const session = await prisma.navigationSession.findFirst({
    where: { id: sessionId, userId, status: 'ACTIVE' },
  });
  if (!session) return null;

  return prisma.navigationSession.update({
    where: { id: sessionId },
    data: { stepIndex: Math.max(0, stepIndex) },
  });
}

export async function completeSession(sessionId: string, userId: string) {
  return prisma.navigationSession.updateMany({
    where: { id: sessionId, userId, status: 'ACTIVE' },
    data: { status: 'COMPLETED' },
  });
}
