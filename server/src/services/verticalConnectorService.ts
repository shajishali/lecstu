import prisma from '../config/database';
import { NavNodeType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import { createNavEdge } from './indoorNavigationService';
import { getBuildingOrThrow } from './indoorMarkerService';

const VERTICAL_TYPES: NavNodeType[] = ['STAIRS', 'LIFT'];

import { normalizeVerticalConnectorLabel } from '../utils/verticalConnectorLabels';

function normalizeVerticalLabel(label: string): string {
  return normalizeVerticalConnectorLabel(label);
}

function verticalEdgeLabel(fromType: NavNodeType, toType: NavNodeType): string {
  if (fromType === 'LIFT' && toType === 'LIFT') return 'lift';
  return 'stairs';
}

function verticalEdgeWeight(floorA: number, floorB: number): number {
  return 5 + Math.abs(floorA - floorB) * 2;
}

export type VerticalNodeRow = {
  id: string;
  label: string;
  floor: number;
  type: NavNodeType;
  x: number;
  y: number;
  pairedNodeId: string | null;
  pairedFloor: number | null;
  edgeId: string | null;
};

export async function listVerticalConnectors(buildingId: string) {
  const building = await getBuildingOrThrow(buildingId);
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, type: { in: VERTICAL_TYPES } },
    orderBy: [{ floor: 'asc' }, { type: 'asc' }, { label: 'asc' }],
  });

  const nodeIds = nodes.map((n) => n.id);
  const edges =
    nodeIds.length === 0
      ? []
      : await prisma.navEdge.findMany({
          where: {
            OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
          },
          include: {
            from: { select: { id: true, floor: true, label: true, type: true } },
            to: { select: { id: true, floor: true, label: true, type: true } },
          },
        });

  const crossFloorEdges = edges.filter((e) => e.from.floor !== e.to.floor);
  const pairByNode = new Map<string, { nodeId: string; floor: number; edgeId: string }>();

  for (const e of crossFloorEdges) {
    pairByNode.set(e.fromNodeId, { nodeId: e.toNodeId, floor: e.to.floor, edgeId: e.id });
    pairByNode.set(e.toNodeId, { nodeId: e.fromNodeId, floor: e.from.floor, edgeId: e.id });
  }

  const rows: VerticalNodeRow[] = nodes.map((n) => {
    const pair = pairByNode.get(n.id);
    return {
      id: n.id,
      label: n.label,
      floor: n.floor,
      type: n.type,
      x: n.x,
      y: n.y,
      pairedNodeId: pair?.nodeId ?? null,
      pairedFloor: pair?.floor ?? null,
      edgeId: pair?.edgeId ?? null,
    };
  });

  const unpaired = rows.filter((r) => !r.pairedNodeId);
  const suggestions = await suggestVerticalPairs(buildingId);

  return {
    building: { id: building.id, name: building.name, code: building.code, floors: building.floors },
    nodes: rows,
    edges: crossFloorEdges.map((e) => ({
      id: e.id,
      label: e.label,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      fromFloor: e.from.floor,
      toFloor: e.to.floor,
      fromLabel: e.from.label,
      toLabel: e.to.label,
    })),
    unpairedCount: unpaired.length,
    suggestions,
  };
}

export async function suggestVerticalPairs(buildingId: string) {
  await getBuildingOrThrow(buildingId);
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, type: { in: VERTICAL_TYPES } },
  });

  const nodeIds = nodes.map((n) => n.id);
  const existing = new Set<string>();
  if (nodeIds.length > 0) {
    const edges = await prisma.navEdge.findMany({
      where: {
        OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
      },
      include: { from: { select: { floor: true } }, to: { select: { floor: true } } },
    });
    for (const e of edges) {
      if (e.from.floor !== e.to.floor) {
        existing.add([e.fromNodeId, e.toNodeId].sort().join(':'));
      }
    }
  }

  const suggestions: Array<{
    fromNodeId: string;
    toNodeId: string;
    fromLabel: string;
    toLabel: string;
    fromFloor: number;
    toFloor: number;
    type: NavNodeType;
    reason: string;
  }> = [];

  for (const a of nodes) {
    for (const b of nodes) {
      if (a.id >= b.id) continue;
      if (Math.abs(a.floor - b.floor) !== 1) continue;
      if (a.type !== b.type) continue;

      const key = [a.id, b.id].sort().join(':');
      if (existing.has(key)) continue;

      const normA = normalizeVerticalLabel(a.label);
      const normB = normalizeVerticalLabel(b.label);
      const labelsMatch =
        normA.length > 0 && normB.length > 0 && (normA === normB || normA.includes(normB) || normB.includes(normA));
      const genericMatch =
        normA.length === 0 &&
        normB.length === 0 &&
        /stair|lift/i.test(`${a.label} ${b.label}`);

      if (labelsMatch || genericMatch) {
        const [from, to] = a.floor < b.floor ? [a, b] : [b, a];
        suggestions.push({
          fromNodeId: from.id,
          toNodeId: to.id,
          fromLabel: from.label,
          toLabel: to.label,
          fromFloor: from.floor,
          toFloor: to.floor,
          type: from.type,
          reason: labelsMatch ? 'Matching label on adjacent floors' : 'Adjacent vertical nodes',
        });
      }
    }
  }

  return suggestions;
}

export async function pairVerticalNodes(fromNodeId: string, toNodeId: string) {
  if (fromNodeId === toNodeId) {
    throw new AppError('Select two different nodes to pair', 400);
  }

  const [from, to] = await Promise.all([
    prisma.navNode.findUnique({ where: { id: fromNodeId } }),
    prisma.navNode.findUnique({ where: { id: toNodeId } }),
  ]);

  if (!from || !to) throw new AppError('Both nodes must exist', 404);
  if (from.buildingId !== to.buildingId) {
    throw new AppError('Nodes must belong to the same building', 400);
  }
  if (!VERTICAL_TYPES.includes(from.type) || !VERTICAL_TYPES.includes(to.type)) {
    throw new AppError('Both nodes must be STAIRS or LIFT', 400);
  }
  if (from.floor === to.floor) {
    throw new AppError('Vertical links must connect different floors', 400);
  }
  if (Math.abs(from.floor - to.floor) > 3) {
    throw new AppError('Vertical links should connect adjacent or nearby floors (max 3 apart)', 400);
  }

  const label = verticalEdgeLabel(from.type, to.type);
  const weight = verticalEdgeWeight(from.floor, to.floor);

  const lowerFloorNode = from.floor < to.floor ? from : to;
  const edge = await createNavEdge({
    fromNodeId: lowerFloorNode.id,
    toNodeId: lowerFloorNode.id === fromNodeId ? toNodeId : fromNodeId,
    bidirectional: true,
    label,
    weight,
  });

  return edge;
}

export async function deleteVerticalEdge(edgeId: string) {
  const edge = await prisma.navEdge.findUnique({
    where: { id: edgeId },
    include: { from: true, to: true },
  });
  if (!edge) throw new AppError('Edge not found', 404);
  if (edge.from.floor === edge.to.floor) {
    throw new AppError('Not a vertical connector edge', 400);
  }
  await prisma.navEdge.delete({ where: { id: edgeId } });
  return edge;
}

export async function autoPairVerticalConnectors(buildingId: string, dryRun = false) {
  const suggestions = await suggestVerticalPairs(buildingId);
  const created: typeof suggestions = [];

  for (const s of suggestions) {
    if (dryRun) {
      created.push(s);
      continue;
    }
    try {
      await pairVerticalNodes(s.fromNodeId, s.toNodeId);
      created.push(s);
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 409) continue;
      throw err;
    }
  }

  return { paired: created.length, suggestions: suggestions.length, pairs: created };
}
