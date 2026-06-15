import {
  computeIndoorRouteFlexible,
  formatIndoorRouteResponse,
  resolveIndoorDestinationFromQuery,
} from '../../../services/indoorNavigationService';
import { generateAiDirections } from '../../../services/floorNavigationEngineService';
import { searchMapEntities, pickBestMapSearchResult } from '../../../services/mapSearchService';
import { parseSourceDestinationQuery } from '../../../services/mapSearchService';
import { getFloorScale } from '../repositories/nav-graph.repository';

export async function computeRouteRequest(options: {
  buildingId?: string;
  fromBuildingId?: string;
  toBuildingId?: string;
  toHallId?: string;
  toMarkerId?: string;
  fromNodeId?: string;
  fromMarkerId?: string;
  q?: string;
  sourceQ?: string;
  floor?: number;
  fromFloor?: number;
}) {
  let fromNodeId = options.fromNodeId;
  let buildingId = options.toBuildingId || options.buildingId;

  if (options.sourceQ?.trim() && buildingId) {
    const sourceResults = await searchMapEntities(options.sourceQ.trim());
    const source = pickBestMapSearchResult(options.sourceQ.trim(), sourceResults);
    if (source?.buildingId === buildingId) {
      const linked = await import('../../../config/database').then((m) =>
        m.default.navNode.findFirst({
          where: {
            buildingId,
            OR: [
              { mapMarkerId: source.markerId ?? undefined },
              { label: { equals: source.label, mode: 'insensitive' } },
            ],
          },
        })
      );
      if (linked) fromNodeId = linked.id;
    }
  }

  const raw = await computeIndoorRouteFlexible({
    buildingId,
    fromBuildingId: options.fromBuildingId,
    toBuildingId: options.toBuildingId,
    toHallId: options.toHallId,
    toMarkerId: options.toMarkerId,
    q: options.q,
    floor: options.floor,
    fromFloor: options.fromFloor,
    fromNodeId,
    fromMarkerId: options.fromMarkerId,
  });

  const formatted = formatIndoorRouteResponse(raw);

  if (formatted.found && formatted.polyline?.length) {
    const destFloor =
      formatted.marker?.floor ?? formatted.segments[formatted.segments.length - 1]?.floor ?? 0;
    const scale = buildingId ? await getFloorScale(buildingId, destFloor) : null;

    const graphSteps = formatted.stepDetails?.length ? formatted.stepDetails : formatted.steps;
    const ai = await generateAiDirections({
      destinationLabel: formatted.destinationLabel || 'destination',
      buildingName: formatted.building?.name,
      polyline: formatted.polyline,
    });

    if (ai) {
      (formatted as Record<string, unknown>).confidence = ai.confidence;
      (formatted as Record<string, unknown>).directionEngine = ai.engine;
    }

    // Keep graph turn-by-turn steps (correct per-floor + polylineIndex). AI text is fallback only.
    if (!graphSteps?.length && ai?.steps?.length) {
      formatted.steps = ai.steps.map((s) => ({
        instruction: s.instruction,
        floor: s.floor ?? destFloor,
      }));
      (formatted as Record<string, unknown>).stepDetails = formatted.steps;
    }

    if ('distance' in formatted && formatted.distance != null && scale) {
      const { estimateRouteMetrics } = await import('../pathfinding');
      const metrics = estimateRouteMetrics(formatted.distance as number, scale);
      (formatted as Record<string, unknown>).distanceMeters = metrics.distanceMeters;
      (formatted as Record<string, unknown>).estimatedMinutes = metrics.estimatedMinutes;
    }
  }

  return { formatted, fromNodeId };
}

export async function resolveDestinationFromText(q: string, buildingId?: string) {
  return resolveIndoorDestinationFromQuery(q, { buildingId });
}

export { searchMapEntities, pickBestMapSearchResult, parseSourceDestinationQuery };
