import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';
import { verticalConnectorKey } from '../src/utils/verticalConnectorLabels';

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
  if (!raw.found) return;

  console.log('Vertical nodes F4-F8:');
  for (let i = 0; i < (raw.polyline?.length ?? 0); i++) {
    const p = raw.polyline![i] as { floor: number; label?: string; type?: string };
    if (p.floor >= 4 && p.floor <= 8) {
      console.log(
        `  [${i}] F${p.floor} ${p.label} (${p.type}) key=${verticalConnectorKey(p.type ?? '', p.label ?? '')}`
      );
    }
  }

  console.log('\nVertical-related steps:');
  for (const s of raw.stepDetails ?? []) {
    if (/lift|stair|floor/i.test(s.instruction)) {
      console.log(`  F${s.floor} ${s.instruction}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
