import prisma from '../config/database';
import { NavNodeType } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import {
  createNavEdge,
  createNavNode,
  syncNavNodesFromMarkers,
} from './indoorNavigationService';
import { getModuleExport } from '../utils/moduleExport';

async function loadFloorPlanVisionHelpers() {
  const mod = await import('./floorPlanVisionService');
  return {
    buildAutoNavigationGraph: getModuleExport<
      (buildingId: string, floor: number) => Promise<Record<string, unknown>>
    >(mod as Record<string, unknown>, 'buildAutoNavigationGraph'),
    clearAutoCorridorNodes: getModuleExport<
      (buildingId: string, floor: number) => Promise<void>
    >(mod as Record<string, unknown>, 'clearAutoCorridorNodes'),
  };
}

export type EngineGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  type: string;
};

export type EngineGraphEdge = {
  from: string;
  to: string;
  weight: number;
  label?: string | null;
};

const MATCH_DIST = 8;

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

function mapEngineNodeType(type: string): NavNodeType {
  const t = type.toUpperCase();
  if (t === 'ENTRANCE') return 'ENTRANCE';
  if (t === 'EXIT') return 'EXIT';
  if (t === 'STAIRS' || t === 'STAIR' || t === 'STAIRCASE') return 'STAIRS';
  if (t === 'LIFT' || t === 'ELEVATOR') return 'LIFT';
  if (t === 'CORRIDOR' || t === 'DOOR') return 'CORRIDOR';
  return 'ROOM';
}

function typesCompatible(engineType: string, navType: NavNodeType): boolean {
  const mapped = mapEngineNodeType(engineType);
  if (mapped === navType) return true;
  if (mapped === 'CORRIDOR' && navType === 'CORRIDOR') return true;
  if (mapped === 'ROOM' && (navType === 'ROOM' || navType === 'STAIRS' || navType === 'LIFT')) return true;
  return false;
}

/** Drop all walkable structure on a floor except marker-linked nodes (clean rebuild). */
export async function resetDerivedGraphStructure(buildingId: string, floor: number) {
  const markerNodes = await prisma.navNode.findMany({
    where: { buildingId, floor, mapMarkerId: { not: null } },
    select: { id: true },
  });
  const keepIds = new Set(markerNodes.map((n) => n.id));

  const floorNodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true },
  });
  const floorNodeIds = floorNodes.map((n) => n.id);
  if (!floorNodeIds.length) return;

  await prisma.navEdge.deleteMany({
    where: {
      OR: [{ fromNodeId: { in: floorNodeIds } }, { toNodeId: { in: floorNodeIds } }],
    },
  });

  const removeIds = floorNodeIds.filter((id) => !keepIds.has(id));
  if (removeIds.length) {
    await prisma.navNode.deleteMany({ where: { id: { in: removeIds } } });
  }
}

const MANUAL_PATH_POINT_LABEL = /^(Path point \d+|Stairs \d+|Lift \d+)$/;

/** Remove AI/auto path points; keep place-linked nodes and manually added path points. */
export async function clearAutoPathPoints(buildingId: string, floor: number) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor, mapMarkerId: null },
    select: { id: true, label: true },
  });
  const removeIds = nodes.filter((n) => !MANUAL_PATH_POINT_LABEL.test(n.label)).map((n) => n.id);
  if (!removeIds.length) return { removed: 0 };

  await prisma.navEdge.deleteMany({
    where: {
      OR: [{ fromNodeId: { in: removeIds } }, { toNodeId: { in: removeIds } }],
    },
  });
  await prisma.navNode.deleteMany({ where: { id: { in: removeIds } } });
  return { removed: removeIds.length };
}

/** Remove edges that connect two place markers directly (auto orphan-link / hub star legs). */
export async function stripMarkerOnlyEdges(buildingId: string, floor: number) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true, mapMarkerId: true },
  });
  const markerNodeIds = new Set(
    nodes.filter((n) => n.mapMarkerId).map((n) => n.id)
  );
  const nodeIds = nodes.map((n) => n.id);
  if (!nodeIds.length) return { removed: 0 };

  const edges = await prisma.navEdge.findMany({
    where: {
      OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
    },
    select: { id: true, fromNodeId: true, toNodeId: true },
  });

  const removeIds = edges
    .filter((e) => markerNodeIds.has(e.fromNodeId) && markerNodeIds.has(e.toNodeId))
    .map((e) => e.id);

  if (removeIds.length) {
    await prisma.navEdge.deleteMany({ where: { id: { in: removeIds } } });
  }
  return { removed: removeIds.length };
}

/** Drop auto path points and place-to-place edges; keep manual path points and their lines. */
export async function clearAutoWalkingPaths(buildingId: string, floor: number) {
  const points = await clearAutoPathPoints(buildingId, floor);
  const edges = await stripMarkerOnlyEdges(buildingId, floor);
  return { removedPoints: points.removed, removedMarkerEdges: edges.removed };
}

export type WalkingPathsSnapshot = {
  capturedAt: string;
  pathNodes: Array<{ label: string; x: number; y: number; type: string }>;
  edges: Array<{ fromLabel: string; toLabel: string }>;
};

function isManualPathNodeLabel(label: string): boolean {
  return MANUAL_PATH_POINT_LABEL.test(label);
}

export async function captureWalkingPathsSnapshot(
  buildingId: string,
  floor: number
): Promise<WalkingPathsSnapshot | null> {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, x: true, y: true, type: true, mapMarkerId: true },
  });

  const pathNodes = nodes.filter((n) => !n.mapMarkerId && isManualPathNodeLabel(n.label));
  if (!pathNodes.length) return null;

  const nodeKey = new Map<string, string>();
  for (const n of nodes) {
    nodeKey.set(n.id, n.mapMarkerId ? `place:${n.label}` : n.label);
  }

  const trackedIds = nodes.map((n) => n.id);
  const edges = await prisma.navEdge.findMany({
    where: {
      OR: [{ fromNodeId: { in: trackedIds } }, { toNodeId: { in: trackedIds } }],
    },
    select: { fromNodeId: true, toNodeId: true },
  });

  const pathIds = new Set(pathNodes.map((n) => n.id));
  const snapshotEdges = edges
    .filter(
      (e) =>
        (pathIds.has(e.fromNodeId) || pathIds.has(e.toNodeId)) &&
        nodeKey.has(e.fromNodeId) &&
        nodeKey.has(e.toNodeId)
    )
    .map((e) => ({
      fromLabel: nodeKey.get(e.fromNodeId)!,
      toLabel: nodeKey.get(e.toNodeId)!,
    }));

  return {
    capturedAt: new Date().toISOString(),
    pathNodes: pathNodes.map((n) => ({
      label: n.label,
      x: n.x,
      y: n.y,
      type: n.type,
    })),
    edges: snapshotEdges,
  };
}

export async function saveWalkingPathsSnapshot(buildingId: string, floor: number) {
  const snapshot = await captureWalkingPathsSnapshot(buildingId, floor);
  if (!snapshot) return null;
  await prisma.floorPlan.update({
    where: { buildingId_floor: { buildingId, floor } },
    data: { walkingPathsSnapshot: snapshot as object },
  });
  return snapshot;
}

export async function restoreWalkingPathsFromSnapshot(buildingId: string, floor: number) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { walkingPathsSnapshot: true },
  });
  const snap = plan?.walkingPathsSnapshot as WalkingPathsSnapshot | null;
  if (!snap?.pathNodes?.length) {
    throw new AppError('No walking path backup saved for this floor', 404);
  }

  const existing = await prisma.navNode.findMany({
    where: { buildingId, floor, mapMarkerId: null },
    select: { id: true, label: true },
  });
  const removeIds = existing
    .filter((n) => isManualPathNodeLabel(n.label))
    .map((n) => n.id);
  if (removeIds.length) {
    await prisma.navEdge.deleteMany({
      where: { OR: [{ fromNodeId: { in: removeIds } }, { toNodeId: { in: removeIds } }] },
    });
    await prisma.navNode.deleteMany({ where: { id: { in: removeIds } } });
  }

  await clearAutoWalkingPaths(buildingId, floor);
  await syncNavNodesFromMarkers(buildingId, floor);

  const labelToId = new Map<string, string>();
  const markers = await prisma.navNode.findMany({
    where: { buildingId, floor, mapMarkerId: { not: null } },
    select: { id: true, label: true },
  });
  for (const m of markers) labelToId.set(`place:${m.label}`, m.id);

  for (const pn of snap.pathNodes) {
    const node = await createNavNode({
      buildingId,
      floor,
      label: pn.label,
      x: pn.x,
      y: pn.y,
      type: pn.type as NavNodeType,
      mapMarkerId: null,
    });
    labelToId.set(pn.label, node.id);
  }

  let edgesRestored = 0;
  for (const e of snap.edges) {
    const fromId = labelToId.get(e.fromLabel);
    const toId = labelToId.get(e.toLabel);
    if (!fromId || !toId) continue;
    try {
      await createNavEdge({ fromNodeId: fromId, toNodeId: toId, bidirectional: true });
      edgesRestored++;
    } catch {
      /* duplicate */
    }
  }

  return { pathNodes: snap.pathNodes.length, edgesRestored, capturedAt: snap.capturedAt };
}

/** Remove auto-generated corridor junctions (keeps marker-linked nodes). */
export async function clearDerivedCorridorNodes(buildingId: string, floor: number) {
  const { clearAutoCorridorNodes } = await loadFloorPlanVisionHelpers();
  await clearAutoCorridorNodes(buildingId, floor);
  const junctions = await prisma.navNode.findMany({
    where: {
      buildingId,
      floor,
      type: 'CORRIDOR',
      mapMarkerId: null,
      label: { startsWith: 'Junction ' },
    },
    select: { id: true },
  });
  const ids = junctions.map((n) => n.id);
  if (!ids.length) return;
  await prisma.navEdge.deleteMany({
    where: { OR: [{ fromNodeId: { in: ids } }, { toNodeId: { in: ids } }] },
  });
  await prisma.navNode.deleteMany({ where: { id: { in: ids } } });
}

function findClosestNode(
  nodes: { id: string; x: number; y: number; type: NavNodeType }[],
  x: number,
  y: number,
  engineType: string
) {
  let best: (typeof nodes)[0] | null = null;
  let bestDist = Infinity;
  for (const n of nodes) {
    if (!typesCompatible(engineType, n.type)) continue;
    const d = euclidean(n.x, n.y, x, y);
    if (d < bestDist && d <= MATCH_DIST) {
      bestDist = d;
      best = n;
    }
  }
  return best;
}

export async function connectOrphanMarkerNodes(buildingId: string, floor: number) {
  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true, x: true, y: true, type: true, mapMarkerId: true },
  });
  const nodeIds = nodes.map((n) => n.id);
  const edges =
    nodeIds.length > 0
      ? await prisma.navEdge.findMany({
          where: {
            OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
          },
          select: { fromNodeId: true, toNodeId: true },
        })
      : [];
  const degree = new Map<string, number>();
  for (const n of nodes) degree.set(n.id, 0);
  for (const e of edges) {
    degree.set(e.fromNodeId, (degree.get(e.fromNodeId) || 0) + 1);
    degree.set(e.toNodeId, (degree.get(e.toNodeId) || 0) + 1);
  }

  const corridors = nodes.filter(
    (n) => n.type === 'CORRIDOR' || n.type === 'ENTRANCE' || n.type === 'EXIT'
  );
  if (!corridors.length) {
    const anchor = nodes.find((n) => n.type === 'ROOM' || n.type === 'STAIRS' || n.type === 'LIFT');
    if (!anchor) return { linked: 0 };
    corridors.push(anchor);
  }

  let linked = 0;
  for (const node of nodes) {
    if ((degree.get(node.id) || 0) > 0) continue;
    if (!node.mapMarkerId && node.type === 'CORRIDOR') continue;
    let nearest = corridors[0];
    let best = Infinity;
    for (const c of corridors) {
      const d = euclidean(node.x, node.y, c.x, c.y);
      if (d < best) {
        best = d;
        nearest = c;
      }
    }
    if (!nearest || nearest.id === node.id) continue;
    try {
      await createNavEdge({ fromNodeId: nearest.id, toNodeId: node.id, bidirectional: true });
      linked++;
    } catch {
      /* duplicate edge */
    }
  }
  return { linked };
}

/** Merge Python engine spatial graph into DB nav nodes/edges. */
export async function importEngineSpatialGraph(
  buildingId: string,
  floor: number,
  engineNodes: EngineGraphNode[],
  engineEdges: EngineGraphEdge[]
) {
  await clearDerivedCorridorNodes(buildingId, floor);

  let existing = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, x: true, y: true, type: true, mapMarkerId: true },
  });

  const idMap = new Map<string, string>();
  let nodesCreated = 0;
  let nodesMerged = 0;

  for (const en of engineNodes) {
    const match = findClosestNode(existing, en.x, en.y, en.type);
    if (match) {
      idMap.set(en.id, match.id);
      nodesMerged++;
      continue;
    }

    const navType = mapEngineNodeType(en.type);
    if (navType === 'ROOM') {
      continue;
    }

    const created = await createNavNode({
      buildingId,
      floor,
      label: en.label || `Corridor ${nodesCreated + 1}`,
      x: en.x,
      y: en.y,
      type: navType,
    });
    idMap.set(en.id, created.id);
    existing = [...existing, { ...created, mapMarkerId: created.mapMarkerId }];
    nodesCreated++;
  }

  let edgesCreated = 0;
  for (const ee of engineEdges) {
    const fromId = idMap.get(ee.from);
    const toId = idMap.get(ee.to);
    if (!fromId || !toId || fromId === toId) continue;
    try {
      await createNavEdge({
        fromNodeId: fromId,
        toNodeId: toId,
        weight: ee.weight,
        bidirectional: true,
        label: ee.label || null,
      });
      edgesCreated++;
    } catch {
      /* duplicate */
    }
  }

  const orphans = await connectOrphanMarkerNodes(buildingId, floor);
  return { nodesCreated, nodesMerged, edgesCreated, orphansLinked: orphans.linked };
}

/** Sync markers, import engine graph or auto-hub fallback, link orphans. */
export async function buildFloorNavigationGraph(
  buildingId: string,
  floor: number,
  engineGraph?: { nodes: EngineGraphNode[]; edges: EngineGraphEdge[] },
  options?: { force?: boolean }
) {
  const sync = await syncNavNodesFromMarkers(buildingId, floor);
  const manual = await captureWalkingPathsSnapshot(buildingId, floor);
  if (manual && !options?.force) {
    throw new AppError(
      'This floor already has manual walking paths. Auto-build is blocked - draw paths yourself or click Restore backup.',
      409
    );
  }
  if (manual) {
    await saveWalkingPathsSnapshot(buildingId, floor);
  }

  if (engineGraph?.nodes?.length && engineGraph.edges?.length) {
    const imported = await importEngineSpatialGraph(
      buildingId,
      floor,
      engineGraph.nodes,
      engineGraph.edges
    );
    return { source: 'engine' as const, sync, ...imported };
  }

  await resetDerivedGraphStructure(buildingId, floor);
  const { buildAutoNavigationGraph } = await loadFloorPlanVisionHelpers();
  const auto = await buildAutoNavigationGraph(buildingId, floor);
  const orphans = await connectOrphanMarkerNodes(buildingId, floor);
  return { source: 'auto' as const, sync, ...auto, orphansLinked: orphans.linked };
}
