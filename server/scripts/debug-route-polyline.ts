import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';

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
  if (!raw.found) {
    console.log('Route not found:', raw.message);
    return;
  }

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true },
  });
  const codeById = Object.fromEntries(buildings.map((b) => [b.id, b.code]));

  const counts = new Map<string, number>();
  for (const p of raw.polyline ?? []) {
    const bid = (p as { buildingId?: string }).buildingId ?? '?';
    const code = codeById[bid] ?? bid.slice(0, 8);
    const key = `${code} F${p.floor}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  console.log('From:', fromBest.buildingCode, 'F' + fromBest.floor, fromBest.label);
  console.log('To:', toBest.buildingCode, 'F' + toBest.floor, toBest.label);
  console.log('Building path:', raw.buildingPath?.join(' → '));
  console.log('\nPolyline points per building/floor:');
  for (const [k, v] of [...counts.entries()].sort()) {
    console.log(`  ${k}: ${v} point(s)${v < 2 ? ' (no line drawable)' : ''}`);
  }

  const adminSteps = (raw.stepDetails ?? []).filter(
    (s) => s.instruction?.includes('Administration') || s.buildingCode === 'ADMIN'
  );
  console.log('\nAdministration-related steps:');
  for (const s of adminSteps.slice(0, 8)) {
    console.log(`  [${s.polylineIndex}] F${s.floor} ${s.instruction}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
