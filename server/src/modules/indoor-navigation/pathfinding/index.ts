import { astar } from './astar';
import { dijkstra } from './dijkstra';
import { pathTotalWeight } from './graph-utils';
import type { PathfindingEdge, PathfindingNode, PathfindingResult } from './types';
import { DEFAULT_METERS_PER_PERCENT, WALKING_SPEED_MPS } from './types';

export * from './types';
export { astar } from './astar';
export { dijkstra } from './dijkstra';
export { euclidean, buildAdjacency, pathTotalWeight } from './graph-utils';

/** Run A* first; fall back to Dijkstra if no path found. */
export function findShortestPath(
  nodes: PathfindingNode[],
  edges: PathfindingEdge[],
  startId: string,
  goalId: string
): PathfindingResult | null {
  let pathNodeIds = astar(nodes, edges, startId, goalId);
  let algorithm: 'astar' | 'dijkstra' = 'astar';

  if (!pathNodeIds) {
    pathNodeIds = dijkstra(nodes, edges, startId, goalId);
    algorithm = 'dijkstra';
  }
  if (!pathNodeIds) return null;

  return {
    pathNodeIds,
    algorithm,
    totalWeight: pathTotalWeight(pathNodeIds, nodes, edges),
  };
}

/** Convert graph weight (percent units) to meters and walking time. */
export function estimateRouteMetrics(
  totalWeightPercent: number,
  scaleMetersPerUnit?: number | null
): { distanceMeters: number; estimatedMinutes: number } {
  const scale = scaleMetersPerUnit && scaleMetersPerUnit > 0 ? scaleMetersPerUnit : DEFAULT_METERS_PER_PERCENT;
  const distanceMeters = Math.round(totalWeightPercent * scale * 10) / 10;
  const estimatedMinutes = Math.max(1, Math.ceil(distanceMeters / WALKING_SPEED_MPS / 60));
  return { distanceMeters, estimatedMinutes };
}
