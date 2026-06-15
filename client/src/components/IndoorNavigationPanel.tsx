import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Navigation, Search } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';
import { getGuidePlaces, postStoryGuide } from '@services/indoorNavApi';

interface MapBuilding {
  id: string;
  name: string;
  code: string;
  floors: number;
}

interface GuidePlace {
  name: string;
  floor: number;
}

export default function IndoorNavigationPanel() {
  const navigate = useNavigate();
  const destinationRef = useRef<HTMLDivElement>(null);
  const [buildings, setBuildings] = useState<MapBuilding[]>([]);
  const [places, setPlaces] = useState<GuidePlace[]>([]);
  const [buildingId, setBuildingId] = useState('');
  const [destination, setDestination] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewSteps, setPreviewSteps] = useState<string[]>([]);

  const filteredPlaces = useMemo(() => {
    const q = destination.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) => p.name.toLowerCase().includes(q));
  }, [places, destination]);

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
    setDestination('');
    setSuggestionsOpen(false);
    setPreviewSteps([]);
    void (async () => {
      try {
        const data = await getGuidePlaces(buildingId);
        setPlaces(data || []);
      } catch {
        setPlaces([]);
      }
    })();
  }, [buildingId]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (destinationRef.current && !destinationRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [suggestionsOpen]);

  const handleNavigate = useCallback(async (destOverride?: string) => {
    const q = (destOverride || destination).trim();
    if (!q || !buildingId) return;
    setLoading(true);
    setPreviewSteps([]);
    setSuggestionsOpen(false);
    try {
      const result = await postStoryGuide({ buildingId, destination: q });
      if (result.found && result.steps?.length) {
        setPreviewSteps(result.steps);
        navigate(`/navigate?buildingId=${buildingId}&q=${encodeURIComponent(result.destinationLabel || q)}`);
        return;
      }
      setPreviewSteps([result.message || 'Place not found. Ask admin to set up navigation notes for this building.']);
    } catch (err) {
      showApiErrorToast(err, 'Navigation failed');
    } finally {
      setLoading(false);
    }
  }, [destination, buildingId, navigate]);

  const handlePlaceSelect = (name: string) => {
    setDestination(name);
    setSuggestionsOpen(false);
    void handleNavigate(name);
  };

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
        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Building</span>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
      )}

      <label className="mb-3 block text-sm">
        <span className="mb-1 block font-medium text-slate-600">Where do you want to go?</span>
        <div className="flex gap-2">
          <div ref={destinationRef} className="relative flex-1">
            <input
              type="text"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              placeholder="e.g. cafeteria, security room, reception"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setSuggestionsOpen(true);
              }}
              onFocus={() => places.length > 0 && setSuggestionsOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && void handleNavigate()}
            />
            {suggestionsOpen && filteredPlaces.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {filteredPlaces.map((p) => (
                  <button
                    key={`${p.floor}-${p.name}`}
                    type="button"
                    className="block w-full border-b border-slate-100 px-3 py-2.5 text-left text-sm hover:bg-slate-50 last:border-0"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handlePlaceSelect(p.name)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={loading || !destination.trim()}
            onClick={() => void handleNavigate()}
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Search size={16} />
            {loading ? '…' : 'Go'}
          </button>
        </div>
      </label>

      {places.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Quick pick</p>
          <div className="flex flex-wrap gap-2">
            {places.slice(0, 8).map((p) => (
              <button
                key={`${p.floor}-${p.name}`}
                type="button"
                onClick={() => handlePlaceSelect(p.name)}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-[var(--color-primary)]"
              >
                <MapPin size={12} />
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {previewSteps.length > 0 && (
        <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm text-slate-600">
          {previewSteps.slice(0, 5).map((step, i) => (
            <li key={i}>
              {i + 1}. {step}
            </li>
          ))}
        </ol>
      )}

      <Link
        to="/navigate"
        className="mt-4 inline-flex text-sm font-medium text-[var(--color-primary)] hover:underline"
      >
        Open full guide →
      </Link>
    </section>
  );
}
