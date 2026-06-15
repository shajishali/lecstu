import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import { formatMarkerTypeLabel, MAP_MARKER_TYPES, MARKER_TYPE_COLORS } from '@constants/mapMarkerTypes';
import { ArrowLeft, MapPin, Plus, Save, Trash2 } from 'lucide-react';

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

interface IndoorMarker {
  id: string;
  floor: number;
  type: string;
  label: string;
  x: number;
  y: number;
  hall: { id: string; name: string } | null;
  office: {
    id: string;
    roomNumber: string;
    lecturer: { firstName: string; lastName: string };
  } | null;
}

interface EditorContext {
  building: { id: string; name: string; code: string; floors: number };
  floor: number;
  floorPlan: { id: string; imagePath: string; bounds: unknown };
  markers: IndoorMarker[];
  halls: { id: string; name: string; building: string; floor: number }[];
  offices: {
    id: string;
    roomNumber: string;
    building: string;
    floor: number;
    lecturer: { firstName: string; lastName: string };
  }[];
  hallsWithoutMarker: { id: string; name: string }[];
  officesWithoutMarker: { id: string; roomNumber: string }[];
  timetableHallsMissingMarker: { id: string; name: string; building: string; floor: number }[];
}

export default function IndoorMarkerEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [buildings, setBuildings] = useState<
    { id: string; name: string; code: string; floors: number; floorPlans: { floor: number }[] }[]
  >([]);
  const [buildingId, setBuildingId] = useState(searchParams.get('buildingId') || '');
  const [floor, setFloor] = useState(parseInt(searchParams.get('floor') || '0', 10));
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(true);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pendingPlace, setPendingPlace] = useState<{ x: number; y: number } | null>(null);
  const [form, setForm] = useState({
    type: 'HALL' as string,
    label: '',
    hallId: '',
    officeId: '',
  });

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings');
      setBuildings(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load buildings');
    }
  }, []);

  const loadEditor = useCallback(async () => {
    if (!buildingId) {
      setCtx(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/admin/map/indoor-markers/editor', {
        params: { buildingId, floor },
      });
      setCtx(res.data.data);
      setSelectedId(null);
    } catch (err: unknown) {
      setCtx(null);
      showApiErrorToast(err, 'Load floor plan first (Admin → Buildings → upload JPG)');
    } finally {
      setLoading(false);
    }
  }, [buildingId, floor]);

  useEffect(() => {
    fetchBuildings();
  }, [fetchBuildings]);

  useEffect(() => {
    setSearchParams(
      buildingId ? { buildingId, floor: String(floor) } : {},
      { replace: true }
    );
    loadEditor();
  }, [buildingId, floor, loadEditor, setSearchParams]);

  const clientToPercent = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.indoor-marker-pin')) return;
    if (!addMode || !ctx) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);
    setSelectedId(null);
    setPendingPlace({ x, y });
  };

  const createMarkerAt = async (x: number, y: number, overrides?: Partial<typeof form>) => {
    if (!ctx) return;
    const payload = { ...form, ...overrides };
    const label =
      payload.label.trim() ||
      (payload.hallId
        ? ctx.halls.find((h) => h.id === payload.hallId)?.name
        : payload.officeId
          ? ctx.offices.find((o) => o.id === payload.officeId)?.roomNumber
          : 'New room');
    if (!label) {
      showToast('info', 'Enter a label or link a hall/office');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/admin/map/indoor-markers', {
        buildingId: ctx.building.id,
        floor: ctx.floor,
        type: payload.type,
        label,
        x,
        y,
        hallId: payload.hallId || null,
        officeId: payload.officeId || null,
      });
      showToast('success', 'Room marker placed');
      setSelectedId(res.data.data.id);
      setPendingPlace(null);
      await loadEditor();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to place marker');
    } finally {
      setSaving(false);
    }
  };

  const saveSelected = async () => {
    if (!selectedId || !ctx) return;
    setSaving(true);
    try {
      await api.patch(`/admin/map/indoor-markers/${selectedId}`, {
        type: form.type,
        label: form.label,
        hallId: form.hallId || null,
        officeId: form.officeId || null,
      });
      showToast('success', 'Marker saved');
      await loadEditor();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.delete(`/admin/map/indoor-markers/${selectedId}`);
      showToast('success', 'Marker removed');
      setSelectedId(null);
      await loadEditor();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const patchPosition = async (id: string, x: number, y: number) => {
    try {
      await api.patch(`/admin/map/indoor-markers/${id}/position`, { x, y });
      setCtx((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          markers: prev.markers.map((m) => (m.id === id ? { ...m, x, y } : m)),
        };
      });
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to move marker');
      await loadEditor();
    }
  };

  const selectMarker = (m: IndoorMarker) => {
    setSelectedId(m.id);
    setAddMode(false);
    setForm({
      type: m.type,
      label: m.label,
      hallId: m.hall?.id || '',
      officeId: m.office?.id || '',
    });
  };

  const placeQuickHall = (hallId: string, name: string) => {
    setForm((f) => ({ ...f, type: 'HALL', label: name, hallId, officeId: '' }));
    setAddMode(true);
    showToast('info', `Click on the map to place: ${name}`);
  };

  const selectedBuilding = buildings.find((b) => b.id === buildingId);
  const floorsWithPlans = selectedBuilding?.floorPlans?.map((fp) => fp.floor) ?? [];
  const floorOptions = selectedBuilding
    ? Array.from({ length: selectedBuilding.floors }, (_, i) => i)
    : [0];

  const imageUrl = ctx?.floorPlan?.imagePath
    ? ctx.floorPlan.imagePath.startsWith('/')
      ? `${window.location.origin}${ctx.floorPlan.imagePath}`
      : ctx.floorPlan.imagePath
    : '';

  return (
    <div className="indoor-editor-page">
      <div className="admin-page-header">
        <div>
          <Link to="/admin/buildings" className="indoor-back-link">
            <ArrowLeft size={16} /> Buildings
          </Link>
          <h1>Place rooms on floor plan</h1>
          <p>Phase 6.5 — click the map to add rooms; drag pins to move them.</p>
        </div>
      </div>

      <div className="indoor-toolbar">
        <label>
          Building
          <select
            value={buildingId}
            onChange={(e) => {
              setBuildingId(e.target.value);
              setFloor(0);
            }}
          >
            <option value="">Select building</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select value={floor} onChange={(e) => setFloor(parseInt(e.target.value, 10))}>
            {floorOptions.map((f) => (
              <option key={f} value={f}>
                {floorLabel(f)}
                {floorsWithPlans.includes(f) ? '' : ' — no JPG yet'}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={addMode ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setAddMode(true)}
        >
          <Plus size={14} /> Add mode
        </button>
        <button
          type="button"
          className={!addMode ? 'btn-primary' : 'btn-secondary'}
          onClick={() => setAddMode(false)}
        >
          <MapPin size={14} /> Select / drag
        </button>
      </div>

      {loading && (
        <div className="admin-loading">
          <div className="spinner" />
          <p>Loading floor plan…</p>
        </div>
      )}

      {!loading && ctx && (
        <div className="indoor-layout">
          <div className="indoor-canvas-wrap">
            <div
              ref={canvasRef}
              className={`indoor-canvas ${addMode ? 'add-mode' : ''}`}
              onClick={handleCanvasClick}
              onMouseMove={(e) => {
                if (!draggingId) return;
                const { x, y } = clientToPercent(e.clientX, e.clientY);
                setCtx((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    markers: prev.markers.map((m) =>
                      m.id === draggingId ? { ...m, x, y } : m
                    ),
                  };
                });
              }}
              onMouseUp={(e) => {
                if (!draggingId) return;
                const id = draggingId;
                setDraggingId(null);
                const { x, y } = clientToPercent(e.clientX, e.clientY);
                void patchPosition(id, x, y);
              }}
              onMouseLeave={() => {
                if (draggingId) setDraggingId(null);
              }}
            >
              <img src={imageUrl} alt={`${ctx.building.name} ${floorLabel(floor)}`} draggable={false} />
              {ctx.markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`indoor-marker-pin ${selectedId === m.id ? 'selected' : ''}`}
                  style={{
                    left: `${m.x}%`,
                    top: `${m.y}%`,
                    backgroundColor: MARKER_TYPE_COLORS[m.type] || '#64748b',
                  }}
                  title={m.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectMarker(m);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (addMode) return;
                    setDraggingId(m.id);
                    selectMarker(m);
                  }}
                >
                  <span className="pin-label">{m.label}</span>
                </button>
              ))}
            </div>
            <p className="fp-hint">
              {addMode
                ? 'Click on the floor plan to place a new room marker.'
                : 'Drag markers to move. Click a pin to edit details.'}
            </p>
          </div>

          <aside className="indoor-sidebar">
            {selectedId ? (
              <div className="indoor-form-panel">
                <h3>Edit marker</h3>
                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {MAP_MARKER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatMarkerTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Label
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                  />
                </label>
                <label>
                  Link lecture hall
                  <select
                    value={form.hallId}
                    onChange={(e) =>
                      setForm({ ...form, hallId: e.target.value, officeId: '', type: 'HALL' })
                    }
                  >
                    <option value="">— None —</option>
                    {ctx.halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Link lecturer office
                  <select
                    value={form.officeId}
                    onChange={(e) =>
                      setForm({ ...form, officeId: e.target.value, hallId: '', type: 'OFFICE' })
                    }
                  >
                    <option value="">— None —</option>
                    {ctx.offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.roomNumber} — {o.lecturer.firstName} {o.lecturer.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="tt-form-actions">
                  <button type="button" className="btn-secondary" onClick={deleteSelected} disabled={saving}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button type="button" className="btn-primary" onClick={saveSelected} disabled={saving}>
                    <Save size={14} /> Save
                  </button>
                </div>
              </div>
            ) : pendingPlace ? (
              <div className="indoor-form-panel">
                <h3>New marker</h3>
                <p className="text-sm text-slate-600">
                  Position: {pendingPlace.x.toFixed(1)}%, {pendingPlace.y.toFixed(1)}%
                </p>
                <label>
                  Type
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    {MAP_MARKER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {formatMarkerTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Label
                  <input
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="Room name"
                  />
                </label>
                <label>
                  Link lecture hall
                  <select
                    value={form.hallId}
                    onChange={(e) =>
                      setForm({ ...form, hallId: e.target.value, officeId: '', type: 'HALL' })
                    }
                  >
                    <option value="">— None —</option>
                    {ctx.halls.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Link lecturer office
                  <select
                    value={form.officeId}
                    onChange={(e) =>
                      setForm({ ...form, officeId: e.target.value, hallId: '', type: 'OFFICE' })
                    }
                  >
                    <option value="">— None —</option>
                    {ctx.offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.roomNumber} — {o.lecturer.firstName} {o.lecturer.lastName}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="tt-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setPendingPlace(null)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={saving}
                    onClick={() => void createMarkerAt(pendingPlace.x, pendingPlace.y)}
                  >
                    <MapPin size={14} /> Place here
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-text">
                Add mode: click the map, then fill details and Place here. Or pick a room from the list below.
              </p>
            )}

            <div className="indoor-checklist">
              <h4>Rooms still to place</h4>
              {ctx.timetableHallsMissingMarker.length === 0 &&
              ctx.hallsWithoutMarker.length === 0 ? (
                <p className="text-sm text-emerald-700">All known halls on this floor have markers.</p>
              ) : (
                <ul>
                  {ctx.timetableHallsMissingMarker.map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => placeQuickHall(h.id, h.name)}>
                        {h.name} (timetable)
                      </button>
                    </li>
                  ))}
                  {ctx.hallsWithoutMarker
                    .filter((h) => !ctx.timetableHallsMissingMarker.some((t) => t.id === h.id))
                    .map((h) => (
                      <li key={h.id}>
                        <button type="button" onClick={() => placeQuickHall(h.id, h.name)}>
                          {h.name}
                        </button>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}

      {!loading && buildingId && !ctx && (
        <p className="empty-text">
          Upload a floor plan for this level in Admin → Buildings, then return here.
        </p>
      )}
    </div>
  );
}
