/**
 * Phase 11.4 — multi-floor routing smoke test per building.
 * Run: npx tsx scripts/check-phase-11-4.ts
 */
import prisma from '../src/config/database';
import { computeIndoorRouteFlexible, formatIndoorRouteResponse } from '../src/services/indoorNavigationService';
import { autoPairVerticalConnectors, listVerticalConnectors } from '../src/services/verticalConnectorService';

async function findEntranceMarker(buildingId: string, floor = 0) {
  const entranceNode = await prisma.navNode.findFirst({
    where: { buildingId, floor, type: 'ENTRANCE', mapMarkerId: { not: null } },
    include: { mapMarker: { select: { id: true, label: true } } },
  });
  if (entranceNode?.mapMarker) {
    return { id: entranceNode.mapMarker.id, label: entranceNode.mapMarker.label, floor };
  }

  const marker = await prisma.mapMarker.findFirst({
    where: {
      buildingId,
      floor,
      OR: [
        { type: 'ENTRANCE' },
        { label: { contains: 'entrance', mode: 'insensitive' } },
        { label: { contains: 'lobby', mode: 'insensitive' } },
      ],
    },
    orderBy: { label: 'asc' },
  });
  return marker ? { id: marker.id, label: marker.label, floor: marker.floor } : null;
}

async function findUpstairsDestination(buildingId: string, minFloor = 1) {
  const marker = await prisma.mapMarker.findFirst({
    where: {
      buildingId,
      floor: { gte: minFloor },
      navNode: { isNot: null },
    },
    include: { navNode: { select: { id: true } } },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });
  return marker ? { id: marker.id, label: marker.label, floor: marker.floor } : null;
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

    const from = await findEntranceMarker(b.id, 0);
    const to = await findUpstairsDestination(b.id, 1);

    if (!from) {
      console.log('  SKIP: no ground entrance marker\n');
      continue;
    }
    if (!to) {
      console.log('  SKIP: no upstairs destination marker\n');
      continue;
    }

    if (from.floor === to.floor) {
      console.log(`  SKIP: destination not on higher floor (${from.label} → ${to.label})\n`);
      continue;
    }

    tested++;
    try {
      const raw = await computeIndoorRouteFlexible({
        buildingId: b.id,
        fromMarkerId: from.id,
        toMarkerId: to.id,
      });
      const route = formatIndoorRouteResponse(raw);

      const floorsInPath = new Set(
        route.found && route.polyline ? route.polyline.map((p) => p.floor) : []
      );
      const hasFloorTransition =
        route.found &&
        route.steps.some((s) => /go (up|down)|stairs|lift|floor/i.test(s.instruction));

      if (
        route.found &&
        floorsInPath.size >= 2 &&
        (route.segments?.length ?? 0) >= 2 &&
        hasFloorTransition
      ) {
        passed++;
        console.log(
          `  OK | ${from.label} (G) → ${to.label} (F${to.floor}) | ${route.steps.length} steps | ${route.segments!.length} segments | ${Math.round(route.distanceMeters ?? 0)} m`
        );
      } else {
        failed++;
        console.log(
          `  FAIL | ${from.label} → ${to.label} | ${route.found ? 'path found but missing multi-floor cues' : route.message}`
        );
      }
    } catch (err) {
      failed++;
      console.log(
        `  ERROR | ${from.label} → ${to.label} | ${err instanceof Error ? err.message : err}`
      );
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
