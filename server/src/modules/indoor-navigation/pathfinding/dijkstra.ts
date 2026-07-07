import { buildAdjacency, reconstructPath } from './graph-utils';
import type { PathfindingEdge, PathfindingNode } from './types';

/**
 * Dijkstra shortest-path - fallback when A* returns no path
 * (e.g. heuristic issues on disconnected subgraphs) or for validation.
 */
export function dijkstra(
  nodes: PathfindingNode[],
  edges: PathfindingEdge[],
  startId: string,
  goalId: string
): string[] | null {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (!byId.has(startId) || !byId.has(goalId)) return null;
  if (startId === goalId) return [startId];

  const adj = buildAdjacency(nodes, edges);
  const dist = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();
  const unvisited = new Set(nodes.map((n) => n.id));

  for (const id of unvisited) dist.set(id, Infinity);
  dist.set(startId, 0);
  cameFrom.set(startId, null);

  while (unvisited.size > 0) {
    let current: string | null = null;
    let best = Infinity;
    for (const id of unvisited) {
      const d = dist.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (current == null || best === Infinity) break;
    if (current === goalId) return reconstructPath(cameFrom, goalId);

    unvisited.delete(current);
    const gCur = dist.get(current)!;

    for (const neighbor of adj.get(current) || []) {
      if (!unvisited.has(neighbor.nodeId)) continue;
      const tentative = gCur + neighbor.weight;
      if (tentative < (dist.get(neighbor.nodeId) ?? Infinity)) {
        dist.set(neighbor.nodeId, tentative);
        cameFrom.set(neighbor.nodeId, current);
      }
    }
  }
  return null;
}
