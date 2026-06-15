import type { PathfindingEdge, PathfindingNode } from './types';
import {
  isVerticalConnectorType,
  normalizeVerticalConnectorLabel,
} from '../../../utils/verticalConnectorLabels';

export function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function buildAdjacency(
  nodes: PathfindingNode[],
  edges: PathfindingEdge[]
): Map<string, { nodeId: string; weight: number }[]> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, { nodeId: string; weight: number }[]>();

  for (const n of nodes) adj.set(n.id, []);

  for (const e of edges) {
    const from = byId.get(e.fromNodeId);
    const to = byId.get(e.toNodeId);
    if (!from || !to) continue;

    const floorPenalty =
      from.floor != null && to.floor != null && from.floor !== to.floor ? 5 : 0;
    let w =
      e.weight != null && !Number.isNaN(e.weight) && e.weight > 0
        ? e.weight
        : euclidean(from.x, from.y, to.x, to.y) + floorPenalty;

    // Prefer staying on one stairs/lift shaft — penalize switching banks on the same floor.
    if (
      from.floor != null &&
      to.floor != null &&
      from.floor === to.floor &&
      from.id !== to.id &&
      isVerticalConnectorType(from.type) &&
      isVerticalConnectorType(to.type)
    ) {
      const a = normalizeVerticalConnectorLabel(from.label || '');
      const b = normalizeVerticalConnectorLabel(to.label || '');
      if (a !== b) w += 25;
    }

    adj.get(e.fromNodeId)!.push({ nodeId: e.toNodeId, weight: w });
    if (e.bidirectional) {
      adj.get(e.toNodeId)!.push({ nodeId: e.fromNodeId, weight: w });
    }
  }
  return adj;
}

export function reconstructPath(cameFrom: Map<string, string | null>, goalId: string): string[] {
  const path: string[] = [];
  let cur: string | null = goalId;
  while (cur) {
    path.unshift(cur);
    cur = cameFrom.get(cur) ?? null;
  }
  return path;
}

export function pathTotalWeight(
  pathIds: string[],
  nodes: PathfindingNode[],
  edges: PathfindingEdge[]
): number {
  if (pathIds.length < 2) return 0;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adj = buildAdjacency(nodes, edges);
  let total = 0;
  for (let i = 1; i < pathIds.length; i++) {
    const from = pathIds[i - 1];
    const to = pathIds[i];
    const neighbors = adj.get(from) || [];
    const edge = neighbors.find((n) => n.nodeId === to);
    if (edge) {
      total += edge.weight;
    } else {
      const a = byId.get(from);
      const b = byId.get(to);
      if (a && b) total += euclidean(a.x, a.y, b.x, b.y);
    }
  }
  return total;
}
