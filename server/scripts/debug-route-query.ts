import prisma from '../src/config/database';
import { computeIndoorRouteFlexible, formatIndoorRouteResponse } from '../src/services/indoorNavigationService';
import { searchMapEntities, pickBestMapSearchResult } from '../src/services/mapSearchService';

async function main() {
  const q = process.argv[2] || 'MICROBIOLOGY LAB';
  const lab = await prisma.mapBuilding.findUnique({ where: { code: 'LAB' } });
  if (!lab) throw new Error('LAB not found');

  const results = await searchMapEntities(q);
  const best = pickBestMapSearchResult(q, results);
  console.log('Search best:', best);

  const raw = await computeIndoorRouteFlexible({ buildingId: lab.id, q });
  const fmt = formatIndoorRouteResponse(raw);
  console.log(
    JSON.stringify(
      {
        found: fmt.found,
        destinationLabel: fmt.destinationLabel,
        marker: fmt.marker,
        deepLink: fmt.deepLink,
        segmentFloors: fmt.segments?.map((s) => s.floor),
        polylinePoints: fmt.polyline?.length,
        steps: fmt.steps?.map((s) => s.instruction),
      },
      null,
      2
    )
  );
}

main()
  .finally(() => prisma.$disconnect());
