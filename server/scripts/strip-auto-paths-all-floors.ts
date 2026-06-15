import prisma from '../src/config/database';
import { clearAutoWalkingPaths } from '../src/services/navGraphBuildService';

const MANUAL = /^(Path point \d+|Stairs \d+|Lift \d+)$/;

async function main() {
  const buildings = await prisma.mapBuilding.findMany({ orderBy: { code: 'asc' } });
  console.log('=== Strip auto paths (keep manual Path point / Lift / Stairs) ===\n');

  let cleared = 0;
  const needsRedraw: string[] = [];
  const keptManual: string[] = [];

  for (const b of buildings) {
    const plans = await prisma.floorPlan.findMany({
      where: { buildingId: b.id },
      orderBy: { floor: 'asc' },
    });
    for (const plan of plans) {
      const floor = plan.floor;
      const label = floor === 0 ? 'G' : `F${floor}`;
      const key = `${b.code} ${label}`;

      const before = await prisma.navNode.findMany({
        where: { buildingId: b.id, floor },
        select: { id: true, label: true, mapMarkerId: true },
      });
      const manualBefore = before.filter((n) => !n.mapMarkerId && MANUAL.test(n.label)).length;
      const hubBefore = before.filter((n) => /Corridor \(auto/i.test(n.label)).length;

      if (hubBefore === 0 && manualBefore === 0) continue;

      const result = await clearAutoWalkingPaths(b.id, floor);
      cleared++;

      const after = await prisma.navNode.findMany({
        where: { buildingId: b.id, floor },
        select: { label: true, mapMarkerId: true },
      });
      const manualAfter = after.filter((n) => !n.mapMarkerId && MANUAL.test(n.label)).length;
      const nodeIds = (await prisma.navNode.findMany({
        where: { buildingId: b.id, floor },
        select: { id: true },
      })).map((n) => n.id);
      const edges =
        nodeIds.length > 0
          ? await prisma.navEdge.count({
              where: {
                OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
              },
            })
          : 0;

      console.log(
        `${key}: removed ${result.removedPoints} auto point(s), ${result.removedMarkerEdges} place link(s) | manual pts ${manualBefore}→${manualAfter} | edges now ${edges}`
      );

      if (manualAfter > 0) keptManual.push(key);
      else if (after.filter((n) => n.mapMarkerId).length > 0) needsRedraw.push(key);
    }
  }

  console.log(`\nCleared ${cleared} floor(s).`);
  console.log(`\nManual path points preserved (${keptManual.length}):`);
  keptManual.forEach((k) => console.log(`  ✓ ${k}`));
  console.log(`\nNeed manual redraw — auto hub removed, no saved path points (${needsRedraw.length}):`);
  needsRedraw.forEach((k) => console.log(`  ✗ ${k}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
