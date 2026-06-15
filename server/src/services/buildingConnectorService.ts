import prisma from '../config/database';
import { MapMarkerType, NavNodeType } from '../generated/prisma/client';
import {
  CROSS_BUILDING_EDGE_LABEL,
  floorsForBuildingPair,
  getNeighborBuildingCodes,
  isSameFloorLinkAllowed,
} from '../constants/buildingConnections';
import { FACULTY_BUILDING_CODES } from '../constants/campusTopology';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';
import { AppError } from '../middleware/errorHandler';
import {
  type BuildingConnectionMeta,
  parseMarkerMetadata,
} from '../utils/markerMetadata';
import { getBuildingOrThrow } from './indoorMarkerService';

export type BuildingConnectorNode = {
  markerId: string | null;
  nodeId: string;
  label: string;
  floor: number;
  x: number;
  y: number;
};

export type FloorLinkRow = {
  floor: number;
  allowed: boolean;
  localNode: BuildingConnectorNode | null;
  remoteNode: (BuildingConnectorNode & { buildingCode: string }) | null;
  edgeId: string | null;
  paired: boolean;
};

export type NeighborFloorLinks = {
  neighborCode: string;
  neighborName: string;
  neighborBuildingId: string;
  floors: FloorLinkRow[];
  pairedCount: number;
  expectedCount: number;
};

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function isConnectorNavType(type: NavNodeType): boolean {
  return type === 'ENTRANCE' || type === 'EXIT' || type === 'CORRIDOR';
}

function labelMatchesTarget(label: string, targetBuildingCode: string): boolean {
  const lower = label.toLowerCase();
  const code = targetBuildingCode.toLowerCase();
  if (lower.includes(code)) return true;
  const building = getFacultyBuildingByCode(targetBuildingCode);
  if (!building) return false;
  return building.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .some((w) => lower.includes(w));
}

async function findConnectorNodeOnFloor(
  buildingId: string,
  targetBuildingCode: string,
  floor: number
): Promise<BuildingConnectorNode | null> {
  const nodes = await prisma.navNode.findMany({
    where: {
      buildingId,
      floor,
      type: { in: ['ENTRANCE', 'EXIT', 'CORRIDOR'] },
    },
    include: {
      mapMarker: {
        select: { id: true, label: true, metadata: true, type: true },
      },
    },
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });

  for (const n of nodes) {
    if (n.mapMarker) {
      const meta = parseMarkerMetadata(n.mapMarker.metadata);
      const conn = meta.buildingConnection as BuildingConnectionMeta | undefined;
      if (conn?.targetBuildingCode === targetBuildingCode.toUpperCase()) {
        return {
          markerId: n.mapMarker.id,
          nodeId: n.id,
          label: n.label,
          floor: n.floor,
          x: n.x,
          y: n.y,
        };
      }
    }
  }

  const markerTypes: MapMarkerType[] = ['EXIT', 'ENTRANCE'];
  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor, type: { in: markerTypes } },
    include: { navNode: { select: { id: true, x: true, y: true } } },
  });

  for (const m of markers) {
    const meta = parseMarkerMetadata(m.metadata);
    const conn = meta.buildingConnection as BuildingConnectionMeta | undefined;
    if (conn?.targetBuildingCode === targetBuildingCode.toUpperCase() && m.navNode) {
      return {
        markerId: m.id,
        nodeId: m.navNode.id,
        label: m.label,
        floor: m.floor,
        x: m.navNode.x,
        y: m.navNode.y,
      };
    }
  }

  for (const n of nodes) {
    if (labelMatchesTarget(n.label, targetBuildingCode)) {
      return {
        markerId: n.mapMarker?.id ?? null,
        nodeId: n.id,
        label: n.label,
        floor: n.floor,
        x: n.x,
        y: n.y,
      };
    }
  }

  for (const m of markers) {
    if (!m.navNode) continue;
    if (labelMatchesTarget(m.label, targetBuildingCode)) {
      return {
        markerId: m.id,
        nodeId: m.navNode.id,
        label: m.label,
        floor: m.floor,
        x: m.navNode.x,
        y: m.navNode.y,
      };
    }
  }

  const corridor = nodes.find((n) => n.type === 'CORRIDOR');
  if (corridor) {
    return {
      markerId: corridor.mapMarker?.id ?? null,
      nodeId: corridor.id,
      label: corridor.label,
      floor: corridor.floor,
      x: corridor.x,
      y: corridor.y,
    };
  }

  return null;
}

async function getCrossBuildingEdgeBetween(
  nodeIdA: string,
  nodeIdB: string
): Promise<{ id: string } | null> {
  const edge = await prisma.navEdge.findFirst({
    where: {
      label: CROSS_BUILDING_EDGE_LABEL,
      OR: [
        { fromNodeId: nodeIdA, toNodeId: nodeIdB },
        { fromNodeId: nodeIdB, toNodeId: nodeIdA },
      ],
    },
    select: { id: true },
  });
  return edge;
}

export async function createCrossBuildingNavEdge(fromNodeId: string, toNodeId: string) {
  if (fromNodeId === toNodeId) {
    throw new AppError('Select two different nodes to link', 400);
  }

  const [from, to] = await Promise.all([
    prisma.navNode.findUnique({
      where: { id: fromNodeId },
      include: { building: { select: { id: true, code: true, name: true } } },
    }),
    prisma.navNode.findUnique({
      where: { id: toNodeId },
      include: { building: { select: { id: true, code: true, name: true } } },
    }),
  ]);

  if (!from || !to) throw new AppError('Both nodes must exist', 404);
  if (from.buildingId === to.buildingId) {
    throw new AppError('Pick nodes in different buildings', 400);
  }
  if (from.floor !== to.floor) {
    throw new AppError('Building links must be on the same floor number', 400);
  }
  if (!isConnectorNavType(from.type) || !isConnectorNavType(to.type)) {
    throw new AppError('Link corridor or entrance/exit nodes at the doorway', 400);
  }
  if (!isSameFloorLinkAllowed(from.building.code, to.building.code, from.floor)) {
    throw new AppError(
      `${from.building.code} and ${to.building.code} are not connected on floor ${from.floor}. LAB floors 10–11 link to Academic only, not Administration.`,
      400
    );
  }

  const existing = await getCrossBuildingEdgeBetween(from.id, to.id);
  if (existing) return existing;

  const weight = 2 + euclidean(from.x, from.y, to.x, to.y) * 0.1;

  try {
    return await prisma.navEdge.create({
      data: {
        fromNodeId: from.id,
        toNodeId: to.id,
        bidirectional: true,
        label: CROSS_BUILDING_EDGE_LABEL,
        weight,
      },
    });
  } catch {
    throw new AppError('Could not create building link (already exists?)', 409);
  }
}

export async function deleteCrossBuildingEdge(edgeId: string) {
  const edge = await prisma.navEdge.findUnique({
    where: { id: edgeId },
    include: { from: true, to: true },
  });
  if (!edge) throw new AppError('Edge not found', 404);
  if (edge.label !== CROSS_BUILDING_EDGE_LABEL || edge.from.buildingId === edge.to.buildingId) {
    throw new AppError('Not a cross-building connector edge', 400);
  }
  await prisma.navEdge.delete({ where: { id: edgeId } });
  return edge;
}

export async function listBuildingFloorConnectors(buildingId: string) {
  const building = await getBuildingOrThrow(buildingId);
  const allBuildings = await prisma.mapBuilding.findMany({
    where: { code: { in: [...FACULTY_BUILDING_CODES] } },
    select: { id: true, code: true, name: true, floors: true },
  });

  const neighbors: NeighborFloorLinks[] = [];

  const neighborCodes = new Set<string>();
  for (let f = 0; f < building.floors; f++) {
    for (const n of getNeighborBuildingCodes(building.code, f)) {
      neighborCodes.add(n);
    }
  }

  for (const neighborCode of neighborCodes) {
    const neighbor = allBuildings.find((b) => b.code === neighborCode);
    if (!neighbor) continue;

    const allowedFloors = floorsForBuildingPair(
      building.code,
      neighbor.code,
      building.floors,
      neighbor.floors
    );

    const floorRows: FloorLinkRow[] = [];

    for (let f = 0; f < building.floors; f++) {
      const allowed = allowedFloors.includes(f);
      if (!allowed) {
        floorRows.push({
          floor: f,
          allowed: false,
          localNode: null,
          remoteNode: null,
          edgeId: null,
          paired: false,
        });
        continue;
      }

      const localNode = await findConnectorNodeOnFloor(building.id, neighbor.code, f);
      const remoteNodeRaw = await findConnectorNodeOnFloor(neighbor.id, building.code, f);
      const remoteNode = remoteNodeRaw
        ? { ...remoteNodeRaw, buildingCode: neighbor.code }
        : null;

      let edgeId: string | null = null;
      if (localNode && remoteNode) {
        const edge = await getCrossBuildingEdgeBetween(localNode.nodeId, remoteNode.nodeId);
        edgeId = edge?.id ?? null;
      }

      floorRows.push({
        floor: f,
        allowed: true,
        localNode,
        remoteNode,
        edgeId,
        paired: !!edgeId,
      });
    }

    neighbors.push({
      neighborCode: neighbor.code,
      neighborName: neighbor.name,
      neighborBuildingId: neighbor.id,
      floors: floorRows,
      pairedCount: floorRows.filter((r) => r.paired).length,
      expectedCount: allowedFloors.length,
    });
  }

  neighbors.sort((a, b) => a.neighborCode.localeCompare(b.neighborCode));

  return {
    building: { id: building.id, name: building.name, code: building.code, floors: building.floors },
    neighbors,
    totalPaired: neighbors.reduce((s, n) => s + n.pairedCount, 0),
    totalExpected: neighbors.reduce((s, n) => s + n.expectedCount, 0),
  };
}

export type FloorLinkSuggestion = {
  floor: number;
  fromNodeId: string;
  toNodeId: string;
  fromLabel: string;
  toLabel: string;
  neighborCode: string;
  reason: string;
};

export async function suggestBuildingFloorPairs(buildingId: string): Promise<FloorLinkSuggestion[]> {
  const data = await listBuildingFloorConnectors(buildingId);
  const suggestions: FloorLinkSuggestion[] = [];

  for (const neighbor of data.neighbors) {
    for (const row of neighbor.floors) {
      if (!row.allowed || row.paired) continue;
      if (!row.localNode || !row.remoteNode) continue;
      suggestions.push({
        floor: row.floor,
        fromNodeId: row.localNode.nodeId,
        toNodeId: row.remoteNode.nodeId,
        fromLabel: row.localNode.label,
        toLabel: row.remoteNode.label,
        neighborCode: neighbor.neighborCode,
        reason: `Same-floor doorway on ${row.floor === 0 ? 'Ground' : `F${row.floor}`}`,
      });
    }
  }

  return suggestions;
}

export async function pairBuildingFloorNodes(fromNodeId: string, toNodeId: string) {
  return createCrossBuildingNavEdge(fromNodeId, toNodeId);
}

export async function autoPairBuildingFloorConnectors(buildingId: string, dryRun = false) {
  const suggestions = await suggestBuildingFloorPairs(buildingId);
  const created: FloorLinkSuggestion[] = [];

  for (const s of suggestions) {
    if (dryRun) {
      created.push(s);
      continue;
    }
    try {
      await pairBuildingFloorNodes(s.fromNodeId, s.toNodeId);
      created.push(s);
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode;
      if (code === 409) continue;
      throw err;
    }
  }

  return { paired: created.length, suggestions: suggestions.length, pairs: created };
}

/** @deprecated Use listBuildingFloorConnectors */
export async function listBuildingConnectorStatus(buildingId: string) {
  const data = await listBuildingFloorConnectors(buildingId);
  return {
    building: data.building,
    connectors: data.neighbors.map((n) => ({
      fromBuildingCode: data.building.code,
      toBuildingCode: n.neighborCode,
      exitPlaced: n.floors.some((f) => f.localNode),
      entrancePlaced: n.floors.some((f) => f.remoteNode),
      paired: n.pairedCount > 0,
      pairedFloors: n.pairedCount,
      expectedFloors: n.expectedCount,
    })),
    pairedCount: data.totalPaired,
    expectedPairs: data.totalExpected,
  };
}

export async function requireBuildingConnectorPair(
  _fromBuildingId: string,
  _toBuildingCode: string
): Promise<never> {
  throw new AppError(
    'Campus routing uses the full navigation graph. Pair same-floor links in Admin → Building links.',
    500
  );
}

export async function getBuildingConnectorPair(
  _fromBuildingId: string,
  _toBuildingCode: string
): Promise<null> {
  return null;
}
