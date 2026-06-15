import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Navigation } from 'lucide-react';
import {
  parseDrawableRegion,
  storageToDisplayCoord,
  transformPolylineForDisplay,
  type FloorPlanDrawableRegion,
} from '@utils/floorPlanMapRegion';

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

interface RouteStep {
  instruction: string;
  floor: number;
}

interface RouteSegment {
  buildingId: string;
  floor: number;
  polyline: [number, number][];
}

interface IndoorRoute {
  found: boolean;
  message?: string;
  destinationLabel?: string;
  building?: { id: string; name: string; code: string };
  hall?: { id: string; name: string } | null;
  marker?: { id: string; label: string; floor: number } | null;
  steps: RouteStep[];
  segments: RouteSegment[];
  polyline?: { x: number; y: number; floor: number }[];
  deepLink?: string | null;
  confidence?: number;
  directionEngine?: string;
  adminFix?: {
    roomMarkers: string;
    walkingPaths: string;
    buildings: string;
  };
}

interface TodayLeg {
  slotId: string;
  startTime: string;
  endTime: string;
  courseName: string;
  lecturerName: string;
  hall: { id: string; name: string; building: string; floor: number };
  mapBuildingId: string | null;
  route: IndoorRoute;
}

interface TodayRoutes {
  legs: TodayLeg[];
  deepLinkAll: string;
  hasCrossBuilding: boolean;
}

interface MapBuilding {
  id: string;
  name: string;
  code: string;
  floors: number;
  floorPlans: { floor: number; imagePath: string; bounds: unknown; drawableRegion?: unknown }[];
}

interface MapMarker {
  id: string;
  x: number;
  y: number;
  floor: number;
  label: string;
  type: string;
  hallId: string | null;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

export default function GuidedMap() {
  const [searchParams] = useSearchParams();
  const isTodayMode = searchParams.get('today') === '1';
  const legIndex = parseInt(searchParams.get('leg') || '0', 10);

  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [todayRoutes, setTodayRoutes] = useState<TodayRoutes | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [viewFloor, setViewFloor] = useState(0);
  const [pickDestination, setPickDestination] = useState('');

  const buildingId = searchParams.get('buildingId') || '';
  const hallId = searchParams.get('hallId') || '';
  const markerId = searchParams.get('markerId') || '';
  const destination = searchParams.get('destination') || '';

  const activeLeg = isTodayMode && todayRoutes?.legs[legIndex] ? todayRoutes.legs[legIndex] : null;
  const effectiveBuildingId = activeLeg?.mapBuildingId || buildingId;
  const effectiveBuilding = buildings.find((b) => b.id === effectiveBuildingId);
  const floorPlan = effectiveBuilding?.floorPlans?.find((fp) => fp.floor === viewFloor);
  const drawableRegion: FloorPlanDrawableRegion = parseDrawableRegion(floorPlan?.drawableRegion);
  const activeRoute = activeLeg?.route ?? route;

  const destMarker = useMemo(() => {
    if (!markerId) return markers.find((m) => m.hallId === hallId) ?? null;
    return markers.find((m) => m.id === markerId) ?? null;
  }, [markers, markerId, hallId]);

  const loadBuildings = useCallback(async () => {
    const res = await api.get('/map/buildings');
    setBuildings(res.data.data || []);
  }, []);

  const loadRoute = useCallback(async () => {
    if (isTodayMode) {
      const res = await api.get('/map/indoor-route/today');
      const data = res.data.data as TodayRoutes;
      setTodayRoutes(data);
      const leg = data.legs[legIndex] ?? data.legs[0];
      if (leg) {
        setRoute(leg.route);
        if (leg.mapBuildingId) {
          const seg = leg.route.segments?.[0];
          setViewFloor(seg?.floor ?? leg.hall.floor ?? 0);
        }
      }
      return;
    }

    if (!buildingId && !hallId && !markerId) {
      setRoute(null);
      return;
    }

    const params: Record<string, string | number> = {};
    if (buildingId) params.buildingId = buildingId;
    if (hallId) params.toHallId = hallId;
    if (markerId) params.toMarkerId = markerId;
    if (searchParams.get('floor')) params.floor = parseInt(searchParams.get('floor')!, 10);

    const res = await api.get('/map/indoor-route', { params });
    const data = res.data.data as IndoorRoute;
    setRoute(data);
    const floor =
      parseInt(searchParams.get('floor') || '', 10) ||
      data.marker?.floor ||
      data.segments?.[data.segments.length - 1]?.floor ||
      0;
    setViewFloor(floor);
  }, [buildingId, hallId, markerId, isTodayMode, legIndex, searchParams]);

  const loadMarkers = useCallback(async () => {
    const bid = activeLeg?.mapBuildingId || buildingId;
    if (!bid) return;
    const res = await api.get('/map/markers', {
      params: { buildingId: bid, floor: viewFloor },
    });
    setMarkers(res.data.data || []);
  }, [buildingId, viewFloor, activeLeg?.mapBuildingId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadBuildings();
        await loadRoute();
      } catch (err) {
        showApiErrorToast(err, 'Failed to load route');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadBuildings, loadRoute]);

  useEffect(() => {
    void loadMarkers();
  }, [loadMarkers]);

  useEffect(() => {
    if (!activeRoute?.steps?.length) return;
    const step = activeRoute.steps[stepIndex];
    if (step && step.floor !== viewFloor) setViewFloor(step.floor);
  }, [stepIndex, activeRoute?.steps, viewFloor]);

  const startPoint = useMemo(() => {
    const pts = activeRoute?.polyline?.filter((p) => p.floor === viewFloor) ?? [];
    return pts[0] ?? null;
  }, [activeRoute?.polyline, viewFloor]);

  const handleDestinationPick = useCallback(
    async (marker: MapMarker) => {
      if (!effectiveBuildingId) return;
      setLoading(true);
      try {
        const res = await api.get('/map/indoor-route', {
          params: {
            buildingId: effectiveBuildingId,
            toMarkerId: marker.id,
            floor: marker.floor,
          },
        });
        setRoute(res.data.data as IndoorRoute);
        setViewFloor(marker.floor);
        setStepIndex(0);
      } catch (err) {
        showApiErrorToast(err, 'Failed to load route');
      } finally {
        setLoading(false);
      }
    },
    [effectiveBuildingId]
  );

  const floorSegments = useMemo(() => {
    const rawPts =
      activeRoute?.segments?.length
        ? (activeRoute.segments.find((s) => s.floor === viewFloor)?.polyline.map(([x, y]) => ({
            x,
            y,
          })) ?? [])
        : (activeRoute?.polyline?.filter((p) => p.floor === viewFloor).map((p) => ({ x: p.x, y: p.y })) ??
          []);

    if (rawPts.length === 0) return '';
    return transformPolylineForDisplay(rawPts, drawableRegion);
  }, [activeRoute, viewFloor, drawableRegion]);

  const polylinePoints = floorSegments;

  const startDisplay = useMemo(() => {
    if (!startPoint) return null;
    return storageToDisplayCoord(startPoint.x, startPoint.y, drawableRegion);
  }, [startPoint, drawableRegion]);

  const destDisplay = useMemo(() => {
    if (!destMarker || destMarker.floor !== viewFloor) return null;
    return storageToDisplayCoord(destMarker.x, destMarker.y, drawableRegion);
  }, [destMarker, viewFloor, drawableRegion]);

  const imageUrl = floorPlan?.imagePath
    ? floorPlan.imagePath.startsWith('http')
      ? floorPlan.imagePath
      : `${window.location.origin}${floorPlan.imagePath}`
    : '';

  const title =
    activeRoute?.destinationLabel ||
    destination ||
    activeLeg?.hall.name ||
    'Guided route';

  const floorsWithPlans = effectiveBuilding?.floorPlans?.map((fp) => fp.floor) ?? [];

  if (loading) {
    return (
      <div className="guided-map-page flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading guided map…</p>
      </div>
    );
  }

  return (
    <div className="guided-map-page">
      <header className="guided-map-header">
        <Link to="/map" className="guided-back">
          <ArrowLeft size={18} /> Campus Map
        </Link>
        <div className="guided-title-row">
          <Navigation size={22} className="text-[var(--color-primary)]" />
          <div>
            <h1>{title}</h1>
            <p className="guided-sub">
              {effectiveBuilding?.name ?? 'Building'} · {floorLabel(viewFloor)}
              {activeLeg && (
                <span>
                  {' '}
                  · {formatTime(activeLeg.startTime)} {activeLeg.courseName}
                </span>
              )}
            </p>
          </div>
        </div>
        {isTodayMode && todayRoutes && todayRoutes.legs.length > 1 && (
          <div className="guided-leg-tabs">
            {todayRoutes.legs.map((leg, i) => (
              <Link
                key={leg.slotId}
                to={`/map/guide?today=1&leg=${i}`}
                className={i === legIndex ? 'active' : ''}
              >
                {formatTime(leg.startTime)}
              </Link>
            ))}
          </div>
        )}
        {floorsWithPlans.length > 1 && (
          <select
            className="guided-floor-select"
            value={viewFloor}
            onChange={(e) => setViewFloor(parseInt(e.target.value, 10))}
          >
            {floorsWithPlans.map((f) => (
              <option key={f} value={f}>
                {floorLabel(f)}
              </option>
            ))}
          </select>
        )}
        {!isTodayMode && markers.length > 0 && (
          <select
            className="guided-floor-select"
            value={pickDestination}
            onChange={(e) => {
              const id = e.target.value;
              setPickDestination(id);
              const m = markers.find((mk) => mk.id === id);
              if (m) void handleDestinationPick(m);
            }}
          >
            <option value="">Pick destination…</option>
            {markers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({floorLabel(m.floor)})
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="guided-map-body">
        <div className="guided-canvas-wrap">
          {imageUrl ? (
            <div className="guided-canvas guided-canvas-map">
              <div
                className="guided-map-viewport"
                style={
                  { ['--map-y1' as string]: `${drawableRegion.y1}%` } as React.CSSProperties
                }
              >
                <img src={imageUrl} alt={floorLabel(viewFloor)} draggable={false} />
                {polylinePoints && (
                  <svg className="guided-path-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polyline className="guided-path-line" fill="none" points={polylinePoints} />
                  </svg>
                )}
                {startDisplay?.inRegion && (
                  <span
                    className="guided-start-pin"
                    style={{ left: `${startDisplay.x}%`, top: `${startDisplay.y}%` }}
                    title="You are here"
                  >
                    <Navigation size={14} />
                  </span>
                )}
                {destDisplay?.inRegion && (
                  <span
                    className="guided-dest-pin"
                    style={{ left: `${destDisplay.x}%`, top: `${destDisplay.y}%` }}
                    title={destMarker?.label}
                  >
                    <MapPin size={14} />
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="guided-no-image">
              <p>No floor plan for {floorLabel(viewFloor)}.</p>
              <Link to="/admin/buildings" className="text-sm font-medium text-[var(--color-primary)]">
                Upload in Admin → Buildings
              </Link>
            </div>
          )}
        </div>

        <aside className="guided-steps-panel">
          {!activeRoute?.found ? (
            <div className="guided-error">
              <p>{activeRoute?.message || 'Route not available.'}</p>
              {activeRoute?.adminFix && (
                <ul className="guided-admin-links">
                  <li>
                    <Link to={activeRoute.adminFix.roomMarkers}>Place room on map</Link>
                  </li>
                  <li>
                    <Link to={activeRoute.adminFix.walkingPaths}>Draw walking paths</Link>
                  </li>
                  <li>
                    <Link to={activeRoute.adminFix.buildings}>Upload floor plans</Link>
                  </li>
                </ul>
              )}
            </div>
          ) : (
            <>
              <p className="guided-step-counter">
                Step {stepIndex + 1} of {activeRoute.steps.length}
                {activeRoute.directionEngine && (
                  <span className="guided-ai-badge"> · AI directions</span>
                )}
              </p>
              <p className="guided-current-step">{activeRoute.steps[stepIndex]?.instruction}</p>
              <ol className="guided-step-list">
                {activeRoute.steps.map((step, i) => (
                  <li
                    key={i}
                    className={i === stepIndex ? 'active' : ''}
                    onClick={() => setStepIndex(i)}
                  >
                    <span className="guided-step-num">{i + 1}</span>
                    {step.instruction}
                  </li>
                ))}
              </ol>
              <div className="guided-step-nav">
                <button
                  type="button"
                  disabled={stepIndex <= 0}
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                >
                  <ChevronLeft size={18} /> Previous
                </button>
                <button
                  type="button"
                  disabled={stepIndex >= activeRoute.steps.length - 1}
                  onClick={() =>
                    setStepIndex((i) => Math.min(activeRoute.steps.length - 1, i + 1))
                  }
                >
                  Next <ChevronRight size={18} />
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
