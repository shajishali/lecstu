/**
 * Phase 11.4 — multi-floor routing smoke test per building.
 * Ground entrance → first-floor room with floor-transition steps and segments.
 * Run: npx tsx scripts/check-phase-11-4.ts
 */
import prisma from '../src/config/database';
import { computeIndoorRouteFlexible, formatIndoorRouteResponse } from '../src/services/indoorNavigationService';
import { autoPairVerticalConnectors, listVerticalConnectors } from '../src/services/verticalConnectorService';

type MarkerPick = { id: string; label: string; floor: number };

function entranceScore(label: string, type: string): number {
  const l = label.toLowerCase();
  if (type === 'ENTRANCE' && /lobby|main/.test(l)) return 0;
  if (type === 'ENTRANCE') return 1;
  if (/entrance lobby|main entrance/.test(l)) return 2;
  if (/^entrance$/.test(l.trim().toLowerCase())) return 3;
  if (/reception/.test(l)) return 4;
  if (/entrance/.test(l) && !/staircase|lift|academic|laboratory|admin/.test(l)) return 5;
  return 10;
}

function isCrossBuildingEntrance(label: string): boolean {
  return /entrance for the (academic|laboratory|admin)/i.test(label);
}

async function findGroundEntrances(buildingId: string): Promise<MarkerPick[]> {
  const markers = await prisma.mapMarker.findMany({
    where: {
      buildingId,
      floor: 0,
      OR: [
        { type: 'ENTRANCE' },
        { navNode: { type: 'ENTRANCE' } },
        { label: { contains: 'entrance', mode: 'insensitive' } },
        { label: { contains: 'lobby', mode: 'insensitive' } },
        { label: { contains: 'reception', mode: 'insensitive' } },
      ],
    },
    include: { navNode: { select: { type: true } } },
    orderBy: { label: 'asc' },
  });

  return markers
    .filter((m) => !isCrossBuildingEntrance(m.label))
    .map((m) => ({ id: m.id, label: m.label, floor: m.floor }))
    .sort(
      (a, b) =>
        entranceScore(a.label, markers.find((m) => m.id === a.id)?.type ?? '') -
        entranceScore(b.label, markers.find((m) => m.id === b.id)?.type ?? '')
    );
}

async function findUpstairsDestinations(buildingId: string, minFloor = 1): Promise<MarkerPick[]> {
  const markers = await prisma.mapMarker.findMany({
    where: {
      buildingId,
      floor: { gte: minFloor },
      navNode: { isNot: null },
    },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });

  return markers
    .filter((m) => !isCrossBuildingEntrance(m.label) && !/^staircase/i.test(m.label))
    .map((m) => ({ id: m.id, label: m.label, floor: m.floor }));
}

function isValidMultiFloorRoute(
  route: ReturnType<typeof formatIndoorRouteResponse>
): boolean {
  if (!route.found || !route.polyline?.length) return false;

  const floorsInPath = new Set(route.polyline.map((p) => p.floor));
  const hasFloorTransition = route.steps.some((s) =>
    /go (up|down)|stairs|lift|floor/i.test(s.instruction)
  );

  return floorsInPath.size >= 2 && (route.segments?.length ?? 0) >= 2 && hasFloorTransition;
}

async function findRoutablePair(
  buildingId: string
): Promise<{ from: MarkerPick; to: MarkerPick; route: ReturnType<typeof formatIndoorRouteResponse> } | null> {
  const entrances = await findGroundEntrances(buildingId);
  const destinations = await findUpstairsDestinations(buildingId, 1);

  for (const from of entrances) {
    for (const to of destinations) {
      if (from.floor >= to.floor) continue;
      const raw = await computeIndoorRouteFlexible({
        buildingId,
        fromMarkerId: from.id,
        toMarkerId: to.id,
      });
      const route = formatIndoorRouteResponse(raw);
      if (isValidMultiFloorRoute(route)) {
        return { from, to, route };
      }
    }
  }

  return null;
}

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true, name: true, floors: true },
    orderBy: { code: 'asc' },
  });

  console.log('=== Phase 11.4 Multi-Floor Routing Report ===\n');
  let tested = 0;
  let passed = 0;
  let failed = 0;

  for (const b of buildings) {
    console.log(`Building: ${b.code} (${b.name})`);

    const before = await listVerticalConnectors(b.id);
    if (before.unpairedCount > 0 && before.suggestions.length > 0) {
      const auto = await autoPairVerticalConnectors(b.id);
      console.log(`  Auto-paired ${auto.paired} vertical link(s)`);
    }

    const vertical = await listVerticalConnectors(b.id);
    console.log(
      `  Vertical links: ${vertical.edges.length} | unpaired nodes: ${vertical.unpairedCount}`
    );

    if (vertical.edges.length === 0) {
      console.log('  SKIP: no vertical links — pair stairs/lift in Admin → Vertical links\n');
      continue;
    }

    if (b.floors < 2) {
      console.log('  SKIP: single-floor building\n');
      continue;
    }

    tested++;
    try {
      const pair = await findRoutablePair(b.id);
      if (!pair) {
        failed++;
        console.log('  FAIL: no routable ground → upstairs pair found\n');
        continue;
      }

      const { from, to, route } = pair;
      const floorLabel = (f: number) => (f === 0 ? 'G' : `F${f}`);

      if (isValidMultiFloorRoute(route)) {
        passed++;
        console.log(
          `  OK | ${from.label} (${floorLabel(from.floor)}) → ${to.label} (${floorLabel(to.floor)}) | ${route.steps.length} steps | ${route.segments!.length} segments | ${Math.round(route.distanceMeters ?? 0)} m`
        );
      } else {
        failed++;
        console.log(
          `  FAIL | ${from.label} → ${to.label} | path found but missing multi-floor cues`
        );
      }
    } catch (err) {
      failed++;
      console.log(`  ERROR | ${err instanceof Error ? err.message : err}`);
    }
    console.log('');
  }

  console.log(`SUMMARY: ${passed}/${tested} multi-floor routes OK, ${failed} failed`);
  process.exit(failed === 0 && tested > 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
