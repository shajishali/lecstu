/**
 * Phase 11.3 — same-floor routing smoke test per building.
 * Prefers Lecture Hall A → Lecture Hall B; falls back to two routed markers on same floor.
 * Run: npx tsx scripts/check-phase-11-3.ts
 */
import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';

const HALL_A_PATTERNS = [/lecture\s*hall\s*a\b/i, /\bhall\s*a\b/i, /\bLCH-\d+-1\b/i, /-1$/];
const HALL_B_PATTERNS = [/lecture\s*hall\s*b\b/i, /\bhall\s*b\b/i, /\bLCH-\d+-2\b/i, /-2$/];

type RoutePair = {
  fromLabel: string;
  toLabel: string;
  floor: number;
  fromMarkerId: string;
  toHallId?: string;
  toMarkerId?: string;
};

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

async function findHallPair(buildingId: string): Promise<RoutePair | null> {
  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, hallId: { not: null } },
    include: { hall: { select: { id: true, name: true } } },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });

  const byFloor = new Map<number, typeof markers>();
  for (const m of markers) {
    if (!m.hallId || !m.hall) continue;
    const list = byFloor.get(m.floor) ?? [];
    list.push(m);
    byFloor.set(m.floor, list);
  }

  for (const [floor, floorMarkers] of [...byFloor.entries()].sort((a, b) => a[0] - b[0])) {
    const plan = await prisma.floorPlan.findFirst({
      where: { buildingId, floor, publishStatus: 'PUBLISHED' },
    });
    if (!plan || floorMarkers.length < 2) continue;

    const hallA = floorMarkers.find(
      (m) => matchesAny(m.label, HALL_A_PATTERNS) || matchesAny(m.hall!.name, HALL_A_PATTERNS)
    );
    const hallB = floorMarkers.find(
      (m) =>
        m.id !== hallA?.id &&
        (matchesAny(m.label, HALL_B_PATTERNS) || matchesAny(m.hall!.name, HALL_B_PATTERNS))
    );

    if (hallA && hallB) {
      return {
        fromLabel: hallA.label,
        toLabel: hallB.hall!.name,
        floor,
        fromMarkerId: hallA.id,
        toHallId: hallB.hallId!,
      };
    }

    const distinct = floorMarkers.filter(
      (m, i, arr) => arr.findIndex((x) => x.hallId === m.hallId) === i
    );
    if (distinct.length >= 2) {
      return {
        fromLabel: distinct[0].label,
        toLabel: distinct[1].hall!.name,
        floor,
        fromMarkerId: distinct[0].id,
        toHallId: distinct[1].hallId!,
      };
    }
  }

  return null;
}

async function findMarkerPair(buildingId: string): Promise<RoutePair | null> {
  const building = await prisma.mapBuilding.findUnique({
    where: { id: buildingId },
    select: { floors: true },
  });
  if (!building) return null;

  for (let floor = 0; floor < building.floors; floor++) {
    const plan = await prisma.floorPlan.findFirst({
      where: { buildingId, floor, publishStatus: 'PUBLISHED' },
    });
    if (!plan) continue;

    const nodes = await prisma.navNode.findMany({
      where: { buildingId, floor, mapMarkerId: { not: null } },
      include: { mapMarker: { select: { id: true, label: true } } },
      take: 10,
    });

    const markers = nodes
      .filter((n) => n.mapMarker)
      .map((n) => ({ id: n.mapMarker!.id, label: n.mapMarker!.label }));

    if (markers.length < 2) continue;

    const from = markers[0];
    const to = markers[markers.length - 1];
    if (from.id === to.id) continue;

    return {
      fromLabel: from.label,
      toLabel: to.label,
      floor,
      fromMarkerId: from.id,
      toMarkerId: to.id,
    };
  }

  return null;
}

async function findSameFloorPair(buildingId: string): Promise<RoutePair | null> {
  return (await findHallPair(buildingId)) ?? (await findMarkerPair(buildingId));
}

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  console.log('=== Phase 11.3 Same-Floor Routing Report ===\n');
  let tested = 0;
  let passed = 0;
  let failed = 0;

  for (const b of buildings) {
    console.log(`Building: ${b.code} (${b.name})`);

    const pair = await findSameFloorPair(b.id);
    if (!pair) {
      console.log('  SKIP — no same-floor route pair on published floors\n');
      continue;
    }

    const floorLabel = pair.floor === 0 ? 'G' : `F${pair.floor}`;
    const mode = pair.toHallId ? 'hall' : 'marker';
    tested++;

    try {
      const route = await computeIndoorRouteFlexible({
        buildingId: b.id,
        fromMarkerId: pair.fromMarkerId,
        ...(pair.toHallId ? { toHallId: pair.toHallId } : { toMarkerId: pair.toMarkerId }),
      });

      const ok =
        route.found &&
        !('alreadyHere' in route && route.alreadyHere) &&
        route.steps.length >= 1 &&
        route.polyline.length >= 1 &&
        route.distanceMeters != null;

      if (ok) {
        passed++;
        console.log(
          `  Floor ${floorLabel} (${mode}): OK | ${pair.fromLabel} → ${pair.toLabel} | ${route.steps.length} steps | ${Math.round(route.distanceMeters!)} m`
        );
      } else {
        failed++;
        const msg =
          'message' in route
            ? route.message
            : 'alreadyHere' in route && route.alreadyHere
              ? 'same room'
              : 'no path';
        console.log(`  Floor ${floorLabel} (${mode}): FAIL | ${pair.fromLabel} → ${pair.toLabel} | ${msg}`);
      }
    } catch (err) {
      failed++;
      console.log(
        `  Floor ${floorLabel} (${mode}): ERROR | ${pair.fromLabel} → ${pair.toLabel} | ${err instanceof Error ? err.message : err}`
      );
    }

    console.log('');
  }

  console.log(`SUMMARY: ${passed}/${tested} same-floor routes OK, ${failed} failed`);
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
