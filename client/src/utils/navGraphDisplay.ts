/** Shared walking-path display helpers (same rules as IndoorNavGraphEditor). */

export interface NavGraphNodeLite {
  id: string;
  x: number;
  y: number;
  label: string;
  type: string;
  mapMarkerId?: string | null;
}

export interface NavGraphEdgeLite {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export function isPlaceNavNode(n: NavGraphNodeLite): boolean {
  return n.mapMarkerId != null;
}

export function isPathNavNode(n: NavGraphNodeLite): boolean {
  return !isPlaceNavNode(n);
}

export function buildNavNodeSets(nodes: NavGraphNodeLite[]) {
  const placeNavNodeIds = new Set<string>();
  const pathNodeIds = new Set<string>();
  for (const n of nodes) {
    if (isPlaceNavNode(n)) placeNavNodeIds.add(n.id);
    else pathNodeIds.add(n.id);
  }
  return { placeNavNodeIds, pathNodeIds };
}

export function isEdgeVisibleOnFloorPlan(
  edge: NavGraphEdgeLite,
  placeNavNodeIds: Set<string>,
  pathNodeIds: Set<string>
): boolean {
  const fromVisible = placeNavNodeIds.has(edge.fromNodeId) || pathNodeIds.has(edge.fromNodeId);
  const toVisible = placeNavNodeIds.has(edge.toNodeId) || pathNodeIds.has(edge.toNodeId);
  return fromVisible && toVisible;
}

/** Same palette as IndoorNavGraphEditor NODE_COLORS */
export const NAV_NODE_COLORS: Record<string, string> = {
  CORRIDOR: '#64748b',
  STAIRS: '#f97316',
  LIFT: '#06b6d4',
  ENTRANCE: '#ef4444',
  EXIT: '#a855f7',
  ROOM: '#3b82f6',
};

/** Auto-built junctions use a lighter pin in admin path-only mode. */
export function isManualPathPoint(n: NavGraphNodeLite): boolean {
  if (!isPathNavNode(n)) return false;
  return /^(Path point \d+|Stairs \d+|Lift \d+)$/.test(n.label);
}

/** Same point sequence as admin Preview route (pathNodeIds → x,y, optional room marker). */
export function buildRoutePathPoints(
  pathNodeIds: string[] | undefined,
  nodes: NavGraphNodeLite[],
  options?: {
    roomMarker?: { x: number; y: number; floor: number } | null;
    viewFloor?: number;
    segmentFallback?: Array<{ x: number; y: number }>;
  }
): Array<{ x: number; y: number }> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const pts: Array<{ x: number; y: number }> = [];

  if (pathNodeIds?.length) {
    for (const id of pathNodeIds) {
      const n = nodeById.get(id);
      if (n) pts.push({ x: n.x, y: n.y });
    }
  }

  const room = options?.roomMarker;
  if (
    room &&
    (options?.viewFloor === undefined || room.floor === options.viewFloor) &&
    pts.length > 0
  ) {
    const last = pts[pts.length - 1];
    if (Math.hypot(last.x - room.x, last.y - room.y) > 0.15) {
      pts.push({ x: room.x, y: room.y });
    }
  }

  if (pts.length >= 2) return pts;

  const fallback = options?.segmentFallback ?? [];
  return fallback.length >= 2 ? fallback : pts;
}
