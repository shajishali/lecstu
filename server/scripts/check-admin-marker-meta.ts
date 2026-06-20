import prisma from '../src/config/database';
import { parseMarkerMetadata } from '../src/utils/markerMetadata';

async function main() {
  const admin = await prisma.mapBuilding.findFirst({ where: { code: 'ADMIN' } });
  if (!admin) return;

  const markers = await prisma.mapMarker.findMany({
    where: { buildingId: admin.id, floor: 2, type: { in: ['ENTRANCE', 'EXIT'] } },
    select: { id: true, label: true, metadata: true },
    orderBy: { label: 'asc' },
  });

  for (const m of markers) {
    const meta = parseMarkerMetadata(m.metadata);
    console.log(m.label, '->', meta.buildingConnection ?? 'no metadata');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
