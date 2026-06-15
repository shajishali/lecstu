import prisma from '../src/config/database';
import { computeIndoorRouteFlexible, formatIndoorRouteResponse } from '../src/services/indoorNavigationService';

async function main() {
  const admin = await prisma.mapBuilding.findUnique({ where: { code: 'ADMIN' } });
  if (!admin) throw new Error('ADMIN not found');
  const markers = await prisma.mapMarker.findMany({
    where: { buildingId: admin.id, floor: 2 },
    select: { id: true, label: true, x: true, y: true },
    orderBy: { label: 'asc' },
  });
  console.log('ADMIN F2 markers:');
  for (const m of markers) console.log(`  ${m.label} | ${m.id}`);

  const from = markers.find((m) => /entrance for staircase/i.test(m.label));
  const to = markers.find((m) => /printing/i.test(m.label));
  if (!from || !to) throw new Error('from/to not found');

  const fp = await prisma.floorPlan.findFirst({
    where: { buildingId: admin.id, floor: 2 },
    select: { drawableRegion: true },
  });
  console.log('from marker', from.label, from.x, from.y);
  console.log('to marker', to.label, to.x, to.y);
  const fromNode = await prisma.navNode.findFirst({ where: { mapMarkerId: from.id } });
  const toNode = await prisma.navNode.findFirst({ where: { mapMarkerId: to.id } });
  console.log('from navNode', fromNode?.x, fromNode?.y);
  console.log('to navNode', toNode?.x, toNode?.y);
  console.log('drawableRegion', fp?.drawableRegion);

  for (const opts of [
    { label: 'admin-style (floor+markers)', floor: 2, fromMarkerId: from.id, toMarkerId: to.id, q: undefined },
    { label: 'student-style q only', floor: 2, fromMarkerId: from.id, toMarkerId: undefined, q: to.label },
    { label: 'no from (default entrance)', floor: 2, fromMarkerId: undefined, toMarkerId: to.id, q: undefined },
  ]) {
    const raw = await computeIndoorRouteFlexible({
      buildingId: admin.id,
      floor: opts.floor,
      fromMarkerId: opts.fromMarkerId,
      toMarkerId: opts.toMarkerId,
      q: opts.q,
    });
    const fmt = formatIndoorRouteResponse(raw);
    console.log(`\n--- ${opts.label} ---`);
    console.log('found:', fmt.found);
    if (!fmt.found) {
      console.log('message:', (fmt as { message?: string }).message);
      continue;
    }
    console.log('start:', fmt.startLabel, 'dest:', fmt.destinationLabel);
    console.log('pathNodeIds:', (fmt as { pathNodeIds?: string[] }).pathNodeIds);
    console.log(
      'polyline:',
      fmt.polyline?.map((p) => `(${p.x.toFixed(2)},${p.y.toFixed(2)})`).join(' -> ')
    );
  }
}

main().finally(() => prisma.$disconnect());
