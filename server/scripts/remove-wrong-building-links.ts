/**
 * Remove invalid cross-building horizontal links:
 * - Direct ACAD ↔ LAB (no longer allowed)
 * - Any link using path points / stairs / lifts
 * - Any link without place markers on both sides
 *
 * Run: npx tsx scripts/remove-wrong-building-links.ts
 * Add --dry-run to preview without deleting.
 */
import prisma from '../src/config/database';
import {
  CROSS_BUILDING_EDGE_LABEL,
  isValidCrossBuildingDoorwayPair,
} from '../src/constants/buildingConnections';
const ROUTING_ONLY_NODE_LABEL = /^(Path point \d+|Stairs \d+|Lift \d+)$/i;

function isRoutingOnlyLabel(label: string): boolean {
  return ROUTING_ONLY_NODE_LABEL.test(label.trim());
}

function isWrongLink(
  fromCode: string,
  toCode: string,
  fromLabel: string,
  toLabel: string,
  fromMarkerId: string | null,
  toMarkerId: string | null,
  fromMetadata?: unknown,
  toMetadata?: unknown,
): { remove: boolean; reason: string } {
  if (
    (fromCode === 'ACAD' && toCode === 'LAB') ||
    (fromCode === 'LAB' && toCode === 'ACAD')
  ) {
    return { remove: true, reason: 'ACAD↔LAB direct link not allowed' };
  }
  if (isRoutingOnlyLabel(fromLabel) || isRoutingOnlyLabel(toLabel)) {
    return { remove: true, reason: 'uses path point / stairs / lift' };
  }
  if (!fromMarkerId || !toMarkerId) {
    return { remove: true, reason: 'missing place marker on one side' };
  }
  if (!isValidCrossBuildingDoorwayPair(fromCode, toCode, fromLabel, toLabel, fromMetadata, toMetadata)) {
    return { remove: true, reason: 'doorway pair does not match building sides' };
  }
  return { remove: false, reason: 'valid' };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ADMIN', 'ACAD', 'LAB'] } },
    select: { id: true, code: true },
  });
  const codeById = Object.fromEntries(buildings.map((b) => [b.id, b.code]));

  const edges = await prisma.navEdge.findMany({
    where: { label: CROSS_BUILDING_EDGE_LABEL },
    include: {
      from: {
        select: {
          id: true,
          label: true,
          buildingId: true,
          floor: true,
          mapMarkerId: true,
          mapMarker: { select: { label: true, metadata: true } },
        },
      },
      to: {
        select: {
          id: true,
          label: true,
          buildingId: true,
          floor: true,
          mapMarkerId: true,
          mapMarker: { select: { label: true, metadata: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`=== Cross-building links (${edges.length} total) ===\n`);
  if (dryRun) console.log('DRY RUN — nothing will be deleted\n');

  const toRemove: { id: string; reason: string; summary: string }[] = [];
  const toKeep: string[] = [];

  for (const e of edges) {
    const fromCode = codeById[e.from.buildingId] ?? '?';
    const toCode = codeById[e.to.buildingId] ?? '?';
    const summary = `${fromCode} F${e.from.floor} [${e.from.label}] ↔ ${toCode} F${e.to.floor} [${e.to.label}]`;
    const check = isWrongLink(
      fromCode,
      toCode,
      e.from.mapMarker?.label ?? e.from.label,
      e.to.mapMarker?.label ?? e.to.label,
      e.from.mapMarkerId,
      e.to.mapMarkerId,
      e.from.mapMarker?.metadata,
      e.to.mapMarker?.metadata,
    );

    if (check.remove) {
      toRemove.push({ id: e.id, reason: check.reason, summary });
      console.log(`REMOVE | ${summary} — ${check.reason}`);
    } else {
      toKeep.push(summary);
      console.log(`KEEP   | ${summary}`);
    }
  }

  console.log(`\nSummary: ${toRemove.length} to remove, ${toKeep.length} to keep`);

  if (toRemove.length === 0) {
    console.log('No wrong links found.');
    return;
  }

  if (dryRun) {
    console.log('\nRe-run without --dry-run to delete these links.');
    return;
  }

  const ids = toRemove.map((r) => r.id);
  const result = await prisma.navEdge.deleteMany({ where: { id: { in: ids } } });
  console.log(`\nDeleted ${result.count} cross-building edge(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
