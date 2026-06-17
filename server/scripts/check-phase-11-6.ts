/**
 * Phase 11.6 — unified NL navigation pipeline smoke test.
 * Run: npx tsx scripts/check-phase-11-6.ts
 */
import {
  detectNavigationIntentLocal,
} from '../src/services/navigationIntentService';
import { executeUnifiedNavigationQuery } from '../src/services/unifiedNavigationQueryService';
import prisma from '../src/config/database';

async function main() {
  console.log('=== Phase 11.6 Unified NL Navigation Report ===\n');
  let failed = 0;

  const intentCases: Array<{ msg: string; expectNav: boolean; intent?: string }> = [
    { msg: 'Take me to ELV ROOM', expectNav: true, intent: 'guide_to_room' },
    { msg: 'From reception to dean office', expectNav: true, intent: 'guide_to_room' },
    { msg: 'Guide me to my next class', expectNav: true, intent: 'guide_to_next_class' },
    { msg: 'What is my timetable today', expectNav: false },
  ];

  for (const c of intentCases) {
    const intent = detectNavigationIntentLocal(c.msg);
    const ok =
      intent.isNavigation === c.expectNav &&
      (!c.intent || intent.intent === c.intent);
    console.log(`${ok ? 'OK' : 'FAIL'} | intent | "${c.msg}" → ${intent.intent} (nav=${intent.isNavigation})`);
    if (!ok) failed++;
  }

  const admin = await prisma.mapBuilding.findFirst({ where: { code: 'ADMIN' } });
  if (!admin) {
    console.log('SKIP | ADMIN building missing');
    process.exit(1);
  }

  const roomRoute = await executeUnifiedNavigationQuery({
    message: 'Take me to ELV ROOM in Administration building',
    buildingId: admin.id,
  });

  const roomOk =
    roomRoute.routed &&
    roomRoute.intent.isNavigation &&
    (roomRoute.found
      ? Boolean(roomRoute.polyline?.length && roomRoute.steps?.length)
      : Boolean(roomRoute.message));
  console.log(
    `${roomOk ? 'OK' : 'FAIL'} | graph-first route | found=${roomRoute.found} steps=${roomRoute.steps?.length ?? 0} poly=${roomRoute.polyline?.length ?? 0}`
  );
  if (!roomOk) failed++;

  const notNav = await executeUnifiedNavigationQuery({ message: 'Hello there' });
  if (!notNav.routed && !notNav.intent.isNavigation) {
    console.log('OK | non-navigation query rejected');
  } else {
    failed++;
    console.log('FAIL | non-navigation should not route');
  }

  const nextClass = await executeUnifiedNavigationQuery({
    message: 'guide me to my next class',
    userRole: 'STUDENT',
    userId: 'test-nonexistent-user',
  });
  if (
    nextClass.routed &&
    nextClass.intent?.intent === 'guide_to_next_class' &&
    nextClass.action === 'guide_to_next_class'
  ) {
    console.log(`OK | next-class intent handled (found=${nextClass.found})`);
  } else {
    failed++;
    console.log(
      `FAIL | next-class intent (routed=${nextClass.routed}, intent=${nextClass.intent?.intent}, action=${nextClass.action})`
    );
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
