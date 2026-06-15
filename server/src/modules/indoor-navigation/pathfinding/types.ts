/** Graph node used by pathfinding algorithms (percent coords on floor plan). */
export type PathfindingNode = {
  id: string;
  x: number;
  y: number;
  floor?: number;
  label?: string;
  type?: string;
};

export type PathfindingEdge = {
  fromNodeId: string;
  toNodeId: string;
  weight: number | null;
  bidirectional: boolean;
  label?: string | null;
};

export type PathfindingResult = {
  pathNodeIds: string[];
  algorithm: 'astar' | 'dijkstra';
  totalWeight: number;
};

export const DEFAULT_METERS_PER_PERCENT = 0.45;
export const WALKING_SPEED_MPS = 1.4;
