import { buildAdjacency, euclidean, reconstructPath } from './graph-utils';
import type { PathfindingEdge, PathfindingNode } from './types';

/**
 * A* pathfinding - primary algorithm for indoor navigation graphs.
 * Suitable for 10k+ nodes when graph is sparse (typical corridor networks).
 */
export function astar(
  nodes: PathfindingNode[],
  edges: PathfindingEdge[],
  startId: string,
  goalId: string
): string[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(startId) || !byId.has(goalId)) return null;
  if (startId === goalId) return [startId];

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
