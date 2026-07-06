import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navigation, Search } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';
import { loadBuildingPlaces, type SelectablePlace } from '@services/indoorNavApi';
import {
  buildDashboardNavigateUrl,
  DASHBOARD_NAV_FROM_BUILDING_CODE,
  findBuildingByCode,
} from '@utils/dashboardNavigation';

interface MapBuilding {
  id: string;
  name: string;
  code: string;
  floors: number;
}

function floorLabel(f: number) {
  return f === 0 ? 'Ground floor' : `Floor ${f}`;
}

function floorOptionsForBuilding(building: MapBuilding | undefined, places: SelectablePlace[]) {
  const fromPlaces = [...new Set(places.map((p) => p.floor))].sort((a, b) => a - b);
  if (fromPlaces.length > 0) return fromPlaces;
  const count = building?.floors ?? 1;
  return Array.from({ length: Math.max(1, count) }, (_, i) => i);
}

export default function IndoorNavigationPanel() {
  const navigate = useNavigate();
  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const [places, setPlaces] = useState<SelectablePlace[]>([]);
  const [buildingId, setBuildingId] = useState('');
  const [floor, setFloor] = useState(0);
  const [selectedPlaceId, setSelectedPlaceId] = useState('');
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === buildingId),
    [buildings, buildingId],
  );

  const adminBuilding = useMemo(
    () => findBuildingByCode(buildings, DASHBOARD_NAV_FROM_BUILDING_CODE),
    [buildings],
  );

  const floorOptions = useMemo(
    () => floorOptionsForBuilding(selectedBuilding, places),
    [selectedBuilding, places],
  );

  const placesOnFloor = useMemo(
    () => places.filter((p) => p.floor === floor).sort((a, b) => a.name.localeCompare(b.name)),
    [places, floor],
  );

  const selectedPlace = useMemo(
    () => placesOnFloor.find((p) => p.id === selectedPlaceId) ?? null,
    [placesOnFloor, selectedPlaceId],
  );

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.get('/map/buildings');
        const list = res.data.data || [];
        setBuildings(list);
        if (list[0]) setBuildingId(list[0].id);
      } catch (err) {
        showApiErrorToast(err, 'Failed to load buildings');
      }
    })();
  }, []);

  useEffect(() => {
    if (!buildingId) return;
    setSelectedPlaceId('');
    setFloor(0);
    setLoadingPlaces(true);
    void loadBuildingPlaces(buildingId)
      .then((data) => setPlaces(data || []))
      .catch(() => setPlaces([]))
      .finally(() => setLoadingPlaces(false));
  }, [buildingId]);

  useEffect(() => {
    if (floorOptions.length === 0) return;
    setFloor((current) => (floorOptions.includes(current) ? current : floorOptions[0]));
  }, [floorOptions]);

  useEffect(() => {
    setSelectedPlaceId('');
  }, [floor, buildingId]);

  const handleNavigate = useCallback(() => {
    if (!selectedPlace || !buildingId) return;
    if (!adminBuilding) {
      showApiErrorToast(new Error('Administration Building not configured'), 'Navigation unavailable');
      return;
    }

    setLoading(true);
    navigate(
      buildDashboardNavigateUrl({
        fromBuildingId: adminBuilding.id,
        toBuildingId: buildingId,
        destination: selectedPlace.name,
        toFloor: selectedPlace.floor,
        toMarkerId: selectedPlace.markerId,
      }),
    );
    setLoading(false);
  }, [adminBuilding, buildingId, navigate, selectedPlace]);

  const selectClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]';

  return (
    <section className="nav-panel rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Navigation size={20} className="text-[var(--color-primary)]" />
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Indoor Navigation</h2>
          <p className="text-sm text-slate-500">Clear walking directions inside the building</p>
        </div>
      </div>

      {buildings.length > 0 && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Building</span>
            <select
              className={selectClass}
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">Floor</span>
            <select
              className={selectClass}
              value={floor}
              disabled={loadingPlaces}
              onChange={(e) => setFloor(parseInt(e.target.value, 10))}
            >
              {floorOptions.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-slate-600">Where do you want to go?</span>
        <div className="flex gap-2">
          <select
            className={`min-w-0 flex-1 ${selectClass}`}
            value={selectedPlaceId}
            disabled={loadingPlaces}
            onChange={(e) => setSelectedPlaceId(e.target.value)}
          >
            <option value="">
              {loadingPlaces
                ? 'Loading places…'
                : placesOnFloor.length === 0
                  ? `No places on ${floorLabel(floor)}`
                  : 'Select a place'}
            </option>
            {placesOnFloor.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={loading || loadingPlaces || !selectedPlaceId}
            onClick={handleNavigate}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? '…' : 'Go'}
          </button>
        </div>
      </label>

      <p className="text-xs text-slate-500">
        Starts from the ground-floor entrance of the Administration Building.
        {places.length > 0 ? (
          <>
            {' '}
            {placesOnFloor.length} place{placesOnFloor.length !== 1 ? 's' : ''} on {floorLabel(floor)} (
            {places.length} total in building).
          </>
        ) : null}
      </p>

      <Link
        to="/navigate"
        className="mt-4 inline-flex text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        Open full guide →
      </Link>
    </section>
  );
}
