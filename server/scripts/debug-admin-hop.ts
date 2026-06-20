import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';
import { CROSS_BUILDING_EDGE_LABEL } from '../src/constants/buildingConnections';

async function main() {
  const fromResults = await searchMapEntities('CAFETERIA');
  const fromBest = pickBestMapSearchResult('CAFETERIA', fromResults)!;
  const toResults = await searchMapEntities('DEPARTMENT OFFICE');
  const toBest = pickBestMapSearchResult('DEPARTMENT OFFICE', toResults)!;

  const raw = await computeIndoorRouteFlexible({
    fromBuildingId: fromBest.buildingId,
    toBuildingId: toBest.buildingId,
    fromMarkerId: fromBest.markerId,
    toMarkerId: toBest.markerId,
    fromFloor: fromBest.floor,
  });
  if (!raw.found) return;

  const pathIds = raw.pathNodeIds!;
  const nodes = await prisma.navNode.findMany({
    where: { id: { in: pathIds } },
    include: { building: { select: { code: true } } },
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  console.log('Path nodes around ADMIN transition:');
  for (let i = 10; i < Math.min(18, pathIds.length); i++) {
    const n = byId[pathIds[i]];
    if (!n) continue;
    console.log(`  [${i}] ${n.building.code} F${n.floor} ${n.label} (${n.type})`);
  }

  const adminIdx = pathIds.findIndex((id) => byId[id]?.building.code === 'ADMIN');
  if (adminIdx >= 0) {
    const adminId = pathIds[adminIdx];
    const prevId = pathIds[adminIdx - 1];
    const nextId = pathIds[adminIdx + 1];
    const edges = await prisma.navEdge.findMany({
      where: {
        label: CROSS_BUILDING_EDGE_LABEL,
        OR: [
          { fromNodeId: prevId, toNodeId: adminId },
          { fromNodeId: adminId, toNodeId: nextId },
        ],
      },
      include: {
        from: { include: { building: { select: { code: true } } } },
        to: { include: { building: { select: { code: true } } } },
      },
    });
    console.log('\nCross edges at ADMIN hop:');
    for (const e of edges) {
      console.log(
        `  ${e.from.building.code} [${e.from.label}] <-> ${e.to.building.code} [${e.to.label}]`
      );
    }

    const adminF2Nodes = await prisma.navNode.findMany({
      where: { building: { code: 'ADMIN' }, floor: 2 },
      select: { id: true, label: true, type: true, mapMarkerId: true },
      orderBy: { label: 'asc' },
    });
    console.log(`\nADMIN F2 nodes (${adminF2Nodes.length}):`);
    for (const n of adminF2Nodes.slice(0, 15)) {
      console.log(`  ${n.label} (${n.type}) marker=${n.mapMarkerId ? 'yes' : 'no'}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
