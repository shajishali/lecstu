import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';

async function main() {
  const fromResults = await searchMapEntities('CAFETERIA');
  const fromBest = pickBestMapSearchResult('CAFETERIA', fromResults)!;

  const toQuery = process.argv[2] || 'DEPARTMENT OFFICE';
  const toResults = await searchMapEntities(toQuery);
  const toBest = pickBestMapSearchResult(toQuery, toResults)!;

  const raw = await computeIndoorRouteFlexible({
    fromBuildingId: fromBest.buildingId,
    toBuildingId: toBest.buildingId,
    fromMarkerId: fromBest.markerId,
    toMarkerId: toBest.markerId,
    fromFloor: fromBest.floor,
  });
  if (!raw.found) {
    console.log('Not found:', raw.message);
    return;
  }

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true },
  });
  const codeById = Object.fromEntries(buildings.map((b) => [b.id, b.code]));

  console.log(`Route: ${fromBest.label} (F${fromBest.floor}) → ${toBest.label} (F${toBest.floor})`);
  console.log('Building path:', raw.buildingPath?.join(' → '));
  console.log('\nPath nodes (floor transitions):');
  let prevFloor = -1;
  let prevCode = '';
  for (let i = 0; i < (raw.pathNodeIds?.length ?? 0); i++) {
    const p = raw.polyline?.[i] as { buildingId?: string; floor: number; label?: string; type?: string } | undefined;
    if (!p) continue;
    const code = codeById[p.buildingId ?? ''] ?? '?';
    const changed = code !== prevCode || p.floor !== prevFloor;
    if (changed || i < 3 || i >= (raw.pathNodeIds?.length ?? 0) - 3) {
      console.log(`  [${i}] ${code} F${p.floor} ${p.label} (${p.type})`);
    } else if (i === 3) {
      console.log('  ...');
    }
    prevFloor = p.floor;
    prevCode = code;
  }

  console.log('\nSteps:');
  for (const s of raw.stepDetails ?? []) {
    console.log(`  F${s.floor} ${s.instruction}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
