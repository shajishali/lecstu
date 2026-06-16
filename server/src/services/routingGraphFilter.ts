import { CROSS_BUILDING_EDGE_LABEL, isSameFloorLinkAllowed } from '../constants/buildingConnections';
import { isVerticalConnectorType } from '../utils/verticalConnectorLabels';

export type RoutingGraphNode = {
  id: string;
  buildingId: string;
  floor: number;
  type: string;
  mapMarkerId: string | null;
};

export type RoutingGraphEdge = {
  fromNodeId: string;
  toNodeId: string;
  weight: number | null;
  bidirectional: boolean;
  label: string | null;
};

/**
 * Keep only edges Find My Way should traverse:
 * - same-floor walking paths inside a building
 * - horizontal building links (admin place markers, same floor, allowed building pair)
 * - vertical connectors (stairs/lift between floors)
 */
export function filterRoutingEdges<T extends RoutingGraphEdge>(
  nodes: RoutingGraphNode[],
  edges: T[],
  buildingCodeById: Map<string, string>
): T[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return edges.filter((e) => {
    const from = byId.get(e.fromNodeId);
    const to = byId.get(e.toNodeId);
    if (!from || !to) return false;

    if (e.label === CROSS_BUILDING_EDGE_LABEL) {
      const fromCode = buildingCodeById.get(from.buildingId);
      const toCode = buildingCodeById.get(to.buildingId);
      if (!fromCode || !toCode) return false;
      return (
        from.mapMarkerId != null &&
        to.mapMarkerId != null &&
        from.floor === to.floor &&
        from.buildingId !== to.buildingId &&
        isSameFloorLinkAllowed(fromCode, toCode, from.floor)
      );
    }

    if (from.buildingId !== to.buildingId) {
      return false;
    }

    if (from.floor !== to.floor) {
      return isVerticalConnectorType(from.type) && isVerticalConnectorType(to.type);
    }

    return true;
  });
}
