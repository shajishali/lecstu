import prisma from '../src/config/database';

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ADMIN', 'ACAD', 'LAB'] } },
    select: { id: true, code: true },
  });
  for (const b of buildings) {
    const markers = await prisma.mapMarker.findMany({
      where: {
        buildingId: b.id,
        OR: [
          { type: 'EXIT' },
          { type: 'ENTRANCE' },
          { label: { contains: 'academic', mode: 'insensitive' } },
          { label: { contains: 'administration', mode: 'insensitive' } },
          { label: { contains: 'laboratory', mode: 'insensitive' } },
          { label: { contains: 'lab building', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        label: true,
        type: true,
        floor: true,
        metadata: true,
        navNode: { select: { id: true } },
      },
    });
    const conn = markers.filter((m) => (m.metadata as { buildingConnection?: unknown })?.buildingConnection);
    console.log(`${b.code}: ${conn.length} connection markers`);
    for (const m of conn) {
      const meta = (m.metadata as { buildingConnection: { targetBuildingCode: string } }).buildingConnection;
      console.log(`  ${m.type} -> ${meta.targetBuildingCode} | ${m.label} | node=${m.navNode?.id ? 'yes' : 'no'}`);
    }
    const byLabel = markers.filter((m) =>
      /academic|administration|laboratory/i.test(m.label)
    );
    if (byLabel.length) {
      console.log('  label matches:');
      for (const m of byLabel) {
        console.log(`    ${m.type} | ${m.label} | node=${m.navNode?.id ? 'yes' : 'no'}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
