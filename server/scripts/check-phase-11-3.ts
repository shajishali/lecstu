/**
 * Phase 11.3 — same-floor routing smoke test per building.
 * Run: npx tsx scripts/check-phase-11-3.ts
 */
import prisma from '../src/config/database';
import { computeIndoorRouteFlexible } from '../src/services/indoorNavigationService';

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true, name: true, floors: true },
    orderBy: { code: 'asc' },
  });

  console.log('=== Phase 11.3 Same-Floor Routing Report ===\n');
  let tested = 0;
  let passed = 0;
  let failed = 0;

  for (const b of buildings) {
    console.log(`Building: ${b.code} (${b.name})`);
    let buildingTested = 0;
    let buildingPassed = 0;

    for (let floor = 0; floor < b.floors; floor++) {
      const plan = await prisma.floorPlan.findFirst({
        where: { buildingId: b.id, floor, publishStatus: 'PUBLISHED' },
      });
      if (!plan) continue;

      const nodes = await prisma.navNode.findMany({
        where: {
          buildingId: b.id,
          floor,
          mapMarkerId: { not: null },
        },
        include: { mapMarker: { select: { id: true, label: true } } },
        take: 10,
      });

      const markers = nodes
        .filter((n) => n.mapMarker)
        .map((n) => ({ id: n.mapMarker!.id, label: n.mapMarker!.label }));

      if (markers.length < 2) {
        console.log(`  Floor ${floor === 0 ? 'G' : `F${floor}`}: skip (need 2+ routed places)`);
        continue;
      }

      const from = markers[0];
      const to = markers[markers.length - 1];
      if (from.id === to.id) continue;

      buildingTested++;
      tested++;
      const label = floor === 0 ? 'G' : `F${floor}`;
      try {
        const route = await computeIndoorRouteFlexible({
          buildingId: b.id,
          fromMarkerId: from.id,
          toMarkerId: to.id,
        });
        if (
          route.found &&
          route.steps.length >= 1 &&
          route.polyline.length >= 1 &&
          route.distanceMeters != null
        ) {
          buildingPassed++;
          passed++;
          console.log(
            `  Floor ${label}: OK | ${from.label} → ${to.label} | ${route.steps.length} steps | ${Math.round(route.distanceMeters)} m`
          );
        } else {
          failed++;
          console.log(
            `  Floor ${label}: FAIL | ${from.label} → ${to.label} | ${'message' in route ? route.message : 'no path'}`
          );
        }
      } catch (err) {
        failed++;
        console.log(
          `  Floor ${label}: ERROR | ${from.label} → ${to.label} | ${err instanceof Error ? err.message : err}`
        );
      }
    }

    if (buildingTested === 0) {
      console.log('  (no same-floor route pairs to test)\n');
    } else {
      console.log(`  Subtotal: ${buildingPassed}/${buildingTested} floors passed\n`);
    }
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
