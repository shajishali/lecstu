/**
 * Remove floor plans (and related markers/nav graph) stored above a building's configured floor count.
 * e.g. mistaken ACAD_floor10.jpg when ACAD only has Ground + F1–F9.
 * Run: npx tsx scripts/cleanup-out-of-range-floorplans.ts
 */
import prisma from '../src/config/database';
import { deleteFloorPlanFile } from '../src/services/floorPlanStorage';

async function removeFloorData(buildingId: string, floor: number) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true },
  });
  const nodeIds = nodes.map((n) => n.id);
  if (nodeIds.length) {
    await prisma.navEdge.deleteMany({
      where: { OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }] },
    });
    await prisma.navNode.deleteMany({ where: { buildingId, floor } });
  }
  await prisma.mapMarker.deleteMany({ where: { buildingId, floor } });
}

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    select: { id: true, code: true, name: true, floors: true },
    orderBy: { code: 'asc' },
  });

  let removed = 0;
  for (const b of buildings) {
    const badPlans = await prisma.floorPlan.findMany({
      where: { buildingId: b.id, floor: { gte: b.floors } },
      orderBy: { floor: 'asc' },
    });
    for (const plan of badPlans) {
      console.log(
        `  ✗ ${b.code} floor ${plan.floor} — out of range (max index ${b.floors - 1}); removing`
      );
      await removeFloorData(b.id, plan.floor);
      deleteFloorPlanFile(plan.imagePath);
      await prisma.floorPlan.delete({ where: { id: plan.id } });
      removed++;
    }
  }

  if (!removed) {
    console.log('No out-of-range floor plans found.');
  } else {
    console.log(`\nRemoved ${removed} out-of-range floor plan(s).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
