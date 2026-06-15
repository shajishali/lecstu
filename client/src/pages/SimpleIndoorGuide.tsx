import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Navigation, Search } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';
import IndoorRouteMapView from '@components/IndoorRouteMapView';
import { firstStepIndexForFloor } from '@utils/routeStepProgress';
import {
  getBuildingsWithGuides,
  getGuidePlaces,
  postIndoorRoute,
  type IndoorRouteResult,
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

  const resultRef = useRef<HTMLDivElement>(null);

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
        const urlQ = searchParams.get('q');
        const defaultId =
          urlBid && list.some((b: Building) => b.id === urlBid)
            ? urlBid
            : guides[0]?.buildingId || list[0]?.id || '';

        setFromBuildingId(defaultId);
        setToBuildingId(defaultId);
        if (urlQ) setToQuery(urlQ);
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
  const showingDirections = Boolean(route?.found || loading);

  useEffect(() => {
    if (!route?.found) return;
    const t = window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    return () => window.clearTimeout(t);
  }, [route?.found]);

  const handleGuide = useCallback(
    async (placeOverride?: SelectablePlace) => {
      const dest = placeOverride || toPlace;
      const destName = dest?.name || toQuery.trim();
      if (!toBuildingId) {
        showToast('info', 'Please choose a building');
        return;
      }
      if (!destName) {
        showToast('info', 'Select a destination below or type a room name');
        return;
      }
      if (placeOverride) {
        setToPlaceId(placeOverride.id);
        setToQuery(placeOverride.name);
      }
      setLoading(true);
      setRoute(null);
      setStepIndex(0);
      setViewFloor(fromFloor);
      setViewBuildingId(fromBuildingId);
      try {
        const data = await postIndoorRoute({
          fromBuildingId,
          toBuildingId,
          fromFloor,
          floor: toFloor,
          fromMarkerId: fromPlace?.markerId,
          toMarkerId: dest?.markerId,
          q: dest?.markerId ? undefined : destName,
        });
        setRoute(data);
        if (data.found) {
          const via =
            data.crossBuilding && data.buildingPath?.length
              ? ` via ${data.buildingPath.join(' → ')}`
              : '';
          showToast('success', `Route to ${data.destinationLabel}${via}`);
        } else {
          showToast('info', data.message || 'No route found');
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
    ]
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

  return (
    <div className="find-my-way-page">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-900">
        <Navigation className="text-[var(--color-primary)]" size={22} />
        Find My Way
      </h1>
      <p className="mb-4 text-sm text-slate-600">
        Pick your start and destination — the floor plan appears when you get directions.
      </p>

      {showingDirections && (
        <div className="find-my-way-route-summary mb-4">
          <p className="text-sm text-slate-700">
            <span className="font-medium">{fromPlace?.name || 'Building entrance'}</span>
            <span className="mx-2 text-slate-400" aria-hidden>
              →
            </span>
            <span className="font-medium">
              {route?.destinationLabel || destinationLabel || '…'}
            </span>
          </p>
          {!loading && (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              setRoute(null);
              setStepIndex(0);
            }}
          >
            Change route
          </button>
          )}
        </div>
      )}

      {!showingDirections && (
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
                          if (idx >= 0) setStepIndex(idx);
                        }}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {stepList.length > 0 && (
                <div className="find-my-way-step-inline" aria-live="polite">
                  <div className="find-my-way-step-inline-head">
                    <p className="find-my-way-step-meta">
                      Step {stepIndex + 1} of {stepList.length}
                      <span className="find-my-way-step-floor">
                        · {floorLabel(stepList[stepIndex]?.floor ?? viewFloor)}
                      </span>
                    </p>
                    {stepList.length > 1 && (
                      <div className="find-my-way-step-nav">
                        <button
                          type="button"
                          disabled={stepIndex <= 0}
                          className="rounded-lg border px-3 py-1.5 text-xs disabled:opacity-40"
                          onClick={() => setStepIndex((i) => i - 1)}
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={stepIndex >= stepList.length - 1}
                          className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                          onClick={() => setStepIndex((i) => i + 1)}
                        >
                          Next step
                        </button>
                      </div>
                    )}
                  </div>
                  <p key={stepIndex} className="find-my-way-step-instruction">
                    {stepList[stepIndex]?.instruction}
                  </p>
                  {route.crossBuilding && route.buildingPath && route.buildingPath.length > 1 && (
                    <p className="find-my-way-step-route-meta">
                      {route.buildingPath.join(' → ')}
                      {route.distanceMeters != null && ` · ~${Math.round(route.distanceMeters)} m`}
                    </p>
                  )}
                </div>
              )}

              <IndoorRouteMapView
                buildingId={viewBuildingId || toBuildingId}
                floor={viewFloor}
                polyline={polylineForView}
                startLabel={fromPlace?.name || route.startLabel}
                destinationLabel={route.destinationLabel}
                startMarkerId={fromPlace?.markerId}
                destinationMarkerId={toPlace?.markerId}
                startFloor={routeStartFloor}
                destFloor={routeDestFloor}
                stepIndex={stepIndex}
                stepDetails={stepList}
              />
            </div>
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
