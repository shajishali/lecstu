import prisma from '../src/config/database';
import { CROSS_BUILDING_EDGE_LABEL } from '../src/constants/buildingConnections';

async function main() {
  const admin = await prisma.mapBuilding.findFirst({ where: { code: 'ADMIN' } });
  if (!admin) return;

  const edges = await prisma.navEdge.findMany({
    where: {
      label: CROSS_BUILDING_EDGE_LABEL,
      OR: [{ from: { buildingId: admin.id } }, { to: { buildingId: admin.id } }],
    },
    include: {
      from: { include: { building: { select: { code: true } } } },
      to: { include: { building: { select: { code: true } } } },
    },
    orderBy: [{ from: { floor: 'asc' } }],
  });

  console.log(`ADMIN cross-building edges (${edges.length}):`);
  for (const e of edges) {
    console.log(
      `  F${e.from.floor} ${e.from.building.code} [${e.from.label}] <-> F${e.to.floor} ${e.to.building.code} [${e.to.label}]`
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
