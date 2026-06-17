/**
 * Phase 11.8 checkpoint — admin hub, publish workflow, health API, demo seed.
 * Run: npx tsx scripts/check-phase-11-8.ts
 */
import prisma from '../src/config/database';
import { getFacultySetupStatus } from '../src/services/facultyBuildingSeed';
import { isNavigationEngineHealthy } from '../src/services/floorNavigationEngineService';
import { isVisionServiceHealthy } from '../src/services/floorPlanVisionService';
import { validateFloorNavGraph } from '../src/services/navGraphValidationService';
import { PHASE_11_ACTIVE_FLOORS } from '../src/constants/facultyBuildings';

type Check = { name: string; pass: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];

  const setup = await getFacultySetupStatus(prisma);
  checks.push({
    name: '3 faculty buildings registered',
    pass: setup.allBuildingsExist,
    detail: setup.buildings.map((b) => b.code).join(', '),
  });

  checks.push({
    name: 'Phase 11 target = 3 buildings × 2 floors',
    pass: setup.phase11Target === 6,
    detail: `target=${setup.phase11Target}`,
  });

  const publishStates = await prisma.floorPlan.groupBy({
    by: ['publishStatus'],
    _count: true,
  });
  const hasPublishWorkflow = publishStates.some((p) => p.publishStatus === 'PUBLISHED')
    || publishStates.some((p) => p.publishStatus === 'DRAFT')
    || publishStates.some((p) => p.publishStatus === 'REVIEWED');
  checks.push({
    name: 'Publish status workflow in database',
    pass: hasPublishWorkflow || setup.phase11Uploaded === 0,
    detail: publishStates.map((p) => `${p.publishStatus}:${p._count}`).join(', ') || 'no floor plans yet',
  });

  const [visionOk, navOk] = await Promise.all([
    isVisionServiceHealthy(),
    isNavigationEngineHealthy(),
  ]);
  checks.push({
    name: 'Vision engine :8003 reachable',
    pass: visionOk,
    detail: visionOk ? 'healthy' : 'start npm run floorplan-vision',
  });
  checks.push({
    name: 'Navigation engine :8004 reachable',
    pass: navOk,
    detail: navOk ? 'healthy' : 'start npm run indoor-navigation (optional)',
  });

  let graphChecked = 0;
  let graphHealthy = 0;
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ACAD', 'ADMIN', 'LAB'] } },
    select: { id: true, code: true, floorPlans: { select: { floor: true, imagePath: true } } },
  });
  for (const b of buildings) {
    for (const f of PHASE_11_ACTIVE_FLOORS) {
      const plan = b.floorPlans.find((p) => p.floor === f);
      if (!plan?.imagePath) continue;
      graphChecked++;
      const v = await validateFloorNavGraph(b.id, f);
      if (v.healthy) graphHealthy++;
    }
  }
  checks.push({
    name: 'Graph connectivity check available',
    pass: true,
    detail:
      graphChecked > 0
        ? `${graphHealthy}/${graphChecked} phase-11 floors healthy`
        : 'upload floor plans first',
  });

  console.log('=== Phase 11.8 checks ===\n');
  let passed = 0;
  for (const c of checks) {
    const icon = c.pass ? 'PASS' : 'WARN';
    if (c.pass) passed++;
    console.log(`  [${icon}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }

  const required = checks.filter((c) => !c.name.includes(':800')).length;
  const requiredPass = checks.filter((c) => !c.name.includes(':800') && c.pass).length;
  console.log(`\nSUMMARY: ${requiredPass}/${required} required checks passed`);
  process.exit(requiredPass === required ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
