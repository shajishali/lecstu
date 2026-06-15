import prisma from '../src/config/database';
import { saveWalkingPathsSnapshot } from '../src/services/navGraphBuildService';

async function main() {
  const buildings = await prisma.mapBuilding.findMany({ orderBy: { code: 'asc' } });
  let saved = 0;
  for (const b of buildings) {
    const plans = await prisma.floorPlan.findMany({
      where: { buildingId: b.id },
      orderBy: { floor: 'asc' },
    });
    for (const plan of plans) {
      const snap = await saveWalkingPathsSnapshot(b.id, plan.floor);
      if (!snap) continue;
      saved++;
      const label = plan.floor === 0 ? 'G' : `F${plan.floor}`;
      console.log(
        `${b.code} ${label}: backed up ${snap.pathNodes.length} path point(s), ${snap.edges.length} line(s)`
      );
    }
  }
  console.log(`\nSaved ${saved} floor backup(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
