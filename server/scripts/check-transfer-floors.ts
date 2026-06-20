import prisma from '../src/config/database';
import { CROSS_BUILDING_EDGE_LABEL } from '../src/constants/buildingConnections';
import { FACULTY_BUILDING_CODES } from '../src/constants/campusTopology';

async function main() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: [...FACULTY_BUILDING_CODES] } },
    select: { id: true, code: true, floors: true },
  });
  const byCode = Object.fromEntries(buildings.map((b) => [b.code, b]));

  const edges = await prisma.navEdge.findMany({
    where: { label: CROSS_BUILDING_EDGE_LABEL },
    include: {
      from: { select: { buildingId: true, floor: true, label: true } },
      to: { select: { buildingId: true, floor: true, label: true } },
    },
  });

  const pairsByFloor = new Map<number, Set<string>>();

  for (const e of edges) {
    const fromB = buildings.find((b) => b.id === e.from.buildingId);
    const toB = buildings.find((b) => b.id === e.to.buildingId);
    if (!fromB || !toB) continue;
    const f = e.from.floor;
    const key = [fromB.code, toB.code].sort().join('-');
    if (!pairsByFloor.has(f)) pairsByFloor.set(f, new Set());
    pairsByFloor.get(f)!.add(key);
  }

  const need = ['ACAD-ADMIN', 'ADMIN-LAB'];
  console.log('Floors with full ACAD→ADMIN→LAB horizontal path:');
  for (let f = 0; f <= 11; f++) {
    const pairs = pairsByFloor.get(f) ?? new Set();
    const ok = need.every((n) => pairs.has(n));
    console.log(`  F${f}: ${ok ? 'YES' : 'no'} (${[...pairs].join(', ') || 'none'})`);
  }

  for (const code of ['ACAD', 'LAB'] as const) {
    const b = byCode[code];
    const lifts = await prisma.navNode.findMany({
      where: { buildingId: b.id, type: { in: ['LIFT', 'STAIRS'] }, floor: 0 },
      select: { label: true, type: true },
      orderBy: { label: 'asc' },
    });
    console.log(`\n${code} G0 vertical connectors:`, lifts.map((l) => `${l.label} (${l.type})`).join(', '));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
