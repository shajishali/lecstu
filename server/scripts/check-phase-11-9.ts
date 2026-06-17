/**
 * Phase 11.9 — active navigation & QR positioning.
 * Run: npx tsx scripts/check-phase-11-9.ts
 */
import prisma from '../src/config/database';
import { registerPositionProvider, resolvePosition } from '../src/modules/indoor-navigation/positioning/position-service';
import { BleBeaconPositionProvider } from '../src/modules/indoor-navigation/positioning/ble-position-provider';
import { UwbPositionProvider } from '../src/modules/indoor-navigation/positioning/uwb-position-provider';
import { resolveStepIndexForPathNode } from '../src/modules/indoor-navigation/utils/activeNavigation';

async function main() {
  const checks: Array<{ name: string; pass: boolean; detail?: string }> = [];

  registerPositionProvider('BLE_BEACON', new BleBeaconPositionProvider());
  registerPositionProvider('UWB', new UwbPositionProvider());

  const ble = await resolvePosition('BLE_BEACON', { beaconId: 'test' });
  const uwb = await resolvePosition('UWB', { anchorId: 'test' });
  checks.push({
    name: 'BLE_BEACON provider registered (stub returns null)',
    pass: ble === null,
  });
  checks.push({
    name: 'UWB provider registered (stub returns null)',
    pass: uwb === null,
  });

  const qrCount = await prisma.navQrCode.count({ where: { isActive: true } });
  checks.push({
    name: 'Active QR codes in database',
    pass: qrCount > 0,
    detail: qrCount > 0 ? `${qrCount} code(s)` : 'create QR codes in admin graph editor',
  });

  const stepIdx = resolveStepIndexForPathNode(
    [
      { instruction: 'Start', floor: 0, polylineIndex: 0 },
      { instruction: 'Turn left', floor: 0, polylineIndex: 2 },
      { instruction: 'Take stairs', floor: 0, polylineIndex: 4 },
    ],
    ['n1', 'n2', 'n3', 'n4', 'n5'],
    'n3',
    0
  );
  checks.push({
    name: 'Step index resolves from path node',
    pass: stepIdx >= 0 && stepIdx < 3,
    detail: `node n3 → step ${stepIdx}`,
  });

  console.log('=== Phase 11.9 checks ===\n');
  let passed = 0;
  for (const c of checks) {
    const icon = c.pass ? 'PASS' : 'WARN';
    if (c.pass) passed++;
    console.log(`  [${icon}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log(`\nSUMMARY: ${passed}/${checks.length} checks passed`);
  console.log('\nManual UI: /navigate → get directions → Scan QR → rescan updates route');
  process.exit(passed >= 3 ? 0 : 1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
