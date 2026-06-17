import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import api from '@services/api';
import FloorPlanRouteMap, { type FloorPlanPlaceMarker } from '@components/FloorPlanRouteMap';
import ZoomableFloorPlanMap from '@components/ZoomableFloorPlanMap';
import { floorPlanImageUrl } from '@utils/floorPlanImageUrl';
import type { NavGraphEdgeLite, NavGraphNodeLite } from '@utils/navGraphDisplay';
import { splitRoutePathByStep, type RouteStepDetail } from '@utils/routeStepProgress';

interface FloorMarkerRow {
  id: string;
  label: string;
  floor: number;
  x: number;
  y: number;
}

interface IndoorRouteMapViewProps {
  buildingId: string;
  floor: number;
  polyline?: Array<{ x: number; y: number; floor: number; buildingId?: string }>;
  startLabel?: string;
  destinationLabel?: string;
  startMarkerId?: string;
  destinationMarkerId?: string;
  startFloor?: number;
  destFloor?: number;
  /** When set with stepDetails, traveled route is drawn in red and the rest in yellow. */
  stepIndex?: number;
  stepDetails?: RouteStepDetail[];
  /** Tap/click map to open full-screen view with zoom. */
  expandable?: boolean;
}

function findPlaceMarker(
  places: FloorPlanPlaceMarker[],
  options: { id?: string; label?: string }
) {
  if (options.id) {
    const byId = places.find((p) => p.markerId === options.id);
    if (byId) return byId;
  }
  if (!options.label?.trim()) return undefined;
  const n = options.label.trim().toLowerCase();
  return places.find((p) => p.label.trim().toLowerCase() === n);
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor' : `Floor ${floor}`;
}

/** Student map — same data + markup as admin Test route (A*). */
export default function IndoorRouteMapView({
  buildingId,
  floor,
  polyline = [],
  startLabel,
  destinationLabel,
  startMarkerId,
  destinationMarkerId,
  startFloor,
  destFloor,
  stepIndex,
  stepDetails,
  expandable = true,
}: IndoorRouteMapViewProps) {
  const [navGraph, setNavGraph] = useState<{
    nodes: NavGraphNodeLite[];
    edges: NavGraphEdgeLite[];
  } | null>(null);
  const [floorMarkers, setFloorMarkers] = useState<FloorMarkerRow[]>([]);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [fullscreen]);

  useEffect(() => {
    void (async () => {
      try {
        const [graphRes, buildingsRes, markersRes] = await Promise.all([
          api.get('/map/nav-graph', { params: { buildingId, floor } }),
          api.get('/map/buildings'),
          api.get('/map/markers', { params: { buildingId, floor } }),
        ]);
        setNavGraph(graphRes.data.data ?? null);
        setFloorMarkers(markersRes.data.data ?? []);
        const b = (buildingsRes.data.data || []).find(
          (x: { id: string }) => x.id === buildingId
        );
        const fp = b?.floorPlans?.find((p: { floor: number }) => p.floor === floor);
        setImagePath(fp?.imagePath ?? null);
      } catch {
        setNavGraph(null);
        setFloorMarkers([]);
        setImagePath(null);
      }
    })();
  }, [buildingId, floor]);

  /** Polyline points for this floor — exact coordinates from the server (same as admin). */
  const routePathPoints = useMemo(() => {
    const onFloor = polyline.filter(
      (p) => p.floor === floor && (!p.buildingId || p.buildingId === buildingId)
    );
    return onFloor.map((p) => ({ x: p.x, y: p.y }));
  }, [polyline, floor, buildingId]);

  const { routePathAhead, routePathTraveled } = useMemo(() => {
    if (
      stepIndex == null ||
      !stepDetails?.length ||
      routePathPoints.length < 2
    ) {
      return { routePathAhead: routePathPoints, routePathTraveled: [] as typeof routePathPoints };
    }
    const { traveled, ahead } = splitRoutePathByStep(
      routePathPoints,
      stepDetails,
      stepIndex,
      floor,
      polyline
    );
    return { routePathAhead: ahead, routePathTraveled: traveled };
  }, [routePathPoints, stepDetails, stepIndex, floor, polyline]);

  const showStepProgress =
    stepIndex != null && stepDetails != null && stepDetails.length > 0;

  const placeMarkers = useMemo((): FloorPlanPlaceMarker[] => {
    return floorMarkers.map((m) => ({
      markerId: m.id,
      navNodeId: null,
      label: m.label,
      x: m.x,
      y: m.y,
    }));
  }, [floorMarkers]);

  const routeEndpoints = useMemo(() => {
    if (routePathPoints.length < 2) return { start: null, end: null };

    const showStart = startFloor === undefined || floor === startFloor;
    const showEnd = destFloor === undefined || floor === destFloor;

    const startPlace = showStart
      ? findPlaceMarker(placeMarkers, { id: startMarkerId, label: startLabel })
      : undefined;
    const endPlace = showEnd
      ? findPlaceMarker(placeMarkers, { id: destinationMarkerId, label: destinationLabel })
      : undefined;

    const first = routePathPoints[0];
    const last = routePathPoints[routePathPoints.length - 1];

    return {
      start: showStart
        ? {
            x: startPlace?.x ?? first.x,
            y: startPlace?.y ?? first.y,
            label: startLabel?.trim() || startPlace?.label || 'Start',
          }
        : null,
      end: showEnd
        ? {
            x: endPlace?.x ?? last.x,
            y: endPlace?.y ?? last.y,
            label: destinationLabel?.trim() || endPlace?.label || 'Destination',
          }
        : null,
    };
  }, [
    routePathPoints,
    placeMarkers,
    startLabel,
    destinationLabel,
    startMarkerId,
    destinationMarkerId,
    startFloor,
    destFloor,
    floor,
  ]);

  const legend =
    routePathPoints.length > 1 ? (
      <p className="guided-path-legend mt-2">
        <span>
          <span className="guided-legend-start" aria-hidden /> Green A = start
        </span>
        <span>
          <span className="guided-legend-end" aria-hidden /> Red B = destination
        </span>
        <span>
          <span className="guided-legend-corridor" aria-hidden /> Green = walking paths
        </span>
        {showStepProgress ? (
          <>
            <span>
              <span className="guided-legend-traveled" aria-hidden /> Red = completed
            </span>
            <span>
              <span className="guided-legend-route" aria-hidden /> Yellow = ahead
            </span>
          </>
        ) : (
          <span>
            <span className="guided-legend-route" aria-hidden /> Yellow = your route
          </span>
        )}
      </p>
    ) : null;

  const openFullscreen = () => {
    if (expandable) setFullscreen(true);
  };

  if (!imagePath) {
    return (
      <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No floor plan image for {floorLabel(floor)}.
      </p>
    );
  }

  const imageUrl = floorPlanImageUrl(imagePath);

  if (!navGraph) {
    return (
      <div className="fp-map-panel path-only-mode">
        <div className="fp-map-canvas fp-route-canvas">
          <img
            src={imageUrl}
            alt={floorLabel(floor)}
            draggable={false}
            className="fp-route-img"
          />
        </div>
      </div>
    );
  }

  const mapProps = {
    imageUrl,
    imageAlt: floorLabel(floor),
    nodes: navGraph.nodes,
    edges: navGraph.edges,
    routePath: routePathAhead,
    routePathTraveled,
    placeMarkers,
    routeStart: routeEndpoints.start,
    routeEnd: routeEndpoints.end,
    guideMode: true,
  };
  return (
    <>
      <div
        className={`indoor-route-map-view ${expandable ? 'is-expandable' : ''}`}
        role={expandable ? 'button' : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-label={expandable ? `Expand ${floorLabel(floor)} floor plan` : undefined}
        onClick={openFullscreen}
        onKeyDown={(e) => {
          if (expandable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            openFullscreen();
          }
        }}
      >
        <FloorPlanRouteMap {...mapProps} />
        {expandable && (
          <span className="fp-expand-badge" aria-hidden>
            <Maximize2 size={14} />
            Tap to enlarge
          </span>
        )}
        {legend}
      </div>

      {fullscreen &&
        createPortal(
          <div className="fp-fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Floor plan">
            <div className="fp-fullscreen-toolbar">
              <span className="fp-fullscreen-title">{floorLabel(floor)} · floor plan</span>
              <button
                type="button"
                className="fp-fullscreen-close"
                onClick={() => setFullscreen(false)}
              >
                <X size={18} />
                Close
              </button>
            </div>
            <div className="fp-fullscreen-body">
              <ZoomableFloorPlanMap
                focusPoints={routePathPoints}
                autoFitKey={`${buildingId}-${floor}-${routePathPoints.length}-${stepIndex ?? 0}`}
                hint="Scroll or pinch to zoom · drag to pan · Esc to close"
                className="fp-fullscreen-zoom"
              >
                <FloorPlanRouteMap {...mapProps} />
              </ZoomableFloorPlanMap>
              {legend}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
