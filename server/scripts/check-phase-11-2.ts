import prisma from '../src/config/database';
import { validateFloorNavGraph } from '../src/services/navGraphValidationService';

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    select: { id: true, code: true, name: true, floors: true },
    orderBy: { code: 'asc' },
  });
  const floorPlans = await prisma.floorPlan.findMany({
    select: { buildingId: true, floor: true, publishStatus: true, locationsLockedAt: true },
    orderBy: [{ buildingId: 'asc' }, { floor: 'asc' }],
  });

  console.log('=== Phase 11.2 Graph Validation Report ===\n');
  let total = 0;
  let healthy = 0;
  let unhealthy = 0;

  for (const b of buildings) {
    console.log(`Building: ${b.code} (${b.name}) — ${b.floors} levels (Ground + Floor 1–${b.floors - 1})`);
    const bPlans = floorPlans.filter((p) => p.buildingId === b.id && p.floor < b.floors);
    const skipped = floorPlans.filter((p) => p.buildingId === b.id && p.floor >= b.floors);
    if (skipped.length) {
      console.log(
        `  (skipped ${skipped.length} out-of-range record(s): ${skipped.map((p) => (p.floor === 0 ? 'G' : `F${p.floor}`)).join(', ')} — run cleanup-out-of-range-floorplans.ts)`
      );
    }
    if (!bPlans.length) {
      console.log('  (no floor plans uploaded)\n');
      continue;
    }
    for (const plan of bPlans) {
      total++;
      const fl = plan.floor;
      const label = fl === 0 ? 'G' : `F${fl}`;
      const v = await validateFloorNavGraph(b.id, fl);
      const status = v.healthy ? 'HEALTHY' : 'NEEDS WORK';
      if (v.healthy) healthy++;
      else unhealthy++;
      console.log(
        `  Floor ${label}: ${status} | nodes=${v.nodeCount} edges=${v.edgeCount}` +
          ` entrance=${v.entranceCount} stairs=${v.stairsCount} lift=${v.liftCount}` +
          ` locked=${plan.locationsLockedAt ? 'yes' : 'no'} publish=${plan.publishStatus}`
      );
      if (v.orphanNodes.length) {
        console.log(
          `    Orphans: ${v.orphanNodes.map((n) => `${n.label} (${n.type})`).join(', ')}`
        );
      }
      if (v.markersWithoutNode.length) {
        console.log(`    Markers without node: ${v.markersWithoutNode.map((m) => m.label).join(', ')}`);
      }
      if (!v.healthy) {
        for (const issue of v.issues) console.log(`    - ${issue}`);
      }
      if (v.warnings?.length) {
        for (const w of v.warnings) console.log(`    ! ${w}`);
      }
      if (v.healthy && !v.warnings?.length) {
        console.log('    (fully healthy)');
      }
    }
    console.log('');
  }

  console.log(`SUMMARY: ${healthy}/${total} floors healthy, ${unhealthy} need work`);
  process.exit(unhealthy === 0 && total > 0 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
