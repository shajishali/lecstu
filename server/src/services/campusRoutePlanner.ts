import prisma from '../config/database';
import { findShortestPath, pathTotalWeight } from '../modules/indoor-navigation/pathfinding';
import {
  CROSS_BUILDING_EDGE_LABEL,
  inferDoorwayTargetBuilding,
} from '../constants/buildingConnections';
import { findBuildingPath } from '../constants/campusTopology';
import type { FacultyBuildingCode } from '../constants/facultyBuildings';
import { filterRoutingEdges, type RoutingGraphEdge } from './routingGraphFilter';
import { getBuildingOrThrow } from './indoorMarkerService';

export type CampusGraphNode = {
  id: string;
  buildingId: string;
  floor: number;
  type: string;
  label: string;
  x: number;
  y: number;
  mapMarkerId: string | null;
  mapMarkerMetadata?: unknown;
};

export function concatPathSegments(...segments: string[][]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg.length === 0) continue;
    if (out.length === 0) {
      out.push(...seg);
      continue;
    }
    const start = seg[0] === out[out.length - 1] ? 1 : 0;
    out.push(...seg.slice(start));
  }
  return out;
}

export function findDoorwayNavNodeId(
  nodes: CampusGraphNode[],
  buildingId: string,
  floor: number,
  targetBuildingCode: string,
  buildingCodeById: Map<string, string>
): string | null {
  for (const n of nodes) {
    if (n.buildingId !== buildingId || n.floor !== floor || !n.mapMarkerId) continue;
    if (n.type !== 'ENTRANCE' && n.type !== 'EXIT') continue;
    const hostCode = buildingCodeById.get(n.buildingId);
    if (!hostCode) continue;
    const target = inferDoorwayTargetBuilding(hostCode, n.label, n.mapMarkerMetadata);
    if (target === targetBuildingCode.toUpperCase()) return n.id;
  }
  return null;
}

function hasCrossEdge(
  edges: RoutingGraphEdge[],
  nodeA: string,
  nodeB: string
): boolean {
  return edges.some(
    (e) =>
      e.label === CROSS_BUILDING_EDGE_LABEL &&
      ((e.fromNodeId === nodeA && e.toNodeId === nodeB) ||
        (e.fromNodeId === nodeB && e.toNodeId === nodeA))
  );
}

/** Floors where every hop in the building path has a paired cross-building doorway link. */
export function getFeasibleTransferFloors(
  nodes: CampusGraphNode[],
  edges: RoutingGraphEdge[],
  buildingCodes: FacultyBuildingCode[],
  buildingCodeById: Map<string, string>,
  codeToBuildingId: Map<string, string>
): number[] {
  const floors = [...new Set(nodes.map((n) => n.floor))].sort((a, b) => a - b);
  const feasible: number[] = [];

  for (const floor of floors) {
    let ok = true;
    for (let i = 0; i < buildingCodes.length - 1; i++) {
      const fromCode = buildingCodes[i];
      const toCode = buildingCodes[i + 1];
      const fromBuildingId = codeToBuildingId.get(fromCode);
      const toBuildingId = codeToBuildingId.get(toCode);
      if (!fromBuildingId || !toBuildingId) {
        ok = false;
        break;
      }
      const fromDoor = findDoorwayNavNodeId(
        nodes,
        fromBuildingId,
        floor,
        toCode,
        buildingCodeById
      );
      const toDoor = findDoorwayNavNodeId(
        nodes,
        toBuildingId,
        floor,
        fromCode,
        buildingCodeById
      );
      if (!fromDoor || !toDoor || !hasCrossEdge(edges, fromDoor, toDoor)) {
        ok = false;
        break;
      }
    }
    if (ok) feasible.push(floor);
  }

  return feasible;
}

/**
 * Prefer crossing buildings on the destination floor; otherwise the linked floor closest
 * to the destination (e.g. F9 for a destination on F11 when F9 has doorway links).
 */
export function pickCampusTransferFloor(feasible: number[], destFloor: number): number {
  if (feasible.length === 0) return destFloor;
  if (feasible.includes(destFloor)) return destFloor;

  let best = feasible[0];
  let bestDist = Math.abs(best - destFloor);
  for (const f of feasible) {
    const d = Math.abs(f - destFloor);
    if (d < bestDist || (d === bestDist && f > best)) {
      best = f;
      bestDist = d;
    }
  }
  return best;
}

/** Pathfind inside one building (may use lifts/stairs between floors). */
export async function pathfindWithinBuilding(
  buildingId: string,
  fromNodeId: string,
  toNodeId: string
): Promise<string[] | null> {
  if (fromNodeId === toNodeId) return [fromNodeId];

  const building = await getBuildingOrThrow(buildingId);
  const graphNodes = await prisma.navNode.findMany({
    where: { buildingId },
    include: { mapMarker: { select: { metadata: true } } },
  });
  const routingNodes = graphNodes.map((n) => ({
    ...n,
    mapMarkerMetadata: n.mapMarker?.metadata,
  }));
  const buildingCodeById = new Map([[buildingId, building.code]]);
  const graphEdges = filterRoutingEdges(
    routingNodes,
    await prisma.navEdge.findMany({
      where: { fromNodeId: { in: routingNodes.map((n) => n.id) } },
    }),
    buildingCodeById
  );

  const result = findShortestPath(routingNodes, graphEdges, fromNodeId, toNodeId);
  return result?.pathNodeIds ?? null;
}

/**
 * Lift-first campus route: vertical to a shared transfer floor, horizontal building hops,
 * then vertical/walk to the destination in the final building.
 */
export async function buildPhasedCampusPath(options: {
  buildingCodes: FacultyBuildingCode[];
  nodes: CampusGraphNode[];
  startNodeId: string;
  goalNodeId: string;
  transferFloor: number;
  buildingCodeById: Map<string, string>;
  codeToBuildingId: Map<string, string>;
}): Promise<string[] | null> {
  const {
    buildingCodes,
    nodes,
    startNodeId,
    goalNodeId,
    transferFloor,
    buildingCodeById,
    codeToBuildingId,
  } = options;

  if (buildingCodes.length < 2) return null;

  const firstCode = buildingCodes[0];
  const firstBuildingId = codeToBuildingId.get(firstCode);
  const secondCode = buildingCodes[1];
  if (!firstBuildingId) return null;

  const entryDoor = findDoorwayNavNodeId(
    nodes,
    firstBuildingId,
    transferFloor,
    secondCode,
    buildingCodeById
  );
  if (!entryDoor) return null;

  const segments: string[][] = [];
  let currentId = startNodeId;

  if (currentId !== entryDoor) {
    const leg = await pathfindWithinBuilding(firstBuildingId, currentId, entryDoor);
    if (!leg) return null;
    segments.push(leg);
    currentId = entryDoor;
  }

  for (let i = 0; i < buildingCodes.length - 1; i++) {
    const fromCode = buildingCodes[i];
    const toCode = buildingCodes[i + 1];
    const fromBuildingId = codeToBuildingId.get(fromCode);
    const toBuildingId = codeToBuildingId.get(toCode);
    if (!fromBuildingId || !toBuildingId) return null;

    const fromDoor = findDoorwayNavNodeId(
      nodes,
      fromBuildingId,
      transferFloor,
      toCode,
      buildingCodeById
    );
    const toDoor = findDoorwayNavNodeId(
      nodes,
      toBuildingId,
      transferFloor,
      fromCode,
      buildingCodeById
    );
    if (!fromDoor || !toDoor) return null;

    if (currentId !== fromDoor) {
      const leg = await pathfindWithinBuilding(fromBuildingId, currentId, fromDoor);
      if (!leg) return null;
      segments.push(leg);
      currentId = fromDoor;
    }

    if (currentId !== toDoor) {
      segments.push([toDoor]);
      currentId = toDoor;
    }

    if (i + 1 < buildingCodes.length - 1) {
      const nextCode = buildingCodes[i + 2];
      const exitDoor = findDoorwayNavNodeId(
        nodes,
        toBuildingId,
        transferFloor,
        nextCode,
        buildingCodeById
      );
      if (!exitDoor) return null;
      if (currentId !== exitDoor) {
        const leg = await pathfindWithinBuilding(toBuildingId, currentId, exitDoor);
        if (!leg) return null;
        segments.push(leg);
        currentId = exitDoor;
      }
    }
  }

  const lastBuildingId = codeToBuildingId.get(buildingCodes[buildingCodes.length - 1]);
  if (!lastBuildingId) return null;

  if (currentId !== goalNodeId) {
    const leg = await pathfindWithinBuilding(lastBuildingId, currentId, goalNodeId);
    if (!leg) return null;
    segments.push(leg);
  }

  return concatPathSegments(...segments);
}

export function resolveBuildingPath(fromCode: string, toCode: string): FacultyBuildingCode[] | null {
  return findBuildingPath(fromCode, toCode);
}

export function estimatePhasedPathWeight(
  pathIds: string[],
  nodes: CampusGraphNode[],
  edges: RoutingGraphEdge[]
): number {
  return pathTotalWeight(pathIds, nodes, edges);
}
