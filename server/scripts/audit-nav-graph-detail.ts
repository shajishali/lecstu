import prisma from '../src/config/database';

const MANUAL = /^(Path point \d+|Stairs \d+|Lift \d+)$/;

async function main() {
  const buildings = await prisma.mapBuilding.findMany({ orderBy: { code: 'asc' } });
  for (const b of buildings) {
    const plans = await prisma.floorPlan.findMany({
      where: { buildingId: b.id },
      orderBy: { floor: 'asc' },
    });
    if (!plans.length) continue;
    console.log(`\n=== ${b.code} ===`);
    for (const plan of plans) {
      const floor = plan.floor;
      const nodes = await prisma.navNode.findMany({
        where: { buildingId: b.id, floor },
        orderBy: { label: 'asc' },
      });
      const nodeIds = nodes.map((n) => n.id);
      const edges =
        nodeIds.length > 0
          ? await prisma.navEdge.findMany({
              where: {
                OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
              },
            })
          : [];

      const manual = nodes.filter((n) => !n.mapMarkerId && MANUAL.test(n.label));
      const autoHub = nodes.filter((n) => /Corridor \(auto/i.test(n.label));
      const autoOther = nodes.filter(
        (n) => !n.mapMarkerId && !MANUAL.test(n.label) && !/Corridor \(auto/i.test(n.label)
      );
      const places = nodes.filter((n) => n.mapMarkerId);

      console.log(
        `Floor ${floor}: edges=${edges.length} manualPts=${manual.length} autoHub=${autoHub.length} autoOther=${autoOther.length} places=${places.length}`
      );
      if (autoHub.length) {
        console.log(`  AUTO HUB: ${autoHub.map((n) => n.label).join(', ')}`);
      }
      if (manual.length) {
        console.log(`  MANUAL: ${manual.map((n) => n.label).join(', ')}`);
      }
      if (autoOther.length <= 8) {
        if (autoOther.length) console.log(`  AUTO OTHER: ${autoOther.map((n) => n.label).join(', ')}`);
      } else {
        console.log(`  AUTO OTHER: ${autoOther.length} nodes`);
      }
    }
  }

  const auditCount = await prisma.auditLog.count({
    where: { action: { in: ['CREATE_NAV_EDGE', 'CREATE_NAV_NODE'] } },
  });
  console.log(`\nAudit log nav entries: ${auditCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
