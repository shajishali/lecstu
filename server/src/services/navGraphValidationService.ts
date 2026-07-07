import prisma from '../config/database';
import { getConnectionsForBuilding } from '../constants/buildingConnections';
import { isMarkerVisibleToStudents } from '../utils/markerMetadata';

export type NavGraphValidation = {
  buildingId: string;
  floor: number;
  nodeCount: number;
  edgeCount: number;
  entranceCount: number;
  stairsCount: number;
  liftCount: number;
  corridorCount: number;
  roomCount: number;
  placeNodeCount: number;
  pathPointCount: number;
  orphanNodes: Array<{ id: string; label: string; type: string }>;
  disconnectedDetails: Array<{ id: string; label: string; type: string; kind: 'place' | 'path' }>;
  markersWithoutNode: Array<{ id: string; label: string }>;
  missingEntrance: boolean;
  componentCount: number;
  largestComponentSize: number;
  isConnected: boolean;
  issues: string[];
  warnings: string[];
  /** Temporary admin hints - extra path/place points for efficient routing */
  suggestions: string[];
  healthy: boolean;
};

function buildAdjacency(
  nodeIds: string[],
  edges: { fromNodeId: string; toNodeId: string; bidirectional: boolean }[]
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const id of nodeIds) adj.set(id, []);
  for (const e of edges) {
    adj.get(e.fromNodeId)?.push(e.toNodeId);
    if (e.bidirectional) adj.get(e.toNodeId)?.push(e.fromNodeId);
  }
  return adj;
}

function connectedComponents(nodeIds: string[], adj: Map<string, string[]>) {
  const visited = new Set<string>();
  const sizes: number[] = [];

  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    const stack = [start];
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      size++;
      for (const next of adj.get(cur) || []) {
        if (!visited.has(next)) stack.push(next);
      }
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
}

function buildNavigationSuggestions(input: {
  buildingCode: string;
  floor: number;
  nodes: { id: string; label: string; type: string; mapMarkerId: string | null }[];
  orphanNodes: { label: string; type: string; mapMarkerId: string | null }[];
  markersWithoutNode: { label: string }[];
  entranceCount: number;
  corridorCount: number;
  edgeCount: number;
  componentCount: number;
  hasStairsAccess: boolean;
  hasLiftAccess: boolean;
  markerTypes: string[];
}): string[] {
  const tips: string[] = [];
  const { nodes, orphanNodes, markersWithoutNode, edgeCount, componentCount } = input;

  if (nodes.length === 0) {
    tips.push(
      'Lock locations on the previous tab, then add path junction dots along the main corridor before connecting rooms.'
    );
    return tips;
  }

  if (edgeCount === 0) {
    tips.push(
      'No walking lines yet - click Add path point, place junctions along hallways, Confirm, then Connect each place to the nearest junction.'
    );
  }

  if (input.entranceCount === 0) {
    tips.push(
      'Add an ENTRANCE LOBBY place at the main door - routing always starts from an entrance node.'
    );
  }

  if (!input.hasStairsAccess && !input.hasLiftAccess) {
    tips.push(
      'Add a Stairs & lift (same spot) or separate Staircase / Lift place where vertical access exists - connect it to the corridor path for multi-floor routing later.'
    );
  }

  const orphanPlaces = orphanNodes.filter((n) => n.mapMarkerId);
  const orphanPaths = orphanNodes.filter((n) => !n.mapMarkerId);
  for (const p of orphanPlaces.slice(0, 8)) {
    tips.push(
      `Connect place "${p.label}" to the nearest corridor path point (or add a junction outside the door first).`
    );
  }
  if (orphanPlaces.length > 8) {
    tips.push(`…and ${orphanPlaces.length - 8} more disconnected place(s) - connect each to the walkway.`);
  }

  for (const p of orphanPaths.slice(0, 4)) {
    tips.push(`Path junction "${p.label}" has no lines - Connect it to the corridor spine or a nearby place.`);
  }

  if (componentCount > 1) {
    tips.push(
      `Graph has ${componentCount} separate sections - add 1-2 path points in the hallway between them, then Connect to merge into one network.`
    );
  }

  if (input.corridorCount === 0 && nodes.some((n) => n.mapMarkerId)) {
    tips.push(
      'No corridor junctions yet - place grey path points every corner/turn along the main walkway so routes follow hallways, not cut through walls.'
    );
  }

  if (markersWithoutNode.length > 0) {
    tips.push(
      `Approved place(s) missing from graph: ${markersWithoutNode.map((m) => m.label).join(', ')} - open Locations & publish and re-lock, or Sync markers.`
    );
  }

  const hasToilet = input.markerTypes.some((t) => t === 'TOILET');
  if (!hasToilet && nodes.filter((n) => n.mapMarkerId).length >= 8) {
    tips.push('Consider marking toilet / washroom locations if shown on the floor sign - helps student queries.');
  }

  const expectedConnections = getConnectionsForBuilding(input.buildingCode);
  if (expectedConnections.length > 0 && input.floor === 0) {
    for (const c of expectedConnections) {
      const hasLink = nodes.some((n) =>
        n.label.toLowerCase().includes(c.targetBuildingCode.toLowerCase()) ||
        n.label.toLowerCase().includes(c.label.toLowerCase().slice(0, 12))
      );
      if (!hasLink) {
        tips.push(
          `Ground floor: add building link "${c.label}" (${c.markerType}) at the doorway to ${c.targetBuildingCode} and connect it to the corridor.`
        );
      }
    }
  }

  if (tips.length === 0 && nodes.length > 0) {
    tips.push(
      'This floor looks connected. Optional: add extra path points at T-junctions and near stairs/lift for clearer turn-by-turn steps.'
    );
  }

  return tips;
}

export async function validateFloorNavGraph(
  buildingId: string,
  floor: number
): Promise<NavGraphValidation> {
  const building = await prisma.mapBuilding.findUnique({
    where: { id: buildingId },
    select: { code: true },
  });

  const nodes = await prisma.navNode.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, type: true, mapMarkerId: true },
  });
  const nodeIds = nodes.map((n) => n.id);
  const edges =
    nodeIds.length > 0
      ? await prisma.navEdge.findMany({
          where: {
            OR: [{ fromNodeId: { in: nodeIds } }, { toNodeId: { in: nodeIds } }],
          },
          select: { fromNodeId: true, toNodeId: true, bidirectional: true },
        })
      : [];

  const adj = buildAdjacency(nodeIds, edges);
  const degree = new Map<string, number>();
  for (const id of nodeIds) degree.set(id, 0);
  for (const e of edges) {
    degree.set(e.fromNodeId, (degree.get(e.fromNodeId) || 0) + 1);
    degree.set(e.toNodeId, (degree.get(e.toNodeId) || 0) + 1);
  }

  const orphanNodes = nodes
    .filter((n) => (degree.get(n.id) || 0) === 0)
    .map((n) => ({ id: n.id, label: n.label, type: n.type }));

  const disconnectedDetails = nodes
    .filter((n) => (degree.get(n.id) || 0) === 0)
    .map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      kind: (n.mapMarkerId ? 'place' : 'path') as 'place' | 'path',
    }));

  const placeNodeCount = nodes.filter((n) => n.mapMarkerId).length;
  const pathPointCount = nodes.filter((n) => !n.mapMarkerId).length;

  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, metadata: true, type: true },
  });
  const linkedMarkerIds = new Set(
    nodes.map((n) => n.mapMarkerId).filter((id): id is string => !!id)
  );
  const markersWithoutNode = markers
    .filter((m) => isMarkerVisibleToStudents(m.metadata) && !linkedMarkerIds.has(m.id))
    .map((m) => ({ id: m.id, label: m.label }));

  const entranceCount = nodes.filter((n) => n.type === 'ENTRANCE').length;
  const stairsCount = nodes.filter((n) => n.type === 'STAIRS').length;
  const liftCount = nodes.filter((n) => n.type === 'LIFT').length;
  const corridorCount = nodes.filter((n) => n.type === 'CORRIDOR').length;
  const roomCount = nodes.filter((n) => n.type === 'ROOM').length;

  const componentSizes = connectedComponents(nodeIds, adj);
  const componentCount = componentSizes.length;
  const largestComponentSize = componentSizes[0] || 0;
  const isConnected = nodeIds.length === 0 || (componentCount === 1 && largestComponentSize === nodeIds.length);

  const issues: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    issues.push('No navigation nodes - approve locations, then draw walking paths manually in this tab.');
  }
  if (entranceCount === 0) {
    issues.push('Missing entrance - approve an ENTRANCE LOBBY marker or add an ENTRANCE node on the map.');
  }
  if (orphanNodes.length > 0) {
    const names = orphanNodes
      .slice(0, 4)
      .map((n) => n.label)
      .join(', ');
    const more = orphanNodes.length > 4 ? ` (+${orphanNodes.length - 4} more)` : '';
    issues.push(`Disconnected nodes: ${names}${more}. Use Connect tool to link them.`);
  }
  if (markersWithoutNode.length > 0) {
    const names = markersWithoutNode
      .slice(0, 4)
      .map((m) => m.label)
      .join(', ');
    issues.push(`Approved places not on graph: ${names}. Click Sync markers below.`);
  }
  if (!isConnected && nodes.length > 1) {
    issues.push(
      `Graph has ${componentCount} separate sections - use Connect to join corridor junctions.`
    );
  }
  const approvedMarkers = markers.filter((m) => isMarkerVisibleToStudents(m.metadata));
  const hasStairsAccess =
    stairsCount > 0 ||
    approvedMarkers.some((m) => m.type === 'STAIRS' || m.type === 'STAIRS_LIFT');
  const hasLiftAccess =
    liftCount > 0 ||
    approvedMarkers.some((m) => m.type === 'LIFT' || m.type === 'STAIRS_LIFT');
  if (!hasStairsAccess && !hasLiftAccess) {
    warnings.push('No stairs/lift yet (optional now; needed for multi-floor routes in Phase 11.4).');
  }

  const suggestions = buildNavigationSuggestions({
    buildingCode: building?.code ?? '',
    floor,
    nodes,
    orphanNodes: nodes.filter((n) => (degree.get(n.id) || 0) === 0),
    markersWithoutNode,
    entranceCount,
    corridorCount,
    edgeCount: edges.length,
    componentCount,
    hasStairsAccess,
    hasLiftAccess,
    markerTypes: approvedMarkers.map((m) => m.type),
  });

  const healthy =
    nodes.length > 0 &&
    entranceCount > 0 &&
    isConnected &&
    orphanNodes.length === 0 &&
    markersWithoutNode.length === 0;

  return {
    buildingId,
    floor,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    entranceCount,
    stairsCount,
    liftCount,
    corridorCount,
    roomCount,
    placeNodeCount,
    pathPointCount,
    orphanNodes,
    disconnectedDetails,
    markersWithoutNode,
    missingEntrance: entranceCount === 0,
    componentCount,
    largestComponentSize,
    isConnected,
    issues,
    warnings,
    suggestions,
    healthy,
  };
}
