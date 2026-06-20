import prisma from '../src/config/database';
import { computeIndoorRouteFlexible, formatIndoorRouteResponse } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';

async function main() {
  const fromQ = process.argv[2] || 'CAFETERIA';
  const toQ = process.argv[3] || 'DEPARTMENT OFFICE';

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(buildings.map((b) => [b.code, b.id]));

  const fromResults = await searchMapEntities(fromQ);
  const fromBest = pickBestMapSearchResult(fromQ, fromResults);
  const toResults = await searchMapEntities(toQ);
  const toBest = pickBestMapSearchResult(toQ, toResults);

  console.log('From:', fromBest);
  console.log('To:', toBest);

  const raw = await computeIndoorRouteFlexible({
    fromBuildingId: fromBest?.buildingId ?? byCode.ACAD,
    toBuildingId: toBest?.buildingId ?? byCode.LAB,
    fromMarkerId: fromBest?.markerId,
    toMarkerId: toBest?.markerId,
    fromFloor: fromBest?.floor,
  });
  const fmt = formatIndoorRouteResponse(raw);

  if (!fmt.found) {
    console.log('Route not found:', fmt.message);
    return;
  }

  const codeById = Object.fromEntries(buildings.map((b) => [b.id, b.code]));

  console.log('\nBuilding path:', (raw as { buildingPath?: string[] }).buildingPath);
  console.log('\nSegments:');
  for (const s of fmt.segments ?? []) {
    console.log(
      `  ${codeById[s.buildingId] ?? s.buildingId} F${s.floor}: ${s.polyline.length} point(s)`
    );
  }

  console.log('\nPolyline by building/floor:');
  const counts = new Map<string, number>();
  for (const p of fmt.polyline ?? []) {
    const bid = (p as { buildingId?: string }).buildingId;
    const key = `${codeById[bid ?? ''] ?? bid ?? '?'} F${p.floor}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [k, n] of [...counts.entries()].sort()) {
    console.log(`  ${k}: ${n} point(s)`);
  }

  console.log('\nEnter/Exit steps:');
  for (const s of fmt.steps ?? []) {
    if (/^(Enter|Exit) /.test(s.instruction)) {
      const idx = (s as { polylineIndex?: number }).polylineIndex;
      const pt = fmt.polyline?.[idx ?? 0] as { buildingId?: string; floor: number } | undefined;
      console.log(
        `  [${idx}] ${s.instruction} (floor ${s.floor}, building ${codeById[pt?.buildingId ?? ''] ?? '?'})`
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
