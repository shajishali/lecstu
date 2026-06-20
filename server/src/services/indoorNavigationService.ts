import prisma from '../config/database';
import { findShortestPath, estimateRouteMetrics } from '../modules/indoor-navigation/pathfinding';
import { buildTurnByTurnSteps, type PathNodeLite, type TurnStep } from './turnByTurnSteps';

export { buildTurnByTurnSteps } from './turnByTurnSteps';
import { getFloorScale } from '../modules/indoor-navigation/repositories/nav-graph.repository';
import { AppError } from '../middleware/errorHandler';
import { MapMarkerType, NavNodeType } from '../generated/prisma/client';
import { isMarkerVisibleToStudents } from '../utils/markerMetadata';
import { getBuildingOrThrow, normalizeMarkerCoord } from './indoorMarkerService';
import { isValidFloorIndex } from './floorPlanStorage';
import { getStudentTodayOnCampus } from './studentTodayCampusService';
import { FACULTY_BUILDING_CODES } from '../constants/campusTopology';
import { filterRoutingEdges } from './routingGraphFilter';
import {
  buildPhasedCampusPath,
  estimatePhasedPathWeight,
  findDoorwayNavNodeId,
  getFeasibleTransferFloors,
  pathfindWithinBuilding,
  pickCampusTransferFloor,
  resolveBuildingPath,
} from './campusRoutePlanner';

const NODE_INCLUDE = {
  mapMarker: {
    select: {
      id: true,
      label: true,
      hallId: true,
      hall: { select: { id: true, name: true } },
    },
  },
} as const;

export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function normalizeCoord(value: number): number {
  return normalizeMarkerCoord(value);
}

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function markerTypeToNavType(type: MapMarkerType, label?: string): NavNodeType {
  if (type === 'ENTRANCE') return 'ENTRANCE';
  if (type === 'EXIT') return 'EXIT';
  if (type === 'STAIRS' || type === 'STAIRS_LIFT') return 'STAIRS';
  if (type === 'LIFT') return 'LIFT';
  const t = (label || '').trim();
  if (/entrance|main\s+lobby|reception/i.test(t)) return 'ENTRANCE';
  if (/stair/i.test(t)) return 'STAIRS';
  if (/lift|elevator/i.test(t)) return 'LIFT';
  return 'ROOM';
}

export async function getNavEditorContext(buildingId: string, floor: number) {
  const building = await getBuildingOrThrow(buildingId);
  if (!isValidFloorIndex(floor, building.floors)) {
    throw new AppError(`Invalid floor ${floor} for ${building.name}`, 400);
  }

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!floorPlan) {
    throw new AppError(
      `No floor plan for ${building.name} ${floor === 0 ? 'Ground' : `floor ${floor}`}. Upload in Admin → Buildings first.`,
      404
    );
  }

  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    include: NODE_INCLUDE,
    orderBy: [{ type: 'asc' }, { label: 'asc' }],
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

  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, type: true, x: true, y: true, hallId: true },
    orderBy: { label: 'asc' },
  });

  const linkedMarkerIds = new Set(
    nodes.map((n) => n.mapMarkerId).filter((id): id is string => !!id)
  );
  const markersWithoutNode = markers.filter((m) => !linkedMarkerIds.has(m.id));

  const halls = await prisma.lectureHall.findMany({
    where: { isActive: true },
    select: { id: true, name: true, building: true, floor: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  return {
    building: { id: building.id, name: building.name, code: building.code, floors: building.floors },
    floor,
    floorPlan: {
      id: floorPlan.id,
      imagePath: floorPlan.imagePath,
      lockedImagePath: floorPlan.lockedImagePath,
      bounds: floorPlan.bounds,
    },
    nodes,
    edges,
    markers,
    markersWithoutNode,
    halls,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      entranceCount: nodes.filter((n) => n.type === 'ENTRANCE').length,
    },
  };
}

export async function getNavGraphForFloor(buildingId: string, floor: number) {
  const ctx = await getNavEditorContext(buildingId, floor);
  return { nodes: ctx.nodes, edges: ctx.edges };
}

export async function createNavNode(input: {
  buildingId: string;
  floor: number;
  label: string;
  x: number;
  y: number;
  type: NavNodeType;
  mapMarkerId?: string | null;
}) {
  const building = await getBuildingOrThrow(input.buildingId);
  if (!isValidFloorIndex(input.floor, building.floors)) {
    throw new AppError(`Invalid floor ${input.floor}`, 400);
  }
  if (!input.label?.trim()) throw new AppError('label is required', 400);

  if (input.mapMarkerId) {
    const marker = await prisma.mapMarker.findUnique({ where: { id: input.mapMarkerId } });
    if (!marker || marker.buildingId !== input.buildingId) {
      throw new AppError('Invalid mapMarkerId for this building', 400);
    }
    const existing = await prisma.navNode.findUnique({ where: { mapMarkerId: input.mapMarkerId } });
    if (existing) throw new AppError('This marker already has a navigation node', 409);
  }

  return prisma.navNode.create({
    data: {
      buildingId: input.buildingId,
      floor: input.floor,
      label: input.label.trim(),
      x: normalizeCoord(input.x),
      y: normalizeCoord(input.y),
      type: input.type,
      mapMarkerId: input.mapMarkerId || null,
    },
    include: NODE_INCLUDE,
  });
}

export async function updateNavNode(
  id: string,
  data: Partial<{
    label: string;
    x: number;
    y: number;
    type: NavNodeType;
    mapMarkerId: string | null;
  }>
) {
  const existing = await prisma.navNode.findUnique({ where: { id } });
  if (!existing) throw new AppError('Navigation node not found', 404);

  if (data.mapMarkerId) {
    const marker = await prisma.mapMarker.findUnique({ where: { id: data.mapMarkerId } });
    if (!marker || marker.buildingId !== existing.buildingId) {
      throw new AppError('Invalid mapMarkerId', 400);
    }
    const taken = await prisma.navNode.findFirst({
      where: { mapMarkerId: data.mapMarkerId, NOT: { id } },
    });
    if (taken) throw new AppError('Marker already linked to another node', 409);
  }

  return prisma.navNode.update({
    where: { id },
    data: {
      ...(data.label !== undefined ? { label: data.label.trim() } : {}),
      ...(data.x !== undefined ? { x: normalizeCoord(data.x) } : {}),
      ...(data.y !== undefined ? { y: normalizeCoord(data.y) } : {}),
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.mapMarkerId !== undefined ? { mapMarkerId: data.mapMarkerId } : {}),
    },
    include: NODE_INCLUDE,
  });
}

export async function deleteNavNode(id: string) {
  const existing = await prisma.navNode.findUnique({ where: { id } });
  if (!existing) throw new AppError('Navigation node not found', 404);
  await prisma.navNode.delete({ where: { id } });
  return existing;
}

export async function createNavEdge(input: {
  fromNodeId: string;
  toNodeId: string;
  weight?: number | null;
  bidirectional?: boolean;
  label?: string | null;
}) {
  if (input.fromNodeId === input.toNodeId) {
    throw new AppError('Cannot connect a node to itself', 400);
  }
  const [from, to] = await Promise.all([
    prisma.navNode.findUnique({ where: { id: input.fromNodeId } }),
    prisma.navNode.findUnique({ where: { id: input.toNodeId } }),
  ]);
  if (!from || !to) throw new AppError('Both nodes must exist', 404);
  if (from.buildingId !== to.buildingId) {
    throw new AppError('Nodes must belong to the same building', 400);
  }

  const weight =
    input.weight != null && !Number.isNaN(Number(input.weight))
      ? Number(input.weight)
      : euclidean(from.x, from.y, to.x, to.y) + (from.floor !== to.floor ? 5 : 0);

  try {
    return await prisma.navEdge.create({
      data: {
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        weight,
        bidirectional: input.bidirectional !== false,
        label: input.label?.trim() || null,
      },
      include: {
        from: { select: { id: true, floor: true, label: true, type: true } },
        to: { select: { id: true, floor: true, label: true, type: true } },
      },
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') throw new AppError('This connection already exists', 409);
    throw err;
  }
}

export async function deleteNavEdge(id: string) {
  const edge = await prisma.navEdge.findUnique({ where: { id } });
  if (!edge) throw new AppError('Edge not found', 404);
  await prisma.navEdge.delete({ where: { id } });
  return edge;
}

/** Create/update ROOM nodes from map markers that lack nav nodes */
export async function syncNavNodesFromMarkers(buildingId: string, floor?: number) {
  await getBuildingOrThrow(buildingId);
  const where: { buildingId: string; floor?: number } = { buildingId };
  if (floor !== undefined) where.floor = floor;

  const markers = await prisma.mapMarker.findMany({ where });
  let created = 0;
  let updated = 0;

  for (const m of markers) {
    const existing = await prisma.navNode.findUnique({ where: { mapMarkerId: m.id } });
    if (!isMarkerVisibleToStudents(m.metadata)) {
      if (existing) {
        await prisma.navEdge.deleteMany({
          where: { OR: [{ fromNodeId: existing.id }, { toNodeId: existing.id }] },
        });
        await prisma.navNode.delete({ where: { id: existing.id } });
      }
      continue;
    }

    const navType = markerTypeToNavType(m.type, m.label);
    if (existing) {
      await prisma.navNode.update({
        where: { id: existing.id },
        data: {
          label: m.label,
          x: m.x,
          y: m.y,
          floor: m.floor,
          type: navType,
        },
      });
      updated++;
    } else {
      await prisma.navNode.create({
        data: {
          buildingId: m.buildingId,
          floor: m.floor,
          label: m.label,
          x: m.x,
          y: m.y,
          type: navType,
          mapMarkerId: m.id,
        },
      });
      created++;
    }
  }

  return { created, updated, total: markers.length };
}

type GraphNode = {
  id: string;
  buildingId: string;
  floor: number;
  label: string;
  x: number;
  y: number;
  type: NavNodeType;
  mapMarkerId: string | null;
};

type AdjEntry = { nodeId: string; weight: number; edgeLabel: string | null };

function buildAdjacency(
  nodes: GraphNode[],
  edges: { fromNodeId: string; toNodeId: string; weight: number | null; bidirectional: boolean; label: string | null }[]
): Map<string, AdjEntry[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, AdjEntry[]>();
  for (const n of nodes) adj.set(n.id, []);

  for (const e of edges) {
    const from = byId.get(e.fromNodeId);
    const to = byId.get(e.toNodeId);
    if (!from || !to) continue;
    const w =
      e.weight != null && !Number.isNaN(e.weight)
        ? e.weight
        : euclidean(from.x, from.y, to.x, to.y) + (from.floor !== to.floor ? 5 : 0);

    adj.get(e.fromNodeId)!.push({ nodeId: e.toNodeId, weight: w, edgeLabel: e.label });
    if (e.bidirectional) {
      adj.get(e.toNodeId)!.push({ nodeId: e.fromNodeId, weight: w, edgeLabel: e.label });
    }
  }
  return adj;
}

function reconstructPath(cameFrom: Map<string, string | null>, goalId: string): string[] {
  const path: string[] = [];
  let cur: string | null = goalId;
  while (cur) {
    path.unshift(cur);
    cur = cameFrom.get(cur) ?? null;
  }
  return path;
}

export function astar(
  nodes: GraphNode[],
  edges: { fromNodeId: string; toNodeId: string; weight: number | null; bidirectional: boolean; label: string | null }[],
  startId: string,
  goalId: string
): string[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(startId) || !byId.has(goalId)) return null;

  const adj = buildAdjacency(nodes, edges);
  const goal = byId.get(goalId)!;

  const open = new Set<string>([startId]);
  const cameFrom = new Map<string, string | null>();
  cameFrom.set(startId, null);

  const gScore = new Map<string, number>();
  gScore.set(startId, 0);

  const fScore = new Map<string, number>();
  const start = byId.get(startId)!;
  fScore.set(startId, euclidean(start.x, start.y, goal.x, goal.y));

  while (open.size > 0) {
    let current: string | null = null;
    let bestF = Infinity;
    for (const id of open) {
      const f = fScore.get(id) ?? Infinity;
      if (f < bestF) {
        bestF = f;
        current = id;
      }
    }
    if (!current) break;
    if (current === goalId) return reconstructPath(cameFrom, goalId);

    open.delete(current);
    const curNode = byId.get(current)!;
    const gCur = gScore.get(current) ?? Infinity;

    for (const neighbor of adj.get(current) || []) {
      const tentative = gCur + neighbor.weight;
      const gPrev = gScore.get(neighbor.nodeId) ?? Infinity;
      if (tentative >= gPrev) continue;
      cameFrom.set(neighbor.nodeId, current);
      gScore.set(neighbor.nodeId, tentative);
      const nb = byId.get(neighbor.nodeId)!;
      fScore.set(neighbor.nodeId, tentative + euclidean(nb.x, nb.y, goal.x, goal.y));
      open.add(neighbor.nodeId);
    }
  }
  return null;
}

export async function findDefaultStartNode(buildingId: string, preferredFloor?: number) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, type: 'ENTRANCE' },
    orderBy: [{ floor: 'asc' }, { label: 'asc' }],
  });
  if (nodes.length === 0) {
    const corridor = await prisma.navNode.findFirst({
      where: { buildingId, type: 'CORRIDOR' },
      orderBy: [{ floor: 'asc' }],
    });
    if (corridor) return corridor;
    throw new AppError(
      'No ENTRANCE navigation node. Add an entrance node or sync from room markers.',
      404
    );
  }
  if (preferredFloor !== undefined) {
    const onFloor = nodes.find((n) => n.floor === preferredFloor);
    if (onFloor) return onFloor;
  }
  const ground = nodes.find((n) => n.floor === 0);
  return ground || nodes[0];
}

async function nearestNodeToPoint(
  buildingId: string,
  floor: number,
  x: number,
  y: number
) {
  const floorNodes = await prisma.navNode.findMany({ where: { buildingId, floor } });
  if (floorNodes.length === 0) {
    throw new AppError('No navigation nodes on this floor. Draw paths in Admin → Walking paths.', 404);
  }
  let nearest = floorNodes[0];
  let best = euclidean(x, y, nearest.x, nearest.y);
  for (const n of floorNodes.slice(1)) {
    const d = euclidean(x, y, n.x, n.y);
    if (d < best) {
      best = d;
      nearest = n;
    }
  }
  return nearest;
}

export async function resolveGoalNodeForMarker(buildingId: string, markerId: string) {
  const marker = await prisma.mapMarker.findFirst({
    where: { id: markerId, buildingId },
  });
  if (!marker) throw new AppError('Room marker not found on this building', 404);

  const linked = await prisma.navNode.findFirst({
    where: { mapMarkerId: markerId },
    include: NODE_INCLUDE,
  });
  if (linked) return { node: linked, viaNearest: false, marker };

  const nearest = await nearestNodeToPoint(buildingId, marker.floor, marker.x, marker.y);
  return { node: nearest, viaNearest: true, marker };
}

export async function resolveGoalNodeForHall(buildingId: string, hallId: string) {
  const linked = await prisma.navNode.findFirst({
    where: {
      buildingId,
      mapMarker: { hallId },
    },
    include: NODE_INCLUDE,
  });
  if (linked) return { node: linked, viaNearest: false };

  const marker = await prisma.mapMarker.findFirst({
    where: { buildingId, hallId },
  });
  if (!marker) {
    throw new AppError('Hall has no map marker. Place it in Admin → Room map editor first.', 404);
  }

  const floorNodes = await prisma.navNode.findMany({ where: { buildingId, floor: marker.floor } });
  if (floorNodes.length === 0) {
    throw new AppError('No navigation nodes on this floor. Draw corridor paths in Admin → Walking paths.', 404);
  }

  let nearest = floorNodes[0];
  let best = euclidean(marker.x, marker.y, nearest.x, nearest.y);
  for (const n of floorNodes.slice(1)) {
    const d = euclidean(marker.x, marker.y, n.x, n.y);
    if (d < best) {
      best = d;
      nearest = n;
    }
  }
  return { node: nearest, viaNearest: true, marker };
}

export async function resolveGoalNodeForOffice(buildingId: string, officeId: string) {
  const office = await prisma.lecturerOffice.findUnique({ where: { id: officeId } });
  if (!office) throw new AppError('Office not found', 404);

  const marker = await prisma.mapMarker.findFirst({
    where: { officeId, buildingId },
  });
  if (!marker) {
    throw new AppError(
      'Office has no map marker on this building. Place it in Admin → Room map editor first.',
      404
    );
  }

  return resolveGoalNodeForMarker(buildingId, marker.id);
}

function filterSameFloorSubgraph<
  T extends { id: string; buildingId: string; floor: number },
  E extends { fromNodeId: string; toNodeId: string },
>(nodes: T[], edges: E[], buildingId: string, floor: number): { nodes: T[]; edges: E[] } {
  const nodeIds = new Set(
    nodes.filter((n) => n.buildingId === buildingId && n.floor === floor).map((n) => n.id)
  );
  return {
    nodes: nodes.filter((n) => nodeIds.has(n.id)),
    edges: edges.filter((e) => nodeIds.has(e.fromNodeId) && nodeIds.has(e.toNodeId)),
  };
}

function buildSameRoomRouteResult(
  building: { id: string; name: string; code: string },
  start: { id: string; label: string; floor: number; x: number; y: number; type: NavNodeType },
  goalResult: { node: { id: string }; marker?: { id: string; label: string; floor: number } | null },
  destinationLabel: string
) {
  const destLabel = destinationLabel || goalResult.marker?.label || start.label;
  const step = { instruction: `You are already at ${destLabel}`, floor: start.floor, polylineIndex: 0 };
  return {
    found: true as const,
    alreadyHere: true as const,
    message: `You are already at ${destLabel}`,
    building: { id: building.id, name: building.name, code: building.code },
    destinationLabel: destLabel,
    startLabel: start.label,
    startFloor: start.floor,
    marker: goalResult.marker
      ? { id: goalResult.marker.id, label: goalResult.marker.label, floor: goalResult.marker.floor }
      : null,
    startNodeId: start.id,
    goalNodeId: goalResult.node.id,
    pathNodeIds: [start.id],
    polyline: [
      {
        x: start.x,
        y: start.y,
        floor: start.floor,
        nodeId: start.id,
        label: start.label,
        type: start.type,
      },
    ],
    steps: [step.instruction],
    stepDetails: [step],
    distance: 0,
    distanceMeters: 0,
    estimatedMinutes: 0,
    pathfindingAlgorithm: 'same-room' as const,
  };
}

async function runPathfinding(
  buildingId: string,
  goalResult: Awaited<ReturnType<typeof resolveGoalNodeForHall>>,
  fromNodeId?: string,
  destinationLabel?: string
) {
  const building = await getBuildingOrThrow(buildingId);
  const start =
    fromNodeId != null
      ? await prisma.navNode.findUnique({ where: { id: fromNodeId } })
      : await findDefaultStartNode(buildingId, goalResult.marker?.floor);
  if (!start) throw new AppError('Start node not found', 404);
  if (start.buildingId !== building.id) throw new AppError('Start node is not in this building', 400);

  const goal = goalResult.node;

  if (start.id === goal.id) {
    const destLabel =
      destinationLabel ||
      goalResult.marker?.label ||
      start.label ||
      'destination';
    return buildSameRoomRouteResult(building, start, goalResult, destLabel);
  }

  let graphNodes = await prisma.navNode.findMany({ where: { buildingId } });
  const buildingCodeById = new Map<string, string>([[buildingId, building.code]]);

  let graphEdges = await prisma.navEdge.findMany({
    where: { fromNodeId: { in: graphNodes.map((n) => n.id) } },
  });
  graphEdges = filterRoutingEdges(graphNodes, graphEdges, buildingCodeById);

  if (start.floor === goal.floor) {
    const subgraph = filterSameFloorSubgraph(graphNodes, graphEdges, buildingId, start.floor);
    graphNodes = subgraph.nodes;
    graphEdges = subgraph.edges;
  }

  const pathResult = findShortestPath(graphNodes, graphEdges, start.id, goal.id);

  const pathIds = pathResult?.pathNodeIds ?? null;
  const pathfindingAlgorithm = pathResult?.algorithm;

  if (!pathIds) {
    return {
      found: false as const,
      building: { id: building.id, name: building.name, code: building.code },
      message:
        'No path found. In Admin → Buildings click **AI** on this floor, or connect nodes in **Walking paths**.',
    };
  }

  const byId = new Map(graphNodes.map((n) => [n.id, n]));
  const pathNodes = pathIds.map((id) => byId.get(id)!).filter(Boolean);
  let totalDistance = pathResult?.totalWeight ?? 0;
  if (totalDistance === 0) {
    for (let i = 1; i < pathNodes.length; i++) {
      const prev = pathNodes[i - 1];
      const cur = pathNodes[i];
      totalDistance += euclidean(prev.x, prev.y, cur.x, cur.y);
    }
  }

  const destFloorForScale =
    goalResult.marker?.floor ?? pathNodes[pathNodes.length - 1]?.floor ?? 0;
  const scale = await getFloorScale(buildingId, destFloorForScale);
  const routeMetrics = estimateRouteMetrics(totalDistance, scale);

  const polyline = pathNodes.map((n) => ({
    x: n.x,
    y: n.y,
    floor: n.floor,
    nodeId: n.id,
    label: n.label,
    type: n.type,
  }));

  const destLabel =
    destinationLabel ||
    goalResult.marker?.label ||
    pathNodes[pathNodes.length - 1]?.label ||
    'destination';

  if (goalResult.viaNearest && goalResult.marker) {
    polyline.push({
      x: goalResult.marker.x,
      y: goalResult.marker.y,
      floor: goalResult.marker.floor,
      nodeId: '',
      label: goalResult.marker.label,
      type: 'ROOM' as NavNodeType,
    });
    totalDistance += euclidean(
      goal.x,
      goal.y,
      goalResult.marker.x,
      goalResult.marker.y
    );
  }

  const stepRows = buildTurnByTurnSteps(
    pathNodes,
    destLabel,
    goalResult.viaNearest && goalResult.marker
      ? { label: goalResult.marker.label, floor: goalResult.marker.floor }
      : undefined
  );
  const steps = stepRows.map((s) => s.instruction);

  return {
    found: true as const,
    building: { id: building.id, name: building.name, code: building.code },
    destinationLabel: destLabel,
    startLabel: start.label,
    startFloor: start.floor,
    marker: goalResult.marker
      ? { id: goalResult.marker.id, label: goalResult.marker.label, floor: goalResult.marker.floor }
      : null,
    startNodeId: start.id,
    goalNodeId: goal.id,
    pathNodeIds: pathIds,
    polyline,
    steps,
    stepDetails: stepRows,
    distance: Math.round(totalDistance * 10) / 10,
    distanceMeters: routeMetrics.distanceMeters,
    estimatedMinutes: routeMetrics.estimatedMinutes,
    pathfindingAlgorithm,
  };
}

export async function computeIndoorRoute(options: {
  buildingId: string;
  toHallId: string;
  fromNodeId?: string;
}) {
  const goalResult = await resolveGoalNodeForHall(options.buildingId, options.toHallId);
  const result = await runPathfinding(
    options.buildingId,
    goalResult,
    options.fromNodeId
  );
  if (!result.found) return result;

  const hall = await prisma.lectureHall.findUnique({
    where: { id: options.toHallId },
    select: { id: true, name: true, building: true, floor: true },
  });

  return { ...result, hall };
}

export async function computeIndoorRouteToMarker(options: {
  buildingId: string;
  toMarkerId: string;
  fromNodeId?: string;
}) {
  const goalResult = await resolveGoalNodeForMarker(options.buildingId, options.toMarkerId);
  const result = await runPathfinding(
    options.buildingId,
    goalResult,
    options.fromNodeId,
    goalResult.marker?.label
  );
  return result;
}

export async function computeIndoorRouteToOffice(options: {
  buildingId: string;
  toOfficeId: string;
  fromNodeId?: string;
}) {
  const goalResult = await resolveGoalNodeForOffice(options.buildingId, options.toOfficeId);
  const office = await prisma.lecturerOffice.findUnique({
    where: { id: options.toOfficeId },
    select: { id: true, roomNumber: true, building: true, floor: true },
  });
  const result = await runPathfinding(
    options.buildingId,
    goalResult,
    options.fromNodeId,
    goalResult.marker?.label ?? `Office ${office?.roomNumber ?? ''}`.trim()
  );
  if (!result.found) return result;
  return {
    ...result,
    office: office
      ? { id: office.id, roomNumber: office.roomNumber, building: office.building, floor: office.floor }
      : null,
  };
}

/** Resolve destination from search text; optional building/floor hints */
export async function resolveIndoorDestinationFromQuery(
  q: string,
  hints?: { buildingId?: string; floor?: number }
) {
  const trimmed = q.trim();
  if (trimmed.length < 2) throw new AppError('Search term too short', 400);

  const { searchMapEntities, parseNavigationQuery } = await import('./mapSearchService');
  const parsed = parseNavigationQuery(trimmed);
  const queries = [...parsed.roomTerms, trimmed].filter((t, i, arr) => t.length >= 2 && arr.indexOf(t) === i);

  for (const searchQ of queries) {
    const results = await searchMapEntities(searchQ);
    const { pickBestMapSearchResult } = await import('./mapSearchService');
    const room = pickBestMapSearchResult(searchQ, results);
    if (!room?.buildingId) continue;
    if (hints?.buildingId && room.buildingId !== hints.buildingId) continue;
    if (hints?.floor !== undefined && room.floor !== hints.floor) continue;

    const building = await prisma.mapBuilding.findUnique({
      where: { id: room.buildingId },
      select: { id: true, name: true, code: true },
    });
    if (!building) continue;

    return {
      buildingId: room.buildingId,
      toMarkerId: room.markerId,
      toHallId: room.hallId,
      toOfficeId: room.kind === 'office' ? room.id : undefined,
      label: room.label,
      floor: room.floor ?? 0,
      buildingName: building.name,
    };
  }

  const term = parsed.roomTerms[0] || trimmed;
  throw new AppError(
    `Could not find "${term}" on the map. Place the room in Admin → Room map editor, then draw walking paths.`,
    404
  );
}

async function resolveStartNodeId(
  buildingId: string,
  fromNodeId?: string,
  fromMarkerId?: string
): Promise<string | undefined> {
  if (fromNodeId) return fromNodeId;
  if (!fromMarkerId) return undefined;
  const start = await resolveGoalNodeForMarker(buildingId, fromMarkerId);
  return start.node.id;
}

async function resolveFromMarker(fromMarkerId: string) {
  const marker = await prisma.mapMarker.findUnique({ where: { id: fromMarkerId } });
  if (!marker) throw new AppError('Start place not found', 404);
  const resolved = await resolveGoalNodeForMarker(marker.buildingId, fromMarkerId);
  return {
    buildingId: marker.buildingId,
    nodeId: resolved.node.id,
    marker,
    label: marker.label,
    floor: marker.floor,
  };
}

async function loadFacultyCampusGraph() {
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: [...FACULTY_BUILDING_CODES] } },
    select: { id: true, name: true, code: true },
  });
  const buildingIds = buildings.map((b) => b.id);
  const buildingById = new Map(buildings.map((b) => [b.id, b]));
  const buildingCodeById = new Map(buildings.map((b) => [b.id, b.code]));

  const nodes = await prisma.navNode.findMany({
    where: { buildingId: { in: buildingIds } },
    include: { mapMarker: { select: { metadata: true } } },
  });
  const routingNodes = nodes.map((n) => ({
    ...n,
    mapMarkerMetadata: n.mapMarker?.metadata,
  }));
  const nodeIds = routingNodes.map((n) => n.id);
  const allEdges = await prisma.navEdge.findMany({
    where: {
      fromNodeId: { in: nodeIds },
      toNodeId: { in: nodeIds },
    },
  });
  const edges = filterRoutingEdges(routingNodes, allEdges, buildingCodeById);

  return { nodes: routingNodes, edges, buildingById };
}

/** Admin-configured horizontal links are used as-is — no auto-pair during student routing. */
async function ensureCampusConnectors(_fromBuildingId: string, _toBuildingId: string) {
  /* no-op */
}

type CampusGraphNode = Awaited<ReturnType<typeof loadFacultyCampusGraph>>['nodes'][number];

/** Walk through corridor graph inside a transit building when campus routing only hops doorways. */
async function expandTransitBuildingPaths(
  pathNodeIds: string[],
  nodes: CampusGraphNode[],
  buildingCodeById: Map<string, string>
): Promise<string[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const runs: { buildingId: string; ids: string[] }[] = [];

  for (const id of pathNodeIds) {
    const n = byId.get(id);
    if (!n) continue;
    const last = runs[runs.length - 1];
    if (last?.buildingId === n.buildingId) last.ids.push(id);
    else runs.push({ buildingId: n.buildingId, ids: [id] });
  }

  const out: string[] = [];
  for (let r = 0; r < runs.length; r++) {
    const run = runs[r];
    const isMiddle = r > 0 && r < runs.length - 1;
    if (isMiddle && run.ids.length === 1) {
      const entryId = run.ids[0];
      const entry = byId.get(entryId);
      const nextBuildingId = runs[r + 1].buildingId;
      const nextCode = buildingCodeById.get(nextBuildingId);
      const hostCode = buildingCodeById.get(run.buildingId);
      if (entry && nextCode && hostCode) {
        const exitId = findDoorwayNavNodeId(
          nodes,
          run.buildingId,
          entry.floor,
          nextCode,
          buildingCodeById
        );
        if (exitId && exitId !== entryId) {
          const interior = await pathfindWithinBuilding(run.buildingId, entryId, exitId);
          if (interior && interior.length >= 2) {
            out.push(...interior);
            continue;
          }
        }
      }
    }
    out.push(...run.ids);
  }
  return out;
}

function buildCampusRouteLegs(
  pathNodeLite: PathNodeLite[],
  pathNodeIds: string[],
  stepRows: TurnStep[],
  polyline: RoutePolylinePoint[],
  buildingById: Map<string, { id: string; name: string; code: string }>
): CampusRouteLeg[] {
  if (pathNodeLite.length === 0) return [];

  const legs: CampusRouteLeg[] = [];
  let legStart = 0;

  const pushLeg = (endExclusive: number) => {
    if (endExclusive <= legStart) return;
    const nodes = pathNodeLite.slice(legStart, endExclusive);
    const ids = pathNodeIds.slice(legStart, endExclusive);
    const buildingId = nodes[0].buildingId!;
    const building = buildingById.get(buildingId);
    const legPoly = polyline.slice(legStart, Math.min(endExclusive, polyline.length));
    const legSteps: RouteStep[] = stepRows.filter(
      (s) => s.polylineIndex >= legStart && s.polylineIndex < endExclusive
    );
    legs.push({
      buildingId,
      buildingCode: building?.code ?? nodes[0].buildingCode ?? '',
      buildingName: building?.name ?? nodes[0].buildingName ?? '',
      pathNodeIds: ids,
      polyline: legPoly,
      segments: polylineToSegments(buildingId, legPoly),
      steps: legSteps,
    });
    legStart = endExclusive;
  };

  for (let i = 1; i < pathNodeLite.length; i++) {
    const prev = pathNodeLite[i - 1];
    const cur = pathNodeLite[i];
    if (prev.buildingCode && cur.buildingCode && prev.buildingCode !== cur.buildingCode) {
      pushLeg(i);
    }
  }
  pushLeg(pathNodeLite.length);

  if (polyline.length > pathNodeLite.length && legs.length > 0) {
    const tail = polyline.slice(pathNodeLite.length);
    const last = legs[legs.length - 1];
    last.polyline = [...last.polyline, ...tail];
    last.segments = polylineToSegments(last.buildingId, last.polyline);
  }

  return legs;
}

async function computeCampusIndoorRoute(options: {
  fromBuildingId: string;
  toBuildingId: string;
  fromNodeId?: string;
  fromFloor?: number;
  toMarkerId?: string;
  toHallId?: string;
  fromMarker?: { id: string; label: string; floor: number } | null;
}) {
  const [fromBuilding, toBuilding] = await Promise.all([
    getBuildingOrThrow(options.fromBuildingId),
    getBuildingOrThrow(options.toBuildingId),
  ]);

  await ensureCampusConnectors(options.fromBuildingId, options.toBuildingId);

  let goalResult: Awaited<ReturnType<typeof resolveGoalNodeForMarker>>;
  if (options.toMarkerId) {
    goalResult = await resolveGoalNodeForMarker(options.toBuildingId, options.toMarkerId);
  } else if (options.toHallId) {
    goalResult = await resolveGoalNodeForHall(options.toBuildingId, options.toHallId);
  } else {
    throw new AppError('Provide toMarkerId or toHallId for campus routing', 400);
  }

  let startNode =
    options.fromNodeId != null
      ? await prisma.navNode.findUnique({ where: { id: options.fromNodeId } })
      : await findDefaultStartNode(options.fromBuildingId, options.fromFloor ?? goalResult.marker?.floor);

  if (!startNode) throw new AppError('Start node not found', 404);
  if (startNode.buildingId !== options.fromBuildingId) {
    throw new AppError('Start node is not in the from building', 400);
  }

  const { nodes, edges, buildingById } = await loadFacultyCampusGraph();
  const buildingCodeById = new Map([...buildingById.entries()].map(([id, b]) => [id, b.code]));
  const codeToBuildingId = new Map([...buildingById.entries()].map(([id, b]) => [b.code, id]));

  const buildingCodes = resolveBuildingPath(fromBuilding.code, toBuilding.code);
  const destFloor = goalResult.marker?.floor ?? goalResult.node.floor;
  let expandedPathIds: string[] | null = null;
  let pathfindingAlgorithm: 'phased-campus' | 'astar' | 'dijkstra' = 'phased-campus';

  if (buildingCodes && buildingCodes.length >= 2) {
    const feasibleFloors = getFeasibleTransferFloors(
      nodes,
      edges,
      buildingCodes,
      buildingCodeById,
      codeToBuildingId
    );
    if (feasibleFloors.length > 0) {
      const transferFloor = pickCampusTransferFloor(feasibleFloors, destFloor);
      expandedPathIds = await buildPhasedCampusPath({
        buildingCodes,
        nodes,
        startNodeId: startNode.id,
        goalNodeId: goalResult.node.id,
        transferFloor,
        buildingCodeById,
        codeToBuildingId,
      });
    }
  }

  if (!expandedPathIds) {
    const pathResult = findShortestPath(nodes, edges, startNode.id, goalResult.node.id);
    if (!pathResult?.pathNodeIds) {
      return {
        found: false as const,
        building: { id: toBuilding.id, name: toBuilding.name, code: toBuilding.code },
        fromBuilding: { id: fromBuilding.id, name: fromBuilding.name, code: fromBuilding.code },
        message:
          'No cross-building path found. Pair ADMIN↔ACAD and ADMIN↔LAB doorway links on the same floor in Admin → Building links, and connect stairs/lift between floors where needed.',
      };
    }
    expandedPathIds = await expandTransitBuildingPaths(
      pathResult.pathNodeIds,
      nodes,
      buildingCodeById
    );
    pathfindingAlgorithm = pathResult.algorithm;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pathNodes = expandedPathIds.map((id) => byId.get(id)!).filter(Boolean);
  let totalDistance =
    pathfindingAlgorithm === 'phased-campus'
      ? estimatePhasedPathWeight(expandedPathIds, nodes, edges)
      : 0;
  if (totalDistance === 0) {
    for (let i = 1; i < pathNodes.length; i++) {
      const prev = pathNodes[i - 1];
      const cur = pathNodes[i];
      totalDistance += euclidean(prev.x, prev.y, cur.x, cur.y);
    }
  }

  const destFloorForScale =
    goalResult.marker?.floor ?? pathNodes[pathNodes.length - 1]?.floor ?? 0;
  const scale = await getFloorScale(options.toBuildingId, destFloorForScale);
  const routeMetrics = estimateRouteMetrics(totalDistance, scale);

  const pathNodeLite: PathNodeLite[] = pathNodes.map((n) => {
    const b = buildingById.get(n.buildingId);
    return {
      label: n.label,
      x: n.x,
      y: n.y,
      floor: n.floor,
      type: n.type,
      mapMarkerId: n.mapMarkerId,
      buildingId: n.buildingId,
      buildingName: b?.name,
      buildingCode: b?.code,
    };
  });

  const polyline = pathNodeLite.map((n) => ({
    x: n.x,
    y: n.y,
    floor: n.floor,
    buildingId: n.buildingId,
    label: n.label,
    type: n.type,
  }));

  if (goalResult.viaNearest && goalResult.marker) {
    polyline.push({
      x: goalResult.marker.x,
      y: goalResult.marker.y,
      floor: goalResult.marker.floor,
      buildingId: options.toBuildingId,
      label: goalResult.marker.label,
      type: 'ROOM' as NavNodeType,
    });
    const last = pathNodes[pathNodes.length - 1];
    totalDistance += euclidean(last.x, last.y, goalResult.marker.x, goalResult.marker.y);
  }

  const destLabel = goalResult.marker?.label || pathNodes[pathNodes.length - 1]?.label || 'destination';
  const stepRows = buildTurnByTurnSteps(
    pathNodeLite,
    destLabel,
    goalResult.viaNearest && goalResult.marker
      ? { label: goalResult.marker.label, floor: goalResult.marker.floor }
      : undefined
  );

  const buildingPath =
    buildingCodes && buildingCodes.length >= 2
      ? buildingCodes
      : ([...new Set(pathNodeLite.map((n) => n.buildingCode).filter(Boolean))] as string[]);
  const crossBuilding = buildingPath.length > 1;
  const legs =
    crossBuilding
      ? buildCampusRouteLegs(
          pathNodeLite,
          expandedPathIds,
          stepRows,
          polyline,
          buildingById
        )
      : [];

  return {
    found: true as const,
    crossBuilding,
    buildingPath,
    legs,
    building: { id: toBuilding.id, name: toBuilding.name, code: toBuilding.code },
    fromBuilding: { id: fromBuilding.id, name: fromBuilding.name, code: fromBuilding.code },
    destinationLabel: destLabel,
    startLabel: options.fromMarker?.label ?? startNode.label,
    startFloor: options.fromMarker?.floor ?? startNode.floor,
    marker: goalResult.marker
      ? { id: goalResult.marker.id, label: goalResult.marker.label, floor: goalResult.marker.floor }
      : null,
    startNodeId: startNode.id,
    goalNodeId: goalResult.node.id,
    pathNodeIds: expandedPathIds,
    polyline,
    steps: stepRows.map((s) => s.instruction),
    stepDetails: stepRows,
    distance: Math.round(totalDistance * 10) / 10,
    distanceMeters: routeMetrics.distanceMeters,
    estimatedMinutes: routeMetrics.estimatedMinutes,
    pathfindingAlgorithm,
  };
}

async function resolveFromOffice(fromOfficeId: string) {
  const office = await prisma.lecturerOffice.findUnique({ where: { id: fromOfficeId } });
  if (!office) throw new AppError('Start office not found', 404);
  const marker = await prisma.mapMarker.findFirst({ where: { officeId: fromOfficeId } });
  if (!marker) throw new AppError('Start office has no map marker', 404);
  const resolved = await resolveGoalNodeForMarker(marker.buildingId, marker.id);
  return {
    buildingId: marker.buildingId,
    nodeId: resolved.node.id,
    marker,
    label: marker.label,
    floor: marker.floor,
  };
}

export async function computeIndoorRouteFlexible(options: {
  buildingId?: string;
  fromBuildingId?: string;
  toBuildingId?: string;
  toHallId?: string;
  toMarkerId?: string;
  toOfficeId?: string;
  q?: string;
  floor?: number;
  fromFloor?: number;
  fromNodeId?: string;
  fromMarkerId?: string;
  fromOfficeId?: string;
}) {
  let destBuildingId = options.toBuildingId || options.buildingId;
  let toHallId = options.toHallId;
  let toMarkerId = options.toMarkerId;
  let toOfficeId = options.toOfficeId;

  if (!toHallId && !toMarkerId && !toOfficeId && options.q) {
    const resolved = await resolveIndoorDestinationFromQuery(options.q, {
      buildingId: destBuildingId,
      floor: options.floor,
    });
    destBuildingId = resolved.buildingId;
    toHallId = resolved.toHallId;
    toMarkerId = resolved.toMarkerId;
    toOfficeId = resolved.toOfficeId;
  }

  if (!destBuildingId) throw new AppError('buildingId is required', 400);

  let fromBuildingId = options.fromBuildingId;
  let fromNodeId = options.fromNodeId;
  let fromMarker: { id: string; label: string; floor: number } | null = null;

  if (options.fromOfficeId) {
    const from = await resolveFromOffice(options.fromOfficeId);
    fromBuildingId = from.buildingId;
    fromNodeId = from.nodeId;
    fromMarker = { id: from.marker.id, label: from.label, floor: from.floor };
  } else if (options.fromMarkerId) {
    const from = await resolveFromMarker(options.fromMarkerId);
    fromBuildingId = from.buildingId;
    fromNodeId = from.nodeId;
    fromMarker = { id: from.marker.id, label: from.label, floor: from.floor };
  } else if (!fromNodeId) {
    const startBuildingId = fromBuildingId || destBuildingId;
    const start = await findDefaultStartNode(startBuildingId, options.fromFloor);
    fromNodeId = start.id;
    if (!fromBuildingId) fromBuildingId = startBuildingId;
  }

  if (fromBuildingId && fromBuildingId !== destBuildingId) {
    return computeCampusIndoorRoute({
      fromBuildingId,
      toBuildingId: destBuildingId,
      fromNodeId,
      fromFloor: options.fromFloor,
      toMarkerId,
      toHallId,
      fromMarker,
    });
  }

  const effectiveFromNodeId = await resolveStartNodeId(
    destBuildingId,
    fromNodeId,
    fromBuildingId === destBuildingId ? options.fromMarkerId : undefined
  );

  if (toMarkerId) {
    return computeIndoorRouteToMarker({
      buildingId: destBuildingId,
      toMarkerId,
      fromNodeId: effectiveFromNodeId,
    });
  }
  if (toOfficeId) {
    return computeIndoorRouteToOffice({
      buildingId: destBuildingId,
      toOfficeId,
      fromNodeId: effectiveFromNodeId,
    });
  }
  if (toHallId) {
    return computeIndoorRoute({ buildingId: destBuildingId, toHallId, fromNodeId: effectiveFromNodeId });
  }

  throw new AppError('Provide toHallId, toMarkerId, toOfficeId, or q (room name)', 400);
}

export type RoutePolylinePoint = {
  x: number;
  y: number;
  floor: number;
  buildingId?: string;
  nodeId?: string;
  label?: string;
};

export type RouteSegment = {
  buildingId: string;
  floor: number;
  polyline: [number, number][];
};

export type RouteStep = { instruction: string; floor: number; polylineIndex?: number };

export type CampusRouteLeg = {
  buildingId: string;
  buildingCode: string;
  buildingName: string;
  pathNodeIds: string[];
  polyline: RoutePolylinePoint[];
  segments: RouteSegment[];
  steps: RouteStep[];
};

export const INDOOR_ROUTE_ADMIN_FIX = {
  roomMarkers: '/admin/indoor-markers',
  walkingPaths: '/admin/indoor-nav',
  buildings: '/admin/buildings',
} as const;

export function buildGuideDeepLink(params: {
  buildingId: string;
  floor: number;
  hallId?: string | null;
  markerId?: string | null;
  destination?: string;
  today?: boolean;
  leg?: number;
}): string {
  const q = new URLSearchParams({
    buildingId: params.buildingId,
    floor: String(params.floor),
  });
  if (params.hallId) q.set('hallId', params.hallId);
  if (params.markerId) q.set('markerId', params.markerId);
  if (params.destination) q.set('destination', params.destination);
  if (params.today) q.set('today', '1');
  if (params.leg !== undefined) q.set('leg', String(params.leg));
  if (params.today) {
    return `/navigate?${q.toString()}`;
  }
  const nav = new URLSearchParams({ buildingId: params.buildingId });
  if (params.floor !== undefined) nav.set('floor', String(params.floor));
  if (params.hallId) nav.set('hallId', params.hallId);
  if (params.markerId) nav.set('markerId', params.markerId);
  const label = params.destination;
  if (label) nav.set('q', label);
  return `/navigate?${nav.toString()}`;
}

export function polylineToSegments(
  buildingId: string,
  polyline: RoutePolylinePoint[]
): RouteSegment[];
export function polylineToSegments(
  polyline: Array<RoutePolylinePoint & { buildingId?: string }>
): RouteSegment[];
export function polylineToSegments(
  buildingIdOrPolyline: string | Array<RoutePolylinePoint & { buildingId?: string }>,
  polylineArg?: RoutePolylinePoint[]
): RouteSegment[] {
  const polyline = Array.isArray(buildingIdOrPolyline)
    ? buildingIdOrPolyline
    : polylineArg ?? [];
  const defaultBuildingId = typeof buildingIdOrPolyline === 'string' ? buildingIdOrPolyline : undefined;

  if (polyline.length === 0) return [];

  const segments: RouteSegment[] = [];
  let buildingId = polyline[0].buildingId ?? defaultBuildingId ?? '';
  let floor = polyline[0].floor;
  let pts: [number, number][] = [[polyline[0].x, polyline[0].y]];

  for (let i = 1; i < polyline.length; i++) {
    const p = polyline[i];
    const pBuildingId = p.buildingId ?? defaultBuildingId ?? buildingId;
    if (p.floor !== floor || pBuildingId !== buildingId) {
      segments.push({ buildingId, floor, polyline: pts });
      buildingId = pBuildingId;
      floor = p.floor;
      pts = [[p.x, p.y]];
    } else {
      pts.push([p.x, p.y]);
    }
  }
  segments.push({ buildingId, floor, polyline: pts });
  return segments;
}

type RawRouteResult = Awaited<ReturnType<typeof computeIndoorRouteFlexible>> & {
  hall?: { id: string; name: string; building: string; floor: number } | null;
};

export function formatIndoorRouteResponse(raw: RawRouteResult) {
  if (!raw.found) {
    return {
      found: false as const,
      message: raw.message,
      building: raw.building,
      steps: [] as RouteStep[],
      segments: [] as RouteSegment[],
      deepLink: null as string | null,
      adminFix: INDOOR_ROUTE_ADMIN_FIX,
    };
  }

  const polyline = raw.polyline as RoutePolylinePoint[];
  const hasBuildingIds = polyline.some((p) => 'buildingId' in p && (p as { buildingId?: string }).buildingId);
  const segments = hasBuildingIds
    ? polylineToSegments(polyline as Array<RoutePolylinePoint & { buildingId?: string }>)
    : polylineToSegments(raw.building.id, polyline);
  const steps: RouteStep[] =
    raw.stepDetails?.length > 0
      ? raw.stepDetails
      : (raw.steps || []).map((instruction) => ({
          instruction,
          floor: polyline[polyline.length - 1]?.floor ?? 0,
        }));

  const destFloor =
    raw.marker?.floor ?? raw.hall?.floor ?? segments[segments.length - 1]?.floor ?? 0;

  const deepLink = buildGuideDeepLink({
    buildingId: raw.building.id,
    floor: destFloor,
    hallId: raw.hall?.id ?? null,
    markerId: raw.marker?.id ?? null,
    destination: raw.destinationLabel,
  });

  return {
    found: true as const,
    building: raw.building,
    destinationLabel: raw.destinationLabel,
    startLabel: 'startLabel' in raw ? (raw as { startLabel?: string }).startLabel : undefined,
    startFloor: 'startFloor' in raw ? (raw as { startFloor?: number }).startFloor : undefined,
    hall: raw.hall ?? null,
    marker: raw.marker ?? null,
    startNodeId: raw.startNodeId,
    goalNodeId: raw.goalNodeId,
    polyline,
    steps,
    stepDetails: steps,
    segments,
    deepLink,
    distance: raw.distance,
    distanceMeters: 'distanceMeters' in raw ? (raw as { distanceMeters?: number }).distanceMeters : undefined,
    estimatedMinutes: 'estimatedMinutes' in raw ? (raw as { estimatedMinutes?: number }).estimatedMinutes : undefined,
    pathfindingAlgorithm: 'pathfindingAlgorithm' in raw ? (raw as { pathfindingAlgorithm?: string }).pathfindingAlgorithm : undefined,
    alreadyHere: 'alreadyHere' in raw ? (raw as { alreadyHere?: boolean }).alreadyHere : false,
    message: 'message' in raw ? (raw as { message?: string }).message : undefined,
    pathNodeIds: raw.pathNodeIds,
    crossBuilding: 'crossBuilding' in raw ? (raw as { crossBuilding?: boolean }).crossBuilding : false,
    buildingPath: 'buildingPath' in raw ? (raw as { buildingPath?: string[] }).buildingPath : [raw.building.code],
    legs: 'legs' in raw ? (raw as { legs?: CampusRouteLeg[] }).legs : undefined,
    fromBuilding: 'fromBuilding' in raw ? (raw as { fromBuilding?: { id: string; name: string; code: string } }).fromBuilding : undefined,
    adminFix: null,
  };
}

export async function computeTodayIndoorRoutes(studentId: string) {
  const today = await getStudentTodayOnCampus(studentId);

  let lastBuildingId: string | null = null;
  let lastGoalNodeId: string | null = null;
  let lastMarkerId: string | null = null;

  const legs: {
    slotId: string;
    startTime: string;
    endTime: string;
    courseName: string;
    lecturerName: string;
    hall: { id: string; name: string; building: string; floor: number };
    mapBuildingId: string | null;
    mapBuildingName: string | null;
    markerId: string | null;
    route: ReturnType<typeof formatIndoorRouteResponse>;
  }[] = [];

  for (const slot of today.slots) {
    const base = {
      slotId: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      courseName: slot.course.name,
      lecturerName: slot.lecturerName,
      hall: slot.hall,
      mapBuildingId: slot.mapBuildingId,
      mapBuildingName: slot.mapBuildingName,
      markerId: slot.markerId,
    };

    if (!slot.mapBuildingId) {
      legs.push({
        ...base,
        route: {
          found: false as const,
          message:
            'This hall is not linked to a campus building map. Ask admin to place the room on the floor plan.',
          building: null,
          steps: [],
          segments: [],
          deepLink: null,
          adminFix: INDOOR_ROUTE_ADMIN_FIX,
        },
      });
      continue;
    }

    try {
      const crossBuildingLeg =
        lastBuildingId != null && lastBuildingId !== slot.mapBuildingId;

      const raw = await computeIndoorRouteFlexible({
        buildingId: slot.mapBuildingId,
        fromBuildingId: crossBuildingLeg ? lastBuildingId! : undefined,
        toHallId: slot.hall.id,
        toMarkerId: slot.markerId || undefined,
        fromNodeId:
          !crossBuildingLeg && lastBuildingId === slot.mapBuildingId && lastGoalNodeId
            ? lastGoalNodeId
            : undefined,
        fromMarkerId: crossBuildingLeg && lastMarkerId ? lastMarkerId : undefined,
      });

      const route = formatIndoorRouteResponse(raw);
      if (raw.found) {
        lastBuildingId = slot.mapBuildingId;
        lastGoalNodeId = raw.goalNodeId;
        lastMarkerId = raw.marker?.id ?? slot.markerId ?? null;
      }
      legs.push({ ...base, route });
    } catch (err) {
      const msg = err instanceof AppError ? err.message : 'Could not calculate route';
      legs.push({
        ...base,
        route: {
          found: false as const,
          message: msg,
          building: null,
          steps: [],
          segments: [],
          deepLink: null,
          adminFix: INDOOR_ROUTE_ADMIN_FIX,
        },
      });
    }
  }

  const buildingIds = new Set(
    today.slots.map((s) => s.mapBuildingId).filter((id): id is string => !!id)
  );

  return {
    date: today.date,
    dayOfWeek: today.dayOfWeek,
    orderedBy: 'timetable' as const,
    hasCrossBuilding: buildingIds.size >= 2,
    hasMultipleLocations: today.hasMultipleLocations,
    legs,
    deepLinkAll: '/navigate?today=1',
  };
}
