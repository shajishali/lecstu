import { useCallback, useEffect, useRef, useState } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import { clientToImagePercent } from '@utils/floorPlanCanvas';
import {
  formatMarkerTypeLabel,
  isMapMarkerType,
  MANUAL_PLACE_MARKER_TYPES,
  MAP_MARKER_TYPES,
  markerTypeLinksToHall,
  markerTypeLinksToOffice,
  type MapMarkerTypeValue,
} from '@constants/mapMarkerTypes';
import { Check, Link2, Lock, MapPin, Pencil, Plus, Save, Trash2, Unlock, X } from 'lucide-react';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type PublishStatus = 'DRAFT' | 'REVIEWED' | 'PUBLISHED';

interface MarkerRow {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  reviewStatus: ReviewStatus;
  legendNumber?: number | null;
  hallId?: string | null;
  officeId?: string | null;
  metadata?: unknown;
}

interface HallOption {
  id: string;
  name: string;
}

interface OfficeOption {
  id: string;
  roomNumber: string;
}

interface ConnectionRow {
  hostBuildingCode: string;
  targetBuildingCode: string;
  markerType: string;
  label: string;
  placed: boolean;
  markerId: string | null;
}

interface ReviewData {
  markers: MarkerRow[];
  halls: HallOption[];
  offices: OfficeOption[];
  connections: ConnectionRow[];
  stats: { total: number; pending: number; approved: number; rejected: number };
  junkHidden?: number;
  floorPlan: {
    id: string;
    publishStatus?: PublishStatus;
    updatedAt?: string;
    scaleMetersPerUnit?: number | null;
    drawableRegion?: { x0: number; y0: number; x1: number; y1: number };
    locationsLockedAt?: string | null;
    lockedImagePath?: string | null;
  };
}

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return 'Not saved yet';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function publishStatusLabel(status: PublishStatus): string {
  if (status === 'PUBLISHED') return 'Published';
  if (status === 'REVIEWED') return 'Reviewed';
  return 'Draft';
}

function publishStatusBadgeClass(status: PublishStatus): string {
  if (status === 'PUBLISHED') return 'bg-emerald-100 text-emerald-800';
  if (status === 'REVIEWED') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
}

interface Props {
  buildingId: string;
  floor: number;
  imageUrl?: string;
  onUpdated: () => void;
}

function floorLabel(floor: number): string {
  return floor === 0 ? 'Ground floor (G)' : `Floor ${floor}`;
}

export default function FloorPlanReviewPanel({ buildingId, floor, imageUrl, onUpdated }: Props) {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState('0.45');
  const [region, setRegion] = useState({ x0: 0, y0: 0, x1: 100, y1: 72 });
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('DRAFT');
  const [savedPublishStatus, setSavedPublishStatus] = useState<PublishStatus>('DRAFT');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [publishJustSaved, setPublishJustSaved] = useState(false);
  const [savingPublish, setSavingPublish] = useState(false);
  const [placingConnection, setPlacingConnection] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [placingNewPlace, setPlacingNewPlace] = useState(false);
  const [newPlace, setNewPlace] = useState({
    label: '',
    type: 'AMENITY' as MapMarkerTypeValue,
    legendNumber: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [locationsLockedAt, setLocationsLockedAt] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const [editForm, setEditForm] = useState({
    label: '',
    type: 'AMENITY' as MapMarkerTypeValue,
    legendNumber: '',
  });
  const imgRef = useRef<HTMLDivElement>(null);
  const mapImgRef = useRef<HTMLImageElement>(null);
  const floorPlanSectionRef = useRef<HTMLDivElement>(null);
  const placesTableSectionRef = useRef<HTMLDivElement>(null);
  const savedPublishRef = useRef<PublishStatus>('DRAFT');

  const scrollToSection = (ref: React.RefObject<HTMLElement | null>) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    savedPublishRef.current = savedPublishStatus;
  }, [savedPublishStatus]);

  const markerPath = (markerId: string) =>
    `/admin/buildings/${buildingId}/floorplan/${floor}/markers/${markerId}`;

  const promptRepublishIfNeeded = (
    wasPublished = savedPublishRef.current === 'PUBLISHED',
    opts?: { silent?: boolean }
  ) => {
    if (!wasPublished) return;
    setSavedPublishStatus('REVIEWED');
    setPublishStatus('PUBLISHED');
    setPublishJustSaved(false);
    if (!opts?.silent) {
      showToast('info', 'Floor updated — save publish status when you are done');
    }
  };

  const clientToPercent = (clientX: number, clientY: number) =>
    clientToImagePercent(clientX, clientY, imgRef.current, mapImgRef.current);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/buildings/${buildingId}/floorplan/${floor}/locations`);
      const d = res.data.data as ReviewData;
      setData(d);
      setScale(String(d.floorPlan.scaleMetersPerUnit ?? 0.45));
      const r = d.floorPlan.drawableRegion;
      if (r) setRegion({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 });
      const status = d.floorPlan.publishStatus ?? 'DRAFT';
      setPublishStatus(status);
      setSavedPublishStatus(status);
      setLastUpdatedAt(d.floorPlan.updatedAt ?? null);
      setLocationsLockedAt(d.floorPlan.locationsLockedAt ?? null);
      setPublishJustSaved(false);
    } catch (err) {
      showApiErrorToast(err, 'Could not load locations');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildingId, floor]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCalibration = async () => {
    try {
      await api.patch(`/admin/buildings/${buildingId}/floorplan/${floor}/calibration`, {
        scaleMetersPerUnit: parseFloat(scale),
        drawableRegion: region,
      });
      const wasPublished = savedPublishRef.current === 'PUBLISHED';
      showToast('success', 'Calibration saved');
      onUpdated();
      await load();
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Failed to save calibration');
    }
  };

  const savePublish = async () => {
    setSavingPublish(true);
    try {
      const res = await api.patch(`/admin/buildings/${buildingId}/floorplan/${floor}/publish`, {
        publishStatus,
      });
      const updated = res.data.data as {
        publishStatus: PublishStatus;
        updatedAt?: string;
        graphValidation?: { healthy?: boolean; issues?: string[] };
      };
      const status = updated.publishStatus ?? publishStatus;
      setPublishStatus(status);
      setSavedPublishStatus(status);
      setLastUpdatedAt(updated.updatedAt ?? new Date().toISOString());
      setPublishJustSaved(true);
      showToast('success', `Publish status updated to ${publishStatusLabel(status)}`);
      if (status === 'PUBLISHED' && updated.graphValidation && !updated.graphValidation.healthy) {
        const hint = updated.graphValidation.issues?.[0] || 'Check the Walking paths tab';
        window.setTimeout(() => showToast('info', `Published — graph note: ${hint}`), 400);
      }
      onUpdated();
      window.setTimeout(() => setPublishJustSaved(false), 5000);
    } catch (err) {
      showApiErrorToast(err, 'Cannot publish — resolve pending locations first');
    } finally {
      setSavingPublish(false);
    }
  };

  const publishDirty = publishStatus !== savedPublishStatus;
  const locationsLocked = !!locationsLockedAt;

  const lockLocations = async () => {
    setLocking(true);
    try {
      const res = await api.post(
        `/admin/buildings/${buildingId}/floorplan/${floor}/locations/lock`
      );
      const lockedAt = res.data.data?.locationsLockedAt as string;
      setLocationsLockedAt(lockedAt ?? new Date().toISOString());
      showToast(
        'success',
        `Locked ${res.data.data?.markerCount ?? ''} place(s) — Walking paths will use this exact map`
      );
      await load();
      onUpdated();
    } catch (err) {
      showApiErrorToast(err, 'Could not lock locations');
    } finally {
      setLocking(false);
    }
  };

  const unlockLocations = async () => {
    setLocking(true);
    try {
      await api.post(`/admin/buildings/${buildingId}/floorplan/${floor}/locations/unlock`);
      setLocationsLockedAt(null);
      showToast('info', 'Locations unlocked — you can move dots again');
      await load();
      onUpdated();
    } catch (err) {
      showApiErrorToast(err, 'Could not unlock locations');
    } finally {
      setLocking(false);
    }
  };

  const setReview = async (markerId: string, reviewStatus: ReviewStatus) => {
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    setBusyId(markerId);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markers: prev.markers.map((m) =>
          m.id === markerId ? { ...m, reviewStatus } : m
        ),
      };
    });
    try {
      await api.patch(`${markerPath(markerId)}/review`, { reviewStatus });
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Review update failed');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const bulkApprove = async () => {
    const pending = data?.markers.filter((m) => m.reviewStatus === 'pending').map((m) => m.id) ?? [];
    if (!pending.length) return;
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    try {
      await api.post(
        `/admin/buildings/${buildingId}/floorplan/${floor}/markers/bulk-approve`,
        { markerIds: pending }
      );
      showToast('success', `Approved ${pending.length} location(s)`);
      await load();
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Bulk approve failed');
    }
  };

  const purgeJunk = async () => {
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    try {
      const res = await api.post(`/admin/buildings/${buildingId}/floorplan/${floor}/purge-junk`);
      const removed = res.data.data?.removed ?? 0;
      showToast('success', removed ? `Removed ${removed} junk marker(s)` : 'No junk markers to remove');
      await load();
      onUpdated();
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Cleanup failed');
    }
  };

  const linkEntity = async (markerId: string, hallId: string | null, officeId: string | null) => {
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    try {
      await api.patch(markerPath(markerId), { hallId, officeId });
      await load();
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Link failed');
    }
  };

  const deleteMarker = async (markerId: string) => {
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    setBusyId(markerId);
    const removed = data?.markers.find((m) => m.id === markerId);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markers: prev.markers.filter((m) => m.id !== markerId),
        stats: {
          ...prev.stats,
          total: Math.max(0, prev.stats.total - 1),
        },
      };
    });
    try {
      await api.delete(markerPath(markerId));
      promptRepublishIfNeeded(wasPublished, { silent: true });
      onUpdated();
    } catch (err) {
      showApiErrorToast(err, 'Delete failed');
      if (removed) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            markers: [...prev.markers, { ...removed, reviewStatus: removed.reviewStatus }],
            stats: { ...prev.stats, total: prev.stats.total + 1 },
          };
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  const patchPosition = async (markerId: string, x: number, y: number) => {
    try {
      await api.patch(`${markerPath(markerId)}/position`, { x, y });
    } catch (err) {
      showApiErrorToast(err, 'Failed to move location — try signing in again');
      await load();
    }
  };

  const finishDrag = (clientX: number, clientY: number) => {
    if (!draggingId) return;
    const id = draggingId;
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    setDraggingId(null);
    const { x, y } = clientToPercent(clientX, clientY);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markers: prev.markers.map((m) => (m.id === id ? { ...m, x, y } : m)),
      };
    });
    promptRepublishIfNeeded(wasPublished, { silent: true });
    void patchPosition(id, x, y);
  };

  const startEditRow = (m: MarkerRow) => {
    setEditingId(m.id);
    setEditForm({
      label: m.label,
      type: isMapMarkerType(m.type) ? m.type : 'AMENITY',
      legendNumber: m.legendNumber != null ? String(m.legendNumber) : '',
    });
  };

  const saveEditRow = async (markerId: string) => {
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    const legendNum = editForm.legendNumber.trim()
      ? parseInt(editForm.legendNumber, 10)
      : null;
    const label = editForm.label.trim();
    if (!label) {
      showToast('info', 'Place name is required');
      return;
    }
    setBusyId(markerId);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        markers: prev.markers.map((m) =>
          m.id === markerId
            ? {
                ...m,
                label,
                type: editForm.type,
                legendNumber:
                  legendNum != null && !Number.isNaN(legendNum) ? legendNum : null,
              }
            : m
        ),
      };
    });
    setEditingId(null);
    try {
      await api.patch(markerPath(markerId), {
        label,
        type: editForm.type,
        legendNumber: legendNum != null && !Number.isNaN(legendNum) ? legendNum : null,
      });
      promptRepublishIfNeeded(wasPublished, { silent: true });
      onUpdated();
    } catch (err) {
      showApiErrorToast(err, 'Could not save changes');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const createManualPlace = async (x: number, y: number) => {
    const label = newPlace.label.trim();
    if (!label) {
      showToast('info', 'Enter a place name first');
      return;
    }
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    const legendNum = newPlace.legendNumber.trim()
      ? parseInt(newPlace.legendNumber, 10)
      : undefined;
    try {
      await api.post(`/admin/buildings/${buildingId}/floorplan/${floor}/markers`, {
        type: newPlace.type,
        label,
        x,
        y,
        legendNumber: legendNum != null && !Number.isNaN(legendNum) ? legendNum : undefined,
      });
      showToast('success', 'Place added — drag the dot to fine-tune if needed');
      setShowAddForm(false);
      setPlacingNewPlace(false);
      setNewPlace({ label: '', type: 'AMENITY', legendNumber: '' });
      await load();
      scrollToSection(placesTableSectionRef);
      promptRepublishIfNeeded(wasPublished);
      onUpdated();
    } catch (err) {
      showApiErrorToast(err, 'Could not add place');
    }
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return;
    const { x, y } = clientToPercent(e.clientX, e.clientY);

    if (placingNewPlace) {
      await createManualPlace(x, y);
      return;
    }

    if (!placingConnection) return;
    const wasPublished = savedPublishRef.current === 'PUBLISHED';
    try {
      await api.post(`/admin/buildings/${buildingId}/floorplan/${floor}/connection-point`, {
        targetBuildingCode: placingConnection,
        x,
        y,
      });
      showToast('success', 'Connection point placed');
      setPlacingConnection(null);
      await load();
      onUpdated();
      promptRepublishIfNeeded(wasPublished);
    } catch (err) {
      showApiErrorToast(err, 'Could not place connection');
    }
  };

  if (!imageUrl) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Upload a floor plan in <strong>Setup</strong> before reviewing locations.
      </p>
    );
  }

  if (loading && !data) {
    return <p className="text-slate-500">Loading locations…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-800">Calibration — {floorLabel(floor)}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Scale (meters per % unit)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
            />
          </label>
          {(['x0', 'y0', 'x1', 'y1'] as const).map((key) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block text-slate-600">Drawable {key} (%)</span>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
                value={region[key]}
                onChange={(e) => setRegion((r) => ({ ...r, [key]: parseFloat(e.target.value) || 0 }))}
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void saveCalibration()}
          className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white"
        >
          Save calibration
        </button>
      </div>

      <div
        ref={floorPlanSectionRef}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-4"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-800">Floor plan map</h2>
            {locationsLocked && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                <Lock size={12} /> Locked for Walking paths
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {placingConnection && (
              <span className="text-sm text-[var(--color-primary)]">
                Click the doorway on the map → {placingConnection}
              </span>
            )}
            {locationsLocked ? (
              <button
                type="button"
                disabled={locking}
                onClick={() => void unlockLocations()}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Unlock size={14} />
                {locking ? 'Unlocking…' : 'Unlock'}
              </button>
            ) : (
              <button
                type="button"
                disabled={locking || !data?.markers.length}
                onClick={() => void lockLocations()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Lock size={14} />
                {locking ? 'Locking…' : 'Lock for Walking paths'}
              </button>
            )}
          </div>
        </div>
        <p className="mb-2 text-xs font-medium text-slate-600">Building connections</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {(data?.connections ?? []).map((c) => (
            <button
              key={`${c.targetBuildingCode}-${c.markerType}`}
              type="button"
              disabled={c.placed}
              onClick={() => setPlacingConnection(c.placed ? null : c.targetBuildingCode)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${
                c.placed
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white hover:border-[var(--color-primary)]'
              }`}
            >
              <Link2 size={14} />
              {c.label}
              {c.placed ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-slate-500">
          {locationsLocked
            ? 'Map is locked. Unlock to move dots, then lock again before drawing paths.'
            : placingConnection
              ? 'Click the doorway to place a building connection.'
              : placingNewPlace
                ? 'Click on the map where this place should go.'
                : 'Drag red dots into place, then click Lock for Walking paths.'}
        </p>
        <div
          ref={imgRef}
          className={`fp-map-canvas ${
            placingConnection || placingNewPlace
              ? 'cursor-crosshair ring-2 ring-[var(--color-primary)]'
              : draggingId
                ? 'cursor-grabbing'
                : ''
          }`}
          onClick={(e) => void handleMapClick(e)}
          onMouseMove={(e) => {
            if (!draggingId || placingConnection || placingNewPlace) return;
            const { x, y } = clientToPercent(e.clientX, e.clientY);
            setData((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                markers: prev.markers.map((m) => (m.id === draggingId ? { ...m, x, y } : m)),
              };
            });
          }}
          onMouseUp={(e) => {
            if (placingConnection || placingNewPlace) return;
            finishDrag(e.clientX, e.clientY);
          }}
          onMouseLeave={(e) => {
            if (placingConnection || placingNewPlace || !draggingId) return;
            finishDrag(e.clientX, e.clientY);
          }}
        >
          <img
            ref={mapImgRef}
            src={imageUrl}
            alt={floorLabel(floor)}
            draggable={false}
          />
          {(data?.markers ?? []).map((m) => (
            <button
              key={m.id}
              type="button"
              title={`${m.legendNumber != null ? `#${m.legendNumber} — ` : ''}${m.label} (drag to move)`}
              disabled={!!placingConnection || placingNewPlace || locationsLocked}
              className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white shadow transition-[width,height,box-shadow] ${
                placingConnection
                  ? 'pointer-events-none h-2 w-2 opacity-40 bg-[var(--color-primary)]'
                  : locationsLocked
                    ? 'h-1.5 w-1.5 cursor-default bg-[var(--color-primary)]'
                    : draggingId === m.id
                      ? 'h-4 w-4 cursor-grabbing bg-[var(--color-primary)] shadow-lg ring-2 ring-[var(--color-primary)]/50'
                      : 'h-1.5 w-1.5 cursor-grab bg-[var(--color-primary)] hover:h-2 hover:w-2'
              }`}
              style={{ left: `${m.x}%`, top: `${m.y}%` }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                if (placingConnection || placingNewPlace || locationsLocked) return;
                e.stopPropagation();
                e.preventDefault();
                setDraggingId(m.id);
              }}
            />
          ))}
        </div>
      </div>

      <div
        ref={placesTableSectionRef}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm scroll-mt-4"
      >
        <p className="mb-3 text-sm text-slate-600">
          Your floor sign lists <strong>7 numbered places</strong> (1–7). Each row below is one place; the{' '}
          <strong>#</strong> column matches the number on the map. The red dot on the image is placed where
          that number appears on the drawing. <strong>Drag any red dot</strong> on the map above to
          fix wrong positions. Use <strong>Add place</strong> if AI missed a room. Also add{' '}
          <strong>Stairs &amp; lift (same spot)</strong>, staircase, lift, toilet, and building connections if needed.
        </p>
        {showAddForm && (
          <div className="mb-4 rounded-lg border border-[var(--color-primary)]/30 bg-slate-50 p-3">
            <p className="mb-2 text-sm font-medium text-slate-800">Add a place manually</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Place name</span>
                <input
                  type="text"
                  className="w-48 rounded-lg border border-slate-200 px-3 py-1.5"
                  placeholder="e.g. CAFETERIA"
                  value={newPlace.label}
                  onChange={(e) => setNewPlace((p) => ({ ...p, label: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Legend # (optional)</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-1.5"
                  placeholder="1–7"
                  value={newPlace.legendNumber}
                  onChange={(e) => setNewPlace((p) => ({ ...p, legendNumber: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-slate-600">Type</span>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-1.5"
                  value={newPlace.type}
                  onChange={(e) =>
                    setNewPlace((p) => ({
                      ...p,
                      type: e.target.value as MapMarkerTypeValue,
                    }))
                  }
                >
                  {MANUAL_PLACE_MARKER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {formatMarkerTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!newPlace.label.trim()) {
                    showToast('info', 'Enter a place name first');
                    return;
                  }
                  setPlacingConnection(null);
                  setPlacingNewPlace(true);
                  scrollToSection(floorPlanSectionRef);
                }}
                className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white"
              >
                Click map to place
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setPlacingNewPlace(false);
                  setNewPlace({ label: '', type: 'AMENITY', legendNumber: '' });
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
            {placingNewPlace && (
              <p className="mt-2 text-xs text-[var(--color-primary)]">
                Click on the floor plan image above to set the position.
              </p>
            )}
          </div>
        )}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-800">
            Floor plan places ({data?.stats.total ?? 0})
            {data && data.stats.pending > 0 && (
              <span className="ml-2 text-sm font-normal text-amber-700">
                {data.stats.pending} pending
              </span>
            )}
            {data && (data.junkHidden ?? 0) > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                ({data.junkHidden} doors/corridors/text hidden)
              </span>
            )}
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(true);
                setPlacingConnection(null);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)]"
            >
              <Plus size={14} /> Add place
            </button>
            {(data?.junkHidden ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void purgeJunk()}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-800"
              >
                Delete hidden junk
              </button>
            )}
            {data && data.stats.pending > 0 && (
              <button
                type="button"
                onClick={() => void bulkApprove()}
                className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-medium text-emerald-800"
              >
                Approve all pending
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-2 w-10">#</th>
                <th className="py-2 pr-2">Place name (legend)</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Link</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data?.markers ?? []).map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-500">
                    {editingId === m.id ? (
                      <input
                        type="number"
                        min={1}
                        max={99}
                        className="w-14 rounded border border-slate-200 px-1 py-0.5 text-xs"
                        value={editForm.legendNumber}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, legendNumber: e.target.value }))
                        }
                        placeholder="—"
                      />
                    ) : (
                      (m.legendNumber ?? '—')
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium">
                    {editingId === m.id ? (
                      <input
                        type="text"
                        className="w-full min-w-[140px] rounded border border-slate-200 px-2 py-0.5 text-sm"
                        value={editForm.label}
                        onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                      />
                    ) : (
                      m.label
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {editingId === m.id ? (
                      <select
                        className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                        value={editForm.type}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            type: e.target.value as MapMarkerTypeValue,
                          }))
                        }
                      >
                        {MAP_MARKER_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {formatMarkerTypeLabel(t)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      formatMarkerTypeLabel(m.type)
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        m.reviewStatus === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.reviewStatus === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {m.reviewStatus}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {markerTypeLinksToHall(m.type) || markerTypeLinksToOffice(m.type) ? (
                      <select
                        className="max-w-[180px] rounded border border-slate-200 px-2 py-1 text-xs"
                        value={m.hallId || m.officeId || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (markerTypeLinksToOffice(m.type)) void linkEntity(m.id, null, v || null);
                          else void linkEntity(m.id, v || null, null);
                        }}
                      >
                        <option value="">— Link entity —</option>
                        {(markerTypeLinksToOffice(m.type) ? data?.offices : data?.halls)?.map((ent) => (
                          <option
                            key={ent.id}
                            value={ent.id}
                          >
                            {'name' in ent ? ent.name : ent.roomNumber}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex gap-1">
                      {editingId === m.id ? (
                        <>
                          <button
                            type="button"
                            title="Save"
                            disabled={busyId === m.id}
                            onClick={() => void saveEditRow(m.id)}
                            className="rounded p-1 text-emerald-700 transition active:scale-95 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onClick={() => setEditingId(null)}
                            className="rounded p-1 text-slate-500 hover:bg-slate-100"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            title="Edit"
                            disabled={busyId === m.id}
                            onClick={() => startEditRow(m)}
                            className="rounded p-1 text-slate-600 transition active:scale-95 hover:bg-slate-100 disabled:opacity-50"
                          >
                            <Pencil size={15} />
                          </button>
                          {m.reviewStatus !== 'approved' && (
                            <button
                              type="button"
                              title="Approve"
                              disabled={busyId === m.id}
                              onClick={() => void setReview(m.id, 'approved')}
                              className="rounded p-1 text-emerald-700 transition active:scale-95 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {m.reviewStatus !== 'rejected' && (
                            <button
                              type="button"
                              title="Reject"
                              disabled={busyId === m.id}
                              onClick={() => void setReview(m.id, 'rejected')}
                              className="rounded p-1 text-red-600 transition active:scale-95 hover:bg-red-50 disabled:opacity-50"
                            >
                              <X size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete"
                            disabled={busyId === m.id}
                            onClick={() => void deleteMarker(m.id)}
                            className="rounded p-1 text-red-600 transition active:scale-95 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <MapPin size={18} /> Publish floor
        </h2>
        <p className="mb-3 text-sm text-slate-600">
          Students only see <strong>PUBLISHED</strong> floors with approved locations. After you move a
          dot or edit locations, save publish status again so students get the update.
        </p>
        {publishDirty && publishStatus === 'PUBLISHED' && savedPublishStatus !== 'PUBLISHED' && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This floor was edited — click <strong>Save publish status</strong> to apply your changes for
            students.
          </p>
        )}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${publishStatusBadgeClass(savedPublishStatus)}`}
          >
            Saved: {publishStatusLabel(savedPublishStatus)}
          </span>
          {publishJustSaved && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Updated just now
            </span>
          )}
          {publishDirty && !publishJustSaved && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Unsaved changes
            </span>
          )}
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Last saved: {formatLastUpdated(lastUpdatedAt)}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={publishStatus}
            onChange={(e) => {
              setPublishStatus(e.target.value as PublishStatus);
              setPublishJustSaved(false);
            }}
          >
            <option value="DRAFT">Draft</option>
            <option value="REVIEWED">Reviewed</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button
            type="button"
            onClick={() => void savePublish()}
            disabled={!publishDirty || savingPublish}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              !publishDirty
                ? 'cursor-default bg-slate-400'
                : 'bg-[var(--color-primary)] hover:opacity-90'
            }`}
          >
            {savingPublish
              ? 'Saving…'
              : publishJustSaved
                ? 'Updated ✓'
                : publishDirty
                  ? 'Save publish status'
                  : 'Up to date'}
          </button>
        </div>
      </div>
    </div>
  );
}
