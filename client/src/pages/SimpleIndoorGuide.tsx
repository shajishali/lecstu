import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronLeft, ChevronRight, Navigation, QrCode, Search } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';
import IndoorRouteMapView from '@components/IndoorRouteMapView';
import { useActiveStepScroll } from '@hooks/useActiveStepScroll';
import { firstStepIndexForFloor } from '@utils/routeStepProgress';
import {
  getActiveNavigationSession,
  getBuildingsWithGuides,
  getGuidePlaces,
  getTodayIndoorRoutes,
  patchSessionStep,
  postIndoorRoute,
  type IndoorRouteResult,
  type TodayRoutesResult,
} from '@services/indoorNavApi';
import { showToast } from '@components/Toast';

interface Building {
  id: string;
  name: string;
  code: string;
  floors: number;
}

interface SelectablePlace {
  id: string;
  name: string;
  floor: number;
  markerId?: string;
}

type RouteStep = { instruction: string; floor: number; polylineIndex?: number };

type RouteView = { buildingId: string; floor: number; label: string };

function floorLabel(f: number) {
  return f === 0 ? 'Ground floor' : `Floor ${f}`;
}

function floorOptions(count: number) {
  return Array.from({ length: Math.max(1, count) }, (_, i) => i);
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

async function loadBuildingPlaces(buildingId: string): Promise<SelectablePlace[]> {
  const [guidePlaces, markersRes] = await Promise.all([
    getGuidePlaces(buildingId).catch(() => []),
    api.get('/map/markers', { params: { buildingId } }).catch(() => ({ data: { data: [] } })),
  ]);

  const byKey = new Map<string, SelectablePlace>();

  for (const p of guidePlaces as SelectablePlace[]) {
    const key = p.markerId || p.id;
    byKey.set(key, {
      id: p.id,
      name: p.name,
      floor: p.floor,
      markerId: p.markerId,
    });
  }

  for (const m of markersRes.data.data || []) {
    if (!byKey.has(m.id)) {
      byKey.set(m.id, {
        id: m.id,
        name: m.label,
        floor: m.floor,
        markerId: m.id,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.floor - b.floor || a.name.localeCompare(b.name)
  );
}

export default function SimpleIndoorGuide() {
  const [searchParams] = useSearchParams();
  const isTodayMode = searchParams.get('today') === '1';
  const legIndex = parseInt(searchParams.get('leg') || '0', 10);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [guidedBuildingIds, setGuidedBuildingIds] = useState<Set<string>>(new Set());

  const [fromBuildingId, setFromBuildingId] = useState('');
  const [fromFloor, setFromFloor] = useState(0);
  const [fromQuery, setFromQuery] = useState('');
  const [fromPlaceId, setFromPlaceId] = useState('');
  const [fromAllPlaces, setFromAllPlaces] = useState<SelectablePlace[]>([]);

  const [toBuildingId, setToBuildingId] = useState('');
  const [toFloor, setToFloor] = useState(0);
  const [toQuery, setToQuery] = useState('');
  const [toPlaceId, setToPlaceId] = useState('');
  const [toAllPlaces, setToAllPlaces] = useState<SelectablePlace[]>([]);

  const [loading, setLoading] = useState(false);
  const [route, setRoute] = useState<IndoorRouteResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [viewFloor, setViewFloor] = useState(0);
  const [viewBuildingId, setViewBuildingId] = useState('');
  const [todayRoutes, setTodayRoutes] = useState<TodayRoutesResult | null>(null);
  const [navSessionId, setNavSessionId] = useState<string | null>(null);
  const [positionLabel, setPositionLabel] = useState<string | null>(null);

  const { listRef, activeRef } = useActiveStepScroll(stepIndex);
  const resultRef = useRef<HTMLDivElement>(null);
  const autoRouteDone = useRef(false);
  const prevStepFloorRef = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [buildingsRes, guides] = await Promise.all([
          api.get('/map/buildings'),
          getBuildingsWithGuides().catch(() => []),
        ]);
        const list = buildingsRes.data.data || [];
        setBuildings(list);
        setGuidedBuildingIds(new Set(guides.map((g) => g.buildingId)));

        const urlBid = searchParams.get('buildingId');
        const urlQ =
          searchParams.get('q') ||
          searchParams.get('destination') ||
          searchParams.get('guide');
        const urlFloor = searchParams.get('floor');
        const defaultId =
          urlBid && list.some((b: Building) => b.id === urlBid)
            ? urlBid
            : guides[0]?.buildingId || list[0]?.id || '';

        setFromBuildingId(defaultId);
        setToBuildingId(defaultId);
        if (urlQ) setToQuery(urlQ);
        if (urlFloor) {
          const f = parseInt(urlFloor, 10);
          if (!Number.isNaN(f)) setToFloor(f);
        }
      } catch (err) {
        showApiErrorToast(err, 'Failed to load buildings');
      }
    })();
  }, [searchParams]);

  const refreshFromPlaces = useCallback(async () => {
    if (!fromBuildingId) return;
    try {
      setFromAllPlaces(await loadBuildingPlaces(fromBuildingId));
    } catch {
      setFromAllPlaces([]);
    }
  }, [fromBuildingId]);

  const refreshToPlaces = useCallback(async () => {
    if (!toBuildingId) return;
    try {
      setToAllPlaces(await loadBuildingPlaces(toBuildingId));
    } catch {
      setToAllPlaces([]);
    }
  }, [toBuildingId]);

  useEffect(() => {
    void refreshFromPlaces();
    setFromPlaceId('');
    setFromQuery('');
  }, [fromBuildingId, refreshFromPlaces]);

  useEffect(() => {
    void refreshToPlaces();
    setToPlaceId('');
  }, [toBuildingId, refreshToPlaces]);

  const fromBuilding = buildings.find((b) => b.id === fromBuildingId);
  const toBuilding = buildings.find((b) => b.id === toBuildingId);
  const fromPlace = fromAllPlaces.find((p) => p.id === fromPlaceId);
  const toPlace = toAllPlaces.find((p) => p.id === toPlaceId);

  const filterPlaces = useCallback(
    (all: SelectablePlace[], floor: number, query: string) => {
      const q = query.trim().toLowerCase();
      return all.filter((p) => {
        if (p.floor !== floor) return false;
        if (!q) return true;
        return p.name.toLowerCase().includes(q);
      });
    },
    []
  );

  const fromFiltered = useMemo(
    () => filterPlaces(fromAllPlaces, fromFloor, fromQuery),
    [fromAllPlaces, fromFloor, fromQuery, filterPlaces]
  );

  const toFiltered = useMemo(
    () => filterPlaces(toAllPlaces, toFloor, toQuery),
    [toAllPlaces, toFloor, toQuery, filterPlaces]
  );

  const stepList: RouteStep[] = useMemo(() => {
    if (!route?.steps?.length) return [];
    return route.steps.map((s) =>
      typeof s === 'string' ? { instruction: s, floor: 0 } : s
    );
  }, [route]);

  const setStepWithSession = useCallback(
    (next: number | ((prev: number) => number)) => {
      setStepIndex((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (navSessionId) {
          void patchSessionStep(navSessionId, value).catch(() => {});
        }
        return value;
      });
    },
    [navSessionId]
  );

  useEffect(() => {
    if (isTodayMode || searchParams.get('scanned') === '1') return;
    void (async () => {
      if (!toBuildingId) return;
      try {
        const session = await getActiveNavigationSession(toBuildingId);
        if (session?.positionSource === 'QR_CODE' && session.currentNodeId) {
          setNavSessionId(session.id);
          const payload = session.routePayload as IndoorRouteResult | undefined;
          if (payload?.startLabel) setPositionLabel(payload.startLabel);
        }
      } catch {
        /* no active session */
      }
    })();
  }, [toBuildingId, isTodayMode, searchParams]);

  useEffect(() => {
    if (searchParams.get('scanned') !== '1') return;
    void (async () => {
      const bid = searchParams.get('buildingId') || toBuildingId;
      if (!bid) return;
      try {
        const session = await getActiveNavigationSession(bid);
        if (!session) return;
        setNavSessionId(session.id);
        setFromBuildingId(session.buildingId);
        if (session.currentFloor != null) setFromFloor(session.currentFloor);
        const payload = session.routePayload as IndoorRouteResult | null;
        if (payload?.found) {
          setRoute(payload);
          setStepIndex(session.stepIndex ?? 0);
          setViewBuildingId(session.buildingId);
          setViewFloor(session.currentFloor ?? payload.startFloor ?? 0);
          if (payload.startLabel) setPositionLabel(payload.startLabel);
          showToast('success', `Position updated — continuing to ${payload.destinationLabel}`);
        }
      } catch (err) {
        showApiErrorToast(err, 'Could not restore navigation session');
      }
    })();
  }, [searchParams, toBuildingId]);

  useEffect(() => {
    const floor = stepList[stepIndex]?.floor;
    if (floor == null) return;
    if (
      prevStepFloorRef.current != null &&
      floor !== prevStepFloorRef.current &&
      navSessionId
    ) {
      void patchSessionStep(navSessionId, stepIndex).catch(() => {});
    }
    prevStepFloorRef.current = floor;
  }, [stepIndex, stepList, navSessionId]);

  const routeStartFloor = route?.startFloor ?? fromFloor;
  const routeDestFloor = route?.marker?.floor ?? toFloor;

  const buildingNameById = useMemo(
    () => new Map(buildings.map((b) => [b.id, b.name])),
    [buildings]
  );

  const routeViews = useMemo((): RouteView[] => {
    if (!route?.found) return [];

    if (route.segments?.length) {
      return route.segments.map((s) => ({
        buildingId: s.buildingId,
        floor: s.floor,
        label: `${buildingNameById.get(s.buildingId) ?? 'Building'} · ${floorLabel(s.floor)}`,
      }));
    }

    if (route.polyline?.length) {
      const seen = new Set<string>();
      const views: RouteView[] = [];
      for (const p of route.polyline) {
        const bid = p.buildingId || toBuildingId;
        const key = `${bid}-${p.floor}`;
        if (!seen.has(key)) {
          seen.add(key);
          views.push({
            buildingId: bid,
            floor: p.floor,
            label: `${buildingNameById.get(bid) ?? 'Building'} · ${floorLabel(p.floor)}`,
          });
        }
      }
      return views;
    }

    return [
      {
        buildingId: toBuildingId,
        floor: toFloor,
        label: `${buildingNameById.get(toBuildingId) ?? 'Building'} · ${floorLabel(toFloor)}`,
      },
    ];
  }, [route, toBuildingId, toFloor, buildingNameById]);

  const polylineForView = useMemo(() => route?.polyline ?? [], [route]);

  const buildingBanner = useMemo(() => {
    const step = stepList[stepIndex];
    if (!step) return null;
    const enter = step.instruction.match(/^Enter (.+)$/);
    if (enter) return { kind: 'enter' as const, label: enter[1] };
    const exit = step.instruction.match(/^Exit (.+)$/);
    if (exit) return { kind: 'exit' as const, label: exit[1] };
    return null;
  }, [stepList, stepIndex]);

  const activeTodayLeg = isTodayMode ? todayRoutes?.legs[legIndex] ?? todayRoutes?.legs[0] : null;

  useEffect(() => {
    if (!route?.found) return;
    const step = stepList[stepIndex];
    if (step) {
      setViewFloor(step.floor);
      const polyIdx = step.polylineIndex ?? 0;
      const pt = route.polyline?.[polyIdx];
      if (pt?.buildingId) {
        setViewBuildingId(pt.buildingId);
      } else {
        const seg = route.segments?.find((s) => s.floor === step.floor);
        if (seg) setViewBuildingId(seg.buildingId);
        else if (stepIndex === 0) setViewBuildingId(fromBuildingId);
        else setViewBuildingId(toBuildingId);
      }
    } else {
      setViewFloor(fromFloor);
      setViewBuildingId(fromBuildingId);
    }
  }, [route, stepIndex, stepList, fromFloor, fromBuildingId, toBuildingId]);

  const destinationLabel = toPlace?.name || toQuery.trim();
  const canGuide = Boolean(toBuildingId && destinationLabel);
  const showingDirections = Boolean(isTodayMode || route?.found || loading);

  useEffect(() => {
    if (!isTodayMode) return;
    void (async () => {
      setLoading(true);
      setRoute(null);
      setStepIndex(0);
      try {
        const data = await getTodayIndoorRoutes();
        setTodayRoutes(data);
        const leg = data.legs[legIndex] ?? data.legs[0];
        if (!leg) return;
        setRoute(leg.route);
        if (leg.mapBuildingId) {
          setToBuildingId(leg.mapBuildingId);
          setFromBuildingId(leg.mapBuildingId);
          setToFloor(leg.hall.floor ?? 0);
          const seg = leg.route.segments?.[0];
          const floor = seg?.floor ?? leg.hall.floor ?? 0;
          setViewFloor(floor);
          setViewBuildingId(leg.mapBuildingId);
        }
      } catch (err) {
        showApiErrorToast(err, "Failed to load today's routes");
      } finally {
        setLoading(false);
      }
    })();
  }, [isTodayMode, legIndex]);

  useEffect(() => {
    if (!route?.found) return;
    const t = window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [route?.found]);

  const fetchRoute = useCallback(
    async (opts?: {
      placeOverride?: SelectablePlace;
      toHallId?: string;
      toMarkerId?: string;
      silent?: boolean;
    }) => {
      const dest = opts?.placeOverride || toPlace;
      const destName = dest?.name || toQuery.trim();
      const hallId = opts?.toHallId;
      const markerId = opts?.toMarkerId || dest?.markerId;
      if (!toBuildingId) {
        if (!opts?.silent) showToast('info', 'Please choose a building');
        return;
      }
      if (!hallId && !markerId && !destName) {
        if (!opts?.silent) showToast('info', 'Select a destination below or type a room name');
        return;
      }
      if (opts?.placeOverride) {
        setToPlaceId(opts.placeOverride.id);
        setToQuery(opts.placeOverride.name);
      }
      setLoading(true);
      setRoute(null);
      setStepIndex(0);
      setViewFloor(fromFloor);
      setViewBuildingId(fromBuildingId);
      const useQrStart = Boolean(navSessionId || positionLabel);
      try {
        const data = await postIndoorRoute({
          fromBuildingId,
          toBuildingId,
          fromFloor,
          floor: toFloor,
          fromMarkerId: useQrStart ? undefined : fromPlace?.markerId,
          toMarkerId: markerId,
          toHallId: hallId,
          q: !hallId && !markerId ? destName : undefined,
          saveSession: true,
          useActivePosition: useQrStart,
          sessionId: navSessionId || undefined,
        });
        setRoute(data);
        if (data.sessionId) setNavSessionId(data.sessionId);
        if (data.startLabel && useQrStart) setPositionLabel(data.startLabel);
        if (!opts?.silent) {
          if (data.found) {
            const via =
              data.crossBuilding && data.buildingPath?.length
                ? ` via ${data.buildingPath.join(' → ')}`
                : '';
            showToast('success', `Route to ${data.destinationLabel}${via}`);
          } else {
            showToast('info', data.message || 'No route found');
          }
        }
      } catch (err) {
        showApiErrorToast(err, 'Could not get directions');
      } finally {
        setLoading(false);
      }
    },
    [
      fromBuildingId,
      fromFloor,
      fromPlace,
      toBuildingId,
      toFloor,
      toPlace,
      toQuery,
      navSessionId,
      positionLabel,
    ]
  );

  useEffect(() => {
    if (autoRouteDone.current || isTodayMode || !buildings.length || !toBuildingId) return;
    const hallId = searchParams.get('hallId') || searchParams.get('toHallId') || '';
    const markerId = searchParams.get('markerId') || searchParams.get('toMarkerId') || '';
    const q =
      searchParams.get('q') ||
      searchParams.get('destination') ||
      searchParams.get('guide') ||
      '';
    if (!hallId && !markerId && !q) return;
    autoRouteDone.current = true;
    void fetchRoute({
      toHallId: hallId || undefined,
      toMarkerId: markerId || undefined,
      silent: true,
    });
  }, [buildings.length, toBuildingId, isTodayMode, searchParams, fetchRoute]);

  const handleGuide = useCallback(
    async (placeOverride?: SelectablePlace) => fetchRoute({ placeOverride }),
    [fetchRoute]
  );

  const pickToPlace = (p: SelectablePlace) => {
    setToPlaceId(p.id);
    setToQuery(p.name);
  };

  const pickFromPlace = (p: SelectablePlace) => {
    setFromPlaceId(p.id);
    setFromQuery(p.name);
  };

  const selectClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm';
  const activeViewKey = `${viewBuildingId}-${viewFloor}`;

  const stepsPanel =
    stepList.length > 0 ? (
      <>
        <p className="guided-step-counter">
          Step {stepIndex + 1} of {stepList.length}
          <span className="find-my-way-step-floor">
            {' '}
            · {floorLabel(stepList[stepIndex]?.floor ?? viewFloor)}
          </span>
        </p>
        <p className="guided-current-step">{stepList[stepIndex]?.instruction}</p>
        <ol ref={listRef} className="guided-step-list">
          {stepList.map((step, i) => (
            <li
              key={i}
              ref={i === stepIndex ? activeRef : undefined}
              className={i === stepIndex ? 'active' : ''}
              onClick={() => setStepWithSession(i)}
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
            onClick={() => setStepWithSession((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          <button
            type="button"
            disabled={stepIndex >= stepList.length - 1}
            onClick={() => setStepWithSession((i) => Math.min(stepList.length - 1, i + 1))}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      </>
    ) : null;

  return (
    <div
      className={`find-my-way-page${route?.found && stepList.length > 0 ? ' has-mobile-sheet' : ''}`}
    >
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-900">
        <Navigation className="text-[var(--color-primary)]" size={22} />
        {isTodayMode ? "Today's routes" : 'Find My Way'}
      </h1>
      <p className="mb-4 text-sm text-slate-600">
        {isTodayMode
          ? 'Step through each class — floor plans and walking directions update as you go.'
          : 'Pick your start and destination — the floor plan appears when you get directions.'}
      </p>

      {isTodayMode && todayRoutes && todayRoutes.legs.length > 1 && (
        <div className="find-my-way-today-tabs" role="tablist">
          {todayRoutes.legs.map((leg, i) => (
            <Link
              key={leg.slotId}
              to={`/navigate?today=1&leg=${i}`}
              role="tab"
              aria-selected={i === legIndex}
              className={i === legIndex ? 'active' : ''}
            >
              {formatTime(leg.startTime)} · {leg.courseName}
            </Link>
          ))}
        </div>
      )}

      {isTodayMode && activeTodayLeg && (
        <div className="find-my-way-route-summary mb-4">
          <p className="text-sm text-slate-700">
            <span className="font-medium">{formatTime(activeTodayLeg.startTime)}</span>
            <span className="mx-2 text-slate-400" aria-hidden>
              ·
            </span>
            <span className="font-medium">{activeTodayLeg.courseName}</span>
            <span className="mx-2 text-slate-400" aria-hidden>
              →
            </span>
            <span className="font-medium">{activeTodayLeg.hall.name}</span>
          </p>
        </div>
      )}

      {showingDirections && (
        <div className="find-my-way-route-summary mb-4">
          <p className="text-sm text-slate-700">
            <span className="font-medium">
              {positionLabel || fromPlace?.name || 'Building entrance'}
            </span>
            <span className="mx-2 text-slate-400" aria-hidden>
              →
            </span>
            <span className="font-medium">
              {route?.destinationLabel || destinationLabel || '…'}
            </span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {route?.found && !isTodayMode && (
              <Link
                to={`/navigate/scan?buildingId=${toBuildingId}&returnTo=${encodeURIComponent('/navigate')}`}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
              >
                <QrCode size={14} />
                Scan QR
              </Link>
            )}
            {!loading && (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setRoute(null);
                  setStepIndex(0);
                  setNavSessionId(null);
                  setPositionLabel(null);
                }}
              >
                Change route
              </button>
            )}
          </div>
        </div>
      )}

      {positionLabel && route?.found && (
        <p className="find-my-way-position-banner mb-4" role="status">
          You are here: <strong>{positionLabel}</strong>
          <span className="text-slate-500"> — scan again anytime to recalculate your route</span>
        </p>
      )}

      {!showingDirections && !isTodayMode && (
      <div className="find-my-way-form">
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">From</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Building</span>
              <select
                className={selectClass}
                value={fromBuildingId}
                onChange={(e) => {
                  const id = e.target.value;
                  setFromBuildingId(id);
                  const b = buildings.find((x) => x.id === id);
                  if (b) setFromFloor(0);
                }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {guidedBuildingIds.has(b.id) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Floor</span>
              <select
                className={selectClass}
                value={fromFloor}
                onChange={(e) => {
                  setFromFloor(parseInt(e.target.value, 10));
                  setFromPlaceId('');
                }}
              >
                {floorOptions(fromBuilding?.floors ?? 1).map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mb-2 block text-sm">
            <span className="mb-1 block font-medium">Where are you? (optional)</span>
            <input
              className={selectClass}
              placeholder="Search start place — or leave blank for entrance"
              value={fromQuery}
              onChange={(e) => {
                setFromQuery(e.target.value);
                setFromPlaceId('');
              }}
            />
          </label>
          {fromFiltered.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {fromFiltered.slice(0, 12).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickFromPlace(p)}
                  className={`rounded-full border px-3 py-1 text-xs ${
                    fromPlaceId === p.id
                      ? 'border-[var(--color-primary)] bg-red-50 text-[var(--color-primary)]'
                      : 'border-slate-200 bg-slate-50 hover:border-[var(--color-primary)]'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4 flex justify-center text-slate-400">
          <ArrowRight size={20} aria-hidden />
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">To</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Building</span>
              <select
                className={selectClass}
                value={toBuildingId}
                onChange={(e) => {
                  const id = e.target.value;
                  setToBuildingId(id);
                  const b = buildings.find((x) => x.id === id);
                  if (b) setToFloor(0);
                }}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {guidedBuildingIds.has(b.id) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Floor</span>
              <select
                className={selectClass}
                value={toFloor}
                onChange={(e) => {
                  setToFloor(parseInt(e.target.value, 10));
                  setToPlaceId('');
                }}
              >
                {floorOptions(toBuilding?.floors ?? 1).map((f) => (
                  <option key={f} value={f}>
                    {floorLabel(f)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mb-2 block text-sm">
            <span className="mb-1 block font-medium">Where do you want to go?</span>
            <div className="flex gap-2">
              <input
                className={`${selectClass} flex-1`}
                placeholder="e.g. cafeteria, lecture room"
                value={toQuery}
                onChange={(e) => {
                  setToQuery(e.target.value);
                  setToPlaceId('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && void handleGuide()}
              />
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleGuide()}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-white disabled:opacity-50"
              >
                <Search size={18} />
              </button>
            </div>
          </label>
          {toFiltered.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                Places on {floorLabel(toFloor)}
              </p>
              <div className="flex flex-wrap gap-2">
                {toFiltered.slice(0, 12).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pickToPlace(p)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      toPlaceId === p.id
                        ? 'border-[var(--color-primary)] bg-red-50 text-[var(--color-primary)]'
                        : 'border-slate-200 bg-slate-50 hover:border-[var(--color-primary)]'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={() => void handleGuide()}
          className="mb-2 w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Finding route…' : 'Get directions'}
        </button>
        {!canGuide && !loading && (
          <p className="text-center text-xs text-slate-500">
            Select a place above or type a destination to get directions
          </p>
        )}
      </div>
      )}

      {loading && !route?.found && (
        <div className="find-my-way-loading mb-4 rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-700">Finding your route…</p>
          <p className="mt-1 text-xs text-slate-500">Floor plan and directions will appear here</p>
        </div>
      )}

      {route?.found && (
        <div ref={resultRef} className="find-my-way-result">
          <div className="find-my-way-body">
            <div className="find-my-way-map">
              {buildingBanner && (
                <div className="find-my-way-building-banner" role="status">
                  {buildingBanner.kind === 'enter'
                    ? `Now entering ${buildingBanner.label}`
                    : `Leaving ${buildingBanner.label}`}
                </div>
              )}

              {routeViews.length > 1 && (
                <div className="find-my-way-floor-tabs" role="tablist">
                  {routeViews.map((v) => {
                    const key = `${v.buildingId}-${v.floor}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={key === activeViewKey}
                        className={key === activeViewKey ? 'active' : ''}
                        onClick={() => {
                          setViewBuildingId(v.buildingId);
                          setViewFloor(v.floor);
                          const idx = firstStepIndexForFloor(
                            stepList,
                            v.floor,
                            v.buildingId,
                            route.polyline
                          );
                          if (idx >= 0) setStepWithSession(idx);
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}

              <IndoorRouteMapView
                buildingId={viewBuildingId || toBuildingId}
                floor={viewFloor}
                polyline={polylineForView}
                startLabel={fromPlace?.name || route.startLabel}
                destinationLabel={route.destinationLabel}
                startMarkerId={fromPlace?.markerId}
                destinationMarkerId={toPlace?.markerId || route.marker?.id}
                startFloor={routeStartFloor}
                destFloor={routeDestFloor}
                stepIndex={stepIndex}
                stepDetails={stepList}
              />
            </div>

            {stepsPanel && (
              <aside className="find-my-way-steps-panel" aria-label="Turn-by-turn directions">
                {stepsPanel}
              </aside>
            )}
          </div>
        </div>
      )}

      {route && !route.found && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {route.message}
        </div>
      )}
    </div>
  );
}
