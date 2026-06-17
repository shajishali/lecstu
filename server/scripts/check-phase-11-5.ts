/**
 * Phase 11.5 — multi-building routing (ACAD hub topology + legs).
 * Run: npx tsx scripts/check-phase-11-5.ts
 */
import prisma from '../src/config/database';
import {
  findBuildingPath,
  isDirectBuildingLinkAllowed,
} from '../src/constants/campusTopology';
import { isSameFloorLinkAllowed } from '../src/constants/buildingConnections';
import {
  computeIndoorRouteFlexible,
  formatIndoorRouteResponse,
} from '../src/services/indoorNavigationService';
import {
  autoPairBuildingFloorConnectors,
  listBuildingFloorConnectors,
} from '../src/services/buildingConnectorService';

async function findOfficeMarker(buildingId: string, floor = 0) {
  return prisma.mapMarker.findFirst({
    where: {
      buildingId,
      floor,
      OR: [{ type: 'OFFICE' }, { label: { contains: 'office', mode: 'insensitive' } }],
      navNode: { isNot: null },
    },
    include: { navNode: { select: { id: true } } },
    orderBy: { label: 'asc' },
  });
}

async function findLabMarker(buildingId: string) {
  return prisma.mapMarker.findFirst({
    where: {
      buildingId,
      navNode: { isNot: null },
      OR: [
        { type: 'LAB' },
        { label: { contains: 'laboratory', mode: 'insensitive' } },
        { label: { contains: 'workshop', mode: 'insensitive' } },
        { label: { contains: ' lab', mode: 'insensitive' } },
      ],
    },
    include: { navNode: { select: { id: true } } },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });
}

async function main() {
  console.log('=== Phase 11.5 Multi-Building Routing Report ===\n');

  let failed = 0;

  if (!isDirectBuildingLinkAllowed('ADMIN', 'LAB')) {
    console.log('OK | direct ADMIN↔LAB blocked (ACAD hub)');
  } else {
    failed++;
    console.log('FAIL | direct ADMIN↔LAB should be blocked');
  }

  if (!isSameFloorLinkAllowed('ADMIN', 'LAB', 0)) {
    console.log('OK | same-floor ADMIN↔LAB blocked');
  } else {
    failed++;
    console.log('FAIL | same-floor ADMIN↔LAB should be blocked');
  }

  if (isSameFloorLinkAllowed('ACAD', 'LAB', 5)) {
    console.log('OK | ACAD↔LAB allowed on shared floor');
  } else {
    failed++;
    console.log('FAIL | ACAD↔LAB should link on shared floors');
  }

  const adminToLabPath = findBuildingPath('ADMIN', 'LAB');
  if (adminToLabPath?.join('→') === 'ADMIN→ACAD→LAB') {
    console.log(`OK | building path ADMIN→LAB: ${adminToLabPath.join('→')}`);
  } else {
    failed++;
    console.log(
      `FAIL | expected ADMIN→ACAD→LAB, got ${adminToLabPath?.join('→') ?? 'none'}`
    );
  }

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ADMIN', 'ACAD', 'LAB'] } },
    orderBy: { code: 'asc' },
  });
  const byCode = Object.fromEntries(buildings.map((b) => [b.code, b]));

  for (const b of buildings) {
    const before = await listBuildingFloorConnectors(b.id);
    if (before.totalPaired < before.totalExpected) {
      const auto = await autoPairBuildingFloorConnectors(b.id);
      console.log(`${b.code}: auto-linked ${auto.paired} same-floor connection(s)`);
    }
    const status = await listBuildingFloorConnectors(b.id);
    console.log(
      `${b.code}: ${status.totalPaired}/${status.totalExpected} floor links paired`
    );
    for (const n of status.neighbors) {
      console.log(`  ↔ ${n.neighborCode}: ${n.pairedCount}/${n.expectedCount}`);
    }
  }
  console.log('');

  const admin = byCode.ADMIN;
  const lab = byCode.LAB;
  if (!admin || !lab) {
    console.log('SKIP | ADMIN or LAB missing');
    process.exit(1);
  }

  const fromOffice = await findOfficeMarker(admin.id, 0);
  const toLab = await findLabMarker(lab.id);

  if (!fromOffice || !toLab) {
    console.log('SKIP | missing test markers');
    process.exit(failed > 0 ? 1 : 0);
  }

  console.log(`Route test: ${fromOffice.label} (ADMIN G) → ${toLab.label} (LAB F${toLab.floor})`);

  try {
    const raw = await computeIndoorRouteFlexible({
      buildingId: lab.id,
      toMarkerId: toLab.id,
      fromMarkerId: fromOffice.id,
    });
    const route = formatIndoorRouteResponse(raw);

    const path = route.buildingPath?.join('→') ?? '';
    const viaAcad = path.includes('ACAD') && path !== 'ADMIN→LAB';
    const hasBuildingSteps = route.steps.some((s) => {
      const t = typeof s === 'string' ? s : s.instruction;
      return /^(Exit|Enter)\s+/i.test(t);
    });
    const hasLegs = (route.legs?.length ?? 0) >= 2;

    if (route.found && route.crossBuilding && viaAcad && hasBuildingSteps && hasLegs) {
      console.log(
        `OK | ${route.steps.length} steps | path ${path} | ${route.legs!.length} legs | ${Math.round(route.distanceMeters ?? 0)} m`
      );
    } else if (!route.found) {
      failed++;
      console.log(`FAIL | ${route.message}`);
    } else {
      failed++;
      console.log(
        `FAIL | crossBuilding=${route.crossBuilding} path=${path} legs=${route.legs?.length ?? 0} buildingSteps=${hasBuildingSteps}`
      );
    }
  } catch (err) {
    failed++;
    console.log(`ERROR | ${err instanceof Error ? err.message : err}`);
  }

  console.log('');
  console.log(`SUMMARY: ${failed === 0 ? 'PASS' : `${failed} check(s) failed`}`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
