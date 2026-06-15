import prisma from '../../../config/database';

export async function listNavNodes(buildingId: string, floor?: number) {
  return prisma.navNode.findMany({
    where: {
      buildingId,
      ...(floor !== undefined ? { floor } : {}),
    },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });
}

export async function listNavEdgesForBuilding(buildingId: string) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId },
    select: { id: true },
  });
  const nodeIds = nodes.map((n) => n.id);
  if (nodeIds.length === 0) return [];

  return prisma.navEdge.findMany({
    where: { fromNodeId: { in: nodeIds } },
  });
}

export async function getFloorScale(buildingId: string, floor: number): Promise<number | null> {
  const fp = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { scaleMetersPerUnit: true },
  });
  return fp?.scaleMetersPerUnit ?? null;
}
