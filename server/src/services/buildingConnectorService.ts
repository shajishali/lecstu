import prisma from '../config/database';
import { MapMarkerType } from '../generated/prisma/client';
import {
  CROSS_BUILDING_EDGE_LABEL,
  floorsForBuildingPair,
  getNeighborBuildingCodes,
  isSameFloorLinkAllowed,
  isValidCrossBuildingDoorwayPair,
} from '../constants/buildingConnections';
import { FACULTY_BUILDING_CODES } from '../constants/campusTopology';
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

type LockedMarkerSnapshotEntry = {
  id: string;
  label: string;
  x: number;
  y: number;
};

async function getLockedMarkerSnapshotById(
  buildingId: string,
  floor: number
): Promise<Map<string, LockedMarkerSnapshotEntry>> {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { locationsLockedAt: true, lockedMarkerSnapshot: true },
  });
  const map = new Map<string, LockedMarkerSnapshotEntry>();
  if (!plan?.locationsLockedAt) return map;
  const snap = plan.lockedMarkerSnapshot as LockedMarkerSnapshotEntry[] | null;
  for (const m of snap ?? []) map.set(m.id, m);
  return map;
}

function placeDisplayCoords(
  node: {
    id: string;
    label: string;
    x: number;
    y: number;
    mapMarkerId: string | null;
    mapMarker?: { id: string; label: string; x: number; y: number } | null;
  },
  lockedByMarkerId: Map<string, LockedMarkerSnapshotEntry>
): { x: number; y: number; label: string } {
  if (node.mapMarkerId) {
    const locked = lockedByMarkerId.get(node.mapMarkerId);
    if (locked) return { x: locked.x, y: locked.y, label: locked.label };
    if (node.mapMarker) {
      return { x: node.mapMarker.x, y: node.mapMarker.y, label: node.mapMarker.label };
    }
  }
  return { x: node.x, y: node.y, label: node.label };
}

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

const ROUTING_ONLY_NODE_LABEL = /^(Path point \d+|Stairs \d+|Lift \d+)$/i;

function isRoutingOnlyNavLabel(label: string): boolean {
  return ROUTING_ONLY_NODE_LABEL.test(label.trim());
}

function hasExplicitBuildingConnection(
  metadata: unknown,
  targetBuildingCode: string
): boolean {
  const meta = parseMarkerMetadata(metadata);
  const conn = meta.buildingConnection as BuildingConnectionMeta | undefined;
  return conn?.targetBuildingCode === targetBuildingCode.toUpperCase();
}

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

async function findConnectorNodeOnFloor(
  buildingId: string,
  targetBuildingCode: string,
  floor: number
): Promise<BuildingConnectorNode | null> {
  const target = targetBuildingCode.toUpperCase();
  const markerTypes: MapMarkerType[] = ['EXIT', 'ENTRANCE'];

  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor, type: { in: markerTypes } },
    include: { navNode: { select: { id: true, x: true, y: true } } },
    orderBy: { label: 'asc' },
  });

  for (const m of markers) {
    if (!hasExplicitBuildingConnection(m.metadata, target) || !m.navNode) continue;
    return {
      markerId: m.id,
      nodeId: m.navNode.id,
      label: m.label,
      floor: m.floor,
      x: m.navNode.x,
      y: m.navNode.y,
    };
  }

  const nodes = await prisma.navNode.findMany({
    where: {
      buildingId,
      floor,
      type: { in: ['ENTRANCE', 'EXIT'] },
      mapMarkerId: { not: null },
    },
    include: {
      mapMarker: {
        select: { id: true, label: true, metadata: true, type: true },
      },
    },
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
  });

  for (const n of nodes) {
    if (!n.mapMarker || !hasExplicitBuildingConnection(n.mapMarker.metadata, target)) continue;
    return {
      markerId: n.mapMarker.id,
      nodeId: n.id,
      label: n.mapMarker.label,
      floor: n.floor,
      x: n.x,
      y: n.y,
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
  if (!from.mapMarkerId || !to.mapMarkerId) {
    throw new AppError('Select place markers on each floor (not path points)', 400);
  }
  if (isRoutingOnlyNavLabel(from.label) || isRoutingOnlyNavLabel(to.label)) {
    throw new AppError('Cannot link path points or stairs/lifts — pick doorway or room markers only', 400);
  }
  if (!isSameFloorLinkAllowed(from.building.code, to.building.code, from.floor)) {
    throw new AppError(
      `${from.building.code} and ${to.building.code} cannot be linked on floor ${from.floor}. Check which buildings may connect for ${from.building.code}.`,
      400
    );
  }

  const [fromMarker, toMarker] = await Promise.all([
    from.mapMarkerId
      ? prisma.mapMarker.findUnique({
          where: { id: from.mapMarkerId },
          select: { metadata: true, label: true },
        })
      : null,
    to.mapMarkerId
      ? prisma.mapMarker.findUnique({
          where: { id: to.mapMarkerId },
          select: { metadata: true, label: true },
        })
      : null,
  ]);

  if (
    !isValidCrossBuildingDoorwayPair(
      from.building.code,
      to.building.code,
      fromMarker?.label ?? from.label,
      toMarker?.label ?? to.label,
      fromMarker?.metadata,
      toMarker?.metadata
    )
  ) {
    throw new AppError(
      `Invalid doorway pair: ${from.building.code} [${from.label}] cannot link directly to ${to.building.code} [${to.label}]. Use the doorway that faces ${to.building.code} on the ${from.building.code} side.`,
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

export async function suggestBuildingFloorPairs(_buildingId: string): Promise<FloorLinkSuggestion[]> {
  // Manual links only — never auto-suggest corridor/path-point pairings.
  return [];
}

export async function pairBuildingFloorNodes(fromNodeId: string, toNodeId: string) {
  return createCrossBuildingNavEdge(fromNodeId, toNodeId);
}

export async function listConnectorNodesOnFloor(
  buildingId: string,
  floor: number
): Promise<BuildingConnectorNode[]> {
  const lockedByMarkerId = await getLockedMarkerSnapshotById(buildingId, floor);
  const nodes = await prisma.navNode.findMany({
    where: {
      buildingId,
      floor,
      mapMarkerId: { not: null },
    },
    include: {
      mapMarker: { select: { id: true, label: true, x: true, y: true } },
    },
    orderBy: [{ label: 'asc' }],
  });

  return nodes
    .filter((n) => n.mapMarker && !isRoutingOnlyNavLabel(n.mapMarker.label) && !isRoutingOnlyNavLabel(n.label))
    .map((n) => {
    const display = placeDisplayCoords(n, lockedByMarkerId);
    return {
      markerId: n.mapMarker!.id,
      nodeId: n.id,
      label: display.label,
      floor: n.floor,
      x: display.x,
      y: display.y,
    };
  });
}

export type CrossBuildingEdgeRow = {
  edgeId: string;
  localNode: { nodeId: string; label: string; x: number; y: number };
  remoteNode: { nodeId: string; label: string; buildingCode: string; x: number; y: number };
};

async function listCrossBuildingEdgesOnFloor(
  localBuildingId: string,
  remoteBuildingId: string,
  floor: number,
  remoteBuildingCode: string
): Promise<CrossBuildingEdgeRow[]> {
  const [localLocked, remoteLocked] = await Promise.all([
    getLockedMarkerSnapshotById(localBuildingId, floor),
    getLockedMarkerSnapshotById(remoteBuildingId, floor),
  ]);

  const edges = await prisma.navEdge.findMany({
    where: {
      label: CROSS_BUILDING_EDGE_LABEL,
      OR: [
        {
          from: { buildingId: localBuildingId, floor },
          to: { buildingId: remoteBuildingId, floor },
        },
        {
          from: { buildingId: remoteBuildingId, floor },
          to: { buildingId: localBuildingId, floor },
        },
      ],
    },
    include: {
      from: {
        select: {
          id: true,
          label: true,
          buildingId: true,
          x: true,
          y: true,
          mapMarkerId: true,
          mapMarker: { select: { id: true, label: true, x: true, y: true } },
        },
      },
      to: {
        select: {
          id: true,
          label: true,
          buildingId: true,
          x: true,
          y: true,
          mapMarkerId: true,
          mapMarker: { select: { id: true, label: true, x: true, y: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return edges.map((e) => {
    const localIsFrom = e.from.buildingId === localBuildingId;
    const local = localIsFrom ? e.from : e.to;
    const remote = localIsFrom ? e.to : e.from;
    const localDisplay = placeDisplayCoords(local, localLocked);
    const remoteDisplay = placeDisplayCoords(remote, remoteLocked);
    return {
      edgeId: e.id,
      localNode: {
        nodeId: local.id,
        label: localDisplay.label,
        x: localDisplay.x,
        y: localDisplay.y,
      },
      remoteNode: {
        nodeId: remote.id,
        label: remoteDisplay.label,
        buildingCode: remoteBuildingCode,
        x: remoteDisplay.x,
        y: remoteDisplay.y,
      },
    };
  });
}

export async function getFloorConnectorLinkOptions(
  buildingId: string,
  floor: number,
  neighborCode?: string
) {
  const building = await getBuildingOrThrow(buildingId);
  const allBuildings = await prisma.mapBuilding.findMany({
    where: { code: { in: [...FACULTY_BUILDING_CODES] } },
    select: { id: true, code: true, name: true },
  });

  const connectableNeighbors = getNeighborBuildingCodes(building.code, floor)
    .filter((code) => isSameFloorLinkAllowed(building.code, code, floor))
    .map((code) => allBuildings.find((b) => b.code === code))
    .filter((b): b is NonNullable<typeof b> => !!b)
    .map((b) => ({ id: b.id, code: b.code, name: b.name }));

  const localNodes = await listConnectorNodesOnFloor(building.id, floor);

  const normalizedNeighbor = neighborCode?.toUpperCase();
  const selectedNeighbor = normalizedNeighbor
    ? allBuildings.find((b) => b.code === normalizedNeighbor)
    : undefined;

  let remoteNodes: (BuildingConnectorNode & { buildingCode: string })[] = [];
  let existingLinks: CrossBuildingEdgeRow[] = [];

  if (
    selectedNeighbor &&
    isSameFloorLinkAllowed(building.code, selectedNeighbor.code, floor)
  ) {
    const remote = await listConnectorNodesOnFloor(selectedNeighbor.id, floor);
    remoteNodes = remote.map((n) => ({ ...n, buildingCode: selectedNeighbor.code }));
    existingLinks = await listCrossBuildingEdgesOnFloor(
      building.id,
      selectedNeighbor.id,
      floor,
      selectedNeighbor.code
    );
  }

  return {
    building: { id: building.id, code: building.code, name: building.name },
    floor,
    connectableNeighbors,
    localNodes,
    remoteNodes,
    existingLinks,
    selectedNeighbor: selectedNeighbor
      ? { id: selectedNeighbor.id, code: selectedNeighbor.code, name: selectedNeighbor.name }
      : null,
  };
}

export async function autoPairBuildingFloorConnectors(_buildingId: string, _dryRun = false) {
  return { paired: 0, suggestions: 0, pairs: [] as FloorLinkSuggestion[] };
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
