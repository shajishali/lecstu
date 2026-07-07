import { useEffect, useState, useCallback, useRef } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Upload, Image, X, Layers, Info, Check, MapPin } from 'lucide-react';

interface FloorPlan {
  id: string;
  floor: number;
  imagePath: string;
  bounds?: unknown;
}

interface Building {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  floors: number;
  _count: { markers: number; floorPlans: number };
  floorPlans: FloorPlan[];
}

interface FacultySetupBuilding {
  code: string;
  name: string;
  exists: boolean;
  floors: number;
  uploadedCount: number;
  missingFloors: number[];
  description?: string;
  roomTypes?: string[];
}

interface FacultySetupStatus {
  allBuildingsExist: boolean;
  totalExpectedFloors: number;
  totalUploaded: number;
  buildings: FacultySetupBuilding[];
}

type BoundsPair = [[number, number], [number, number]];

function floorLabel(floor: number): string {
  if (floor === 0) return 'Ground floor (G)';
  return `Floor ${floor}`;
}

function floorFileName(code: string, floor: number): string {
  if (floor === 0) return `${code}_floor0.jpg or ${code}_ground.jpg`;
  return `${code}_floor${floor}.jpg`;
}

function parseBounds(bounds: unknown, building: Building): BoundsPair {
  if (bounds && Array.isArray(bounds) && bounds.length >= 2) {
    const a = bounds[0] as number[];
    const b = bounds[1] as number[];
    if (a?.length >= 2 && b?.length >= 2) {
      return [
        [Number(a[0]), Number(a[1])],
        [Number(b[0]), Number(b[1])],
      ];
    }
  }
  const span = 0.00035;
  return [
    [building.latitude - span, building.longitude - span],
    [building.latitude + span, building.longitude + span],
  ];
}

export default function BuildingManagement() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [form, setForm] = useState({ name: '', code: '', latitude: '', longitude: '', floors: 1 });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Building | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
  const [fpBuilding, setFpBuilding] = useState<Building | null>(null);
  const [fpFloor, setFpFloor] = useState(0);
  const [fpUploading, setFpUploading] = useState(false);
  const [fpAnalyzing, setFpAnalyzing] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const fpFileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const [boundsPlan, setBoundsPlan] = useState<FloorPlan | null>(null);
  const [boundsForm, setBoundsForm] = useState({ south: '', west: '', north: '', east: '' });
  const [boundsSaving, setBoundsSaving] = useState(false);
  const [setupStatus, setSetupStatus] = useState<FacultySetupStatus | null>(null);
  const [seedingFaculty, setSeedingFaculty] = useState(false);

  const fetchSetupStatus = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings/setup-status');
      setSetupStatus(res.data.data);
    } catch {
      setSetupStatus(null);
    }
  }, []);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings');
      setBuildings(res.data.data);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load buildings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuildings();
    fetchSetupStatus();
  }, [fetchBuildings, fetchSetupStatus]);

  const handleSeedFaculty = async () => {
    setSeedingFaculty(true);
    try {
      await api.post('/admin/buildings/seed-faculty');
      showToast('success', 'Academic, Administration, and Laboratory buildings created');
      await fetchBuildings();
      await fetchSetupStatus();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Setup failed');
    } finally {
      setSeedingFaculty(false);
    }
  };

  const openCreate = () => {
    setEditBuilding(null);
    setForm({ name: '', code: '', latitude: '', longitude: '', floors: 1 });
    setFormOpen(true);
  };

  const openEdit = (b: Building) => {
    setEditBuilding(b);
    setForm({
      name: b.name,
      code: b.code,
      latitude: String(b.latitude),
      longitude: String(b.longitude),
      floors: b.floors,
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editBuilding) {
        await api.patch(`/admin/buildings/${editBuilding.id}`, form);
        showToast('success', 'Building updated');
      } else {
        await api.post('/admin/buildings', form);
        showToast('success', 'Building created');
      }
      setFormOpen(false);
      fetchBuildings();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/buildings/${deleteTarget.id}`);
      showToast('success', 'Building deleted');
      setDeleteTarget(null);
      fetchBuildings();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const closeFloorPlanModal = () => {
    setFloorPlanOpen(false);
    setBoundsPlan(null);
    setFpUploading(false);
  };

  const openFloorPlans = (b: Building) => {
    setFpBuilding(b);
    setFpFloor(0);
    setBoundsPlan(null);
    setFloorPlanOpen(true);
  };

  const handleConfirmFloorPlans = async () => {
    if (boundsPlan) {
      showToast('info', 'Save map bounds first, or cancel the bounds editor.');
      return;
    }
    if (fpBuilding) {
      await fetchBuildings();
      await fetchSetupStatus();
      try {
        const res = await api.get(`/admin/buildings/${fpBuilding.id}`);
        const count = res.data.data.floorPlans?.length ?? 0;
        showToast(
          'success',
          count > 0
            ? `${fpBuilding.name}: ${count} floor map(s) confirmed`
            : `${fpBuilding.name}: no floor maps yet - upload then confirm`
        );
      } catch {
        showToast('success', `${fpBuilding.name}: floor plans updated`);
      }
    }
    closeFloorPlanModal();
  };

  const refreshFpBuilding = async (id: string) => {
    const res = await api.get(`/admin/buildings/${id}`);
    setFpBuilding(res.data.data);
    fetchBuildings();
  };

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fpBuilding) return;
    setFpUploading(true);
    try {
      const fd = new FormData();
      fd.append('floorplan', file);
      fd.append('floor', String(fpFloor));
      const res = await api.post(`/admin/buildings/${fpBuilding.id}/floorplan`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const vision = res.data?.vision;
      const visionError = res.data?.visionError;
      if (vision) {
        showToast(
          'success',
          `${floorLabel(fpFloor)} uploaded - AI found ${vision.roomsDetected} room(s): ${(vision.sampleLabels || []).join(', ')}`
        );
      } else if (visionError) {
        showToast(
          'info',
          `${floorLabel(fpFloor)} uploaded. Start AI service: npm run floorplan-vision (port 8003)`
        );
      } else {
        showToast('success', `${floorLabel(fpFloor)} uploaded (${floorFileName(fpBuilding.code, fpFloor)})`);
      }
      await refreshFpBuilding(fpBuilding.id);
      await fetchSetupStatus();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Upload failed');
    } finally {
      setFpUploading(false);
      if (fpFileRef.current) fpFileRef.current.value = '';
    }
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setBulkUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('floorplans', f));
      const res = await api.post('/admin/buildings/floorplans/bulk', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { imported, failed } = res.data.data;
      showToast(
        failed > 0 ? 'info' : 'success',
        `Bulk upload: ${imported} saved, ${failed} failed`
      );
      fetchBuildings();
      await fetchSetupStatus();
      if (fpBuilding) await refreshFpBuilding(fpBuilding.id);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
      if (bulkFileRef.current) bulkFileRef.current.value = '';
    }
  };

  const runFloorPlanAi = async (floor: number) => {
    if (!fpBuilding) return;
    setFpAnalyzing(true);
    try {
      const res = await api.post(
        `/admin/buildings/${fpBuilding.id}/floorplan/${floor}/analyze-ai`,
        {},
        { timeout: 240000 }
      );
      const d = res.data?.data;
      showToast(
        'success',
          `AI: ${d?.roomsDetected ?? 0} rooms, ${d?.doorsDetected ?? 0} doors, ${d?.symbolsDetected ?? 0} symbols. Paths: ${d?.navigation?.edges ?? 0} links. ${(d?.sampleLabels || []).slice(0, 6).join(', ')}`
      );
      await fetchSetupStatus();
    } catch (err: unknown) {
      showApiErrorToast(
        err,
        'AI analysis failed - run: npm run floorplan-vision (port 8003), then retry'
      );
    } finally {
      setFpAnalyzing(false);
    }
  };

  const handleDeleteFloorPlan = async (planId: string) => {
    if (!fpBuilding) return;
    try {
      await api.delete(`/admin/buildings/${fpBuilding.id}/floorplan/${planId}`);
      showToast('success', 'Floor plan deleted');
      await refreshFpBuilding(fpBuilding.id);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to delete floor plan');
    }
  };

  const openBoundsEditor = (fp: FloorPlan) => {
    if (!fpBuilding) return;
    const [[south, west], [north, east]] = parseBounds(fp.bounds, fpBuilding);
    setBoundsPlan(fp);
    setBoundsForm({
      south: String(south),
      west: String(west),
      north: String(north),
      east: String(east),
    });
  };

  const saveBounds = async () => {
    if (!fpBuilding || !boundsPlan) return;
    setBoundsSaving(true);
    try {
      const bounds: BoundsPair = [
        [parseFloat(boundsForm.south), parseFloat(boundsForm.west)],
        [parseFloat(boundsForm.north), parseFloat(boundsForm.east)],
      ];
      await api.patch(`/admin/buildings/${fpBuilding.id}/floorplan/${boundsPlan.id}/bounds`, {
        bounds,
      });
      showToast('success', 'Map bounds updated');
      setBoundsPlan(null);
      await refreshFpBuilding(fpBuilding.id);
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to save bounds');
    } finally {
      setBoundsSaving(false);
    }
  };

  const applyDefaultBounds = () => {
    if (!fpBuilding) return;
    const [[south, west], [north, east]] = parseBounds(null, fpBuilding);
    setBoundsForm({
      south: String(south),
      west: String(west),
      north: String(north),
      east: String(east),
    });
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'floors', label: 'Floors', sortable: true },
    {
      key: 'coordinates',
      label: 'Coordinates',
      sortable: false,
      render: (r: Building) => (
        <span className="coords-text">
          {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
        </span>
      ),
    },
    { key: 'markers', label: 'Markers', render: (r: Building) => r._count.markers },
    { key: 'plans', label: 'Floor Plans', render: (r: Building) => r._count.floorPlans },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (r: Building) => (
        <div className="tt-actions">
          <button
            className="tt-action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              openFloorPlans(r);
            }}
            title="Floor Plans"
          >
            <Image size={14} />
          </button>
          <button
            className="tt-action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(r);
            }}
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="tt-action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(r);
            }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading buildings...</p>
      </div>
    );
  }

  const floorOptions = fpBuilding
    ? Array.from({ length: fpBuilding.floors }, (_, i) => i)
    : [0];

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div>
          <h1>Buildings &amp; Floor Plans</h1>
          <p>
            {buildings.length} buildings - ACAD (Ground + 11, lectures), ADMIN (Ground + 10,
            offices), LAB (Ground + 9, labs)
          </p>
        </div>
        <div className="header-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => bulkFileRef.current?.click()}
            disabled={bulkUploading}
          >
            {bulkUploading ? (
              <span className="spinner-sm" />
            ) : (
              <>
                <Layers size={16} /> Bulk upload JPGs
              </>
            )}
          </button>
          <input
            ref={bulkFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={handleBulkUpload}
            hidden
          />
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Building
          </button>
        </div>
      </div>

      <div className="fp-setup-card">
        <h3>Phase 6.4 - Faculty buildings &amp; floor maps</h3>
        <p className="fp-setup-intro">
          Every building has a <strong>Ground floor (G)</strong> plus upper floors. Upload one JPG
          per level (e.g. <code>ACAD_ground.jpg</code> or <code>ACAD_floor0.jpg</code>, then{' '}
          <code>ACAD_floor1.jpg</code> …).
        </p>
        {setupStatus && (
          <ul className="fp-setup-list">
            {setupStatus.buildings.map((b) => (
              <li key={b.code}>
                <strong>{b.code}</strong> - {b.name} ({b.floors} floors):{' '}
                {b.exists ? (
                  <>
                    <strong>
                      {b.uploadedCount}/{b.floors}
                    </strong>{' '}
                    floor maps uploaded
                    {b.missingFloors.length > 0 && b.missingFloors.length <= 6 && (
                      <span className="fp-missing">
                        {' '}
                        - still need:{' '}
                        {b.missingFloors.map((f) => floorFileName(b.code, f)).join(', ')}
                      </span>
                    )}
                    {b.missingFloors.length > 6 && (
                      <span className="fp-missing">
                        {' '}
                        - {b.missingFloors.length} floors still without JPG
                      </span>
                    )}
                  </>
                ) : (
                  <span className="fp-missing"> not created - click button below</span>
                )}
                {b.roomTypes && b.roomTypes.length > 0 && (
                  <div className="fp-room-types">Rooms: {b.roomTypes.join(' · ')}</div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="fp-setup-actions">
          {!setupStatus?.allBuildingsExist && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleSeedFaculty}
              disabled={seedingFaculty}
            >
              {seedingFaculty ? <span className="spinner-sm" /> : 'Create 3 faculty buildings'}
            </button>
          )}
          {setupStatus?.allBuildingsExist && setupStatus.totalUploaded === 0 && (
            <span className="fp-setup-hint">
              Buildings ready - upload JPGs (Bulk upload or per-building Floor Plans icon).
            </span>
          )}
          {setupStatus && setupStatus.totalUploaded > 0 && (
            <span className="fp-setup-ok">
              {setupStatus.totalUploaded} floor map(s) on disk - open Campus Map to preview overlays.
            </span>
          )}
        </div>
      </div>

      <div className="fp-help-banner">
        <Info size={18} />
        <div>
          <strong>Floor plan files:</strong> ground = <code>CODE_floor0.jpg</code> or{' '}
          <code>CODE_ground.jpg</code>; upper floors = <code>CODE_floor1.jpg</code>, etc. Use{' '}
          <strong>Bulk upload</strong>{' '}
          or per-building Floor Plans. See <code>docs/floorplans/README.md</code>.
        </div>
      </div>

      <DataTable
        columns={columns}
        data={buildings}
        pageSize={15}
        searchPlaceholder="Search buildings..."
        emptyMessage="No buildings - run: npm run db:seed-faculty-buildings (in server folder)"
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editBuilding ? 'Edit Building' : 'Create Building'}
        width="500px"
      >
        <form onSubmit={handleSave} className="entity-form">
          <div className="form-row-2">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </label>
            <label>
              Code
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                placeholder="ACAD"
              />
            </label>
          </div>
          <div className="form-row-2">
            <label>
              Latitude
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                required
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                required
              />
            </label>
          </div>
          <label>
            Number of Floors
            <input
              type="number"
              value={form.floors}
              onChange={(e) => setForm({ ...form, floors: parseInt(e.target.value, 10) || 1 })}
              min={1}
              max={30}
              required
            />
          </label>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="spinner-sm" /> : editBuilding ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={floorPlanOpen}
        onClose={closeFloorPlanModal}
        title={`Floor Plans - ${fpBuilding?.name || ''} (${fpBuilding?.code})`}
        width="720px"
      >
        <div className="fp-upload-row">
          <label>
            Floor
            <select value={fpFloor} onChange={(e) => setFpFloor(parseInt(e.target.value, 10))}>
              {floorOptions.map((f) => (
                <option key={f} value={f}>
                  {floorLabel(f)}
                </option>
              ))}
            </select>
          </label>
          {fpBuilding && (
            <>
              <Link
                to={`/admin/indoor-markers?buildingId=${fpBuilding.id}&floor=${fpFloor}`}
                className="btn-secondary indoor-place-rooms-link"
              >
                <MapPin size={14} /> Place rooms on this floor
              </Link>
              <Link
                to={`/admin/indoor-nav?buildingId=${fpBuilding.id}&floor=${fpFloor}`}
                className="btn-secondary indoor-place-rooms-link"
              >
                <MapPin size={14} /> Draw walking paths
              </Link>
            </>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => fpFileRef.current?.click()}
            disabled={fpUploading}
          >
            {fpUploading ? (
              <span className="spinner-sm" />
            ) : (
              <>
                <Upload size={14} /> Upload {fpBuilding ? floorFileName(fpBuilding.code, fpFloor) : ''}
              </>
            )}
          </button>
          <input
            ref={fpFileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFloorPlanUpload}
            hidden
          />
        </div>

        <p className="fp-hint">
          Saved as{' '}
          <code>
            uploads/floorplans/
            {fpBuilding ? floorFileName(fpBuilding.code, fpFloor).split(' ')[0] : ''}
          </code>
          . With <strong>Floor plan AI</strong> running (port 8003), upload or click <strong>AI</strong> to
          read room labels from the JPG (may take 1-3 min). Walking paths are drawn manually in Indoor Navigation.
        </p>

        <div className="fp-list">
          {fpBuilding?.floorPlans && fpBuilding.floorPlans.length > 0 ? (
            fpBuilding.floorPlans.map((fp) => (
              <div key={fp.id} className="fp-item">
                <div className="fp-info">
                  <strong>
                    {floorLabel(fp.floor)} - {floorFileName(fpBuilding.code, fp.floor)}
                  </strong>
                  <img
                    src={fp.imagePath}
                    alt={`Floor ${fp.floor}`}
                    className="fp-thumb"
                  />
                  {fp.bounds ? (
                    <span className="fp-bounds-tag">Bounds set</span>
                  ) : (
                    <span className="fp-bounds-tag warn">Default bounds</span>
                  )}
                </div>
                <div className="tt-actions">
                  <button
                    type="button"
                    className="tt-action-btn edit"
                    onClick={() => runFloorPlanAi(fp.floor)}
                    disabled={fpAnalyzing}
                    title="AI: detect room labels from JPG (paths are drawn manually in Indoor Navigation)"
                  >
                    {fpAnalyzing ? <span className="spinner-sm" /> : 'AI'}
                  </button>
                  <button
                    type="button"
                    className="tt-action-btn edit"
                    onClick={() => openBoundsEditor(fp)}
                    title="Edit map bounds"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="tt-action-btn delete"
                    onClick={() => handleDeleteFloorPlan(fp.id)}
                    title="Delete"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="empty-text">No floor plans yet - upload JPG for each floor.</p>
          )}
        </div>

        {boundsPlan && fpBuilding && (
          <div className="fp-bounds-panel">
            <h4>Map overlay bounds - {floorLabel(boundsPlan.floor)}</h4>
            <p className="fp-hint">
              Corners for Leaflet: south/west and north/east (lat/lng). Tune on Campus Map if needed.
            </p>
            <div className="form-row-2">
              <label>
                South (lat)
                <input
                  value={boundsForm.south}
                  onChange={(e) => setBoundsForm({ ...boundsForm, south: e.target.value })}
                />
              </label>
              <label>
                West (lng)
                <input
                  value={boundsForm.west}
                  onChange={(e) => setBoundsForm({ ...boundsForm, west: e.target.value })}
                />
              </label>
            </div>
            <div className="form-row-2">
              <label>
                North (lat)
                <input
                  value={boundsForm.north}
                  onChange={(e) => setBoundsForm({ ...boundsForm, north: e.target.value })}
                />
              </label>
              <label>
                East (lng)
                <input
                  value={boundsForm.east}
                  onChange={(e) => setBoundsForm({ ...boundsForm, east: e.target.value })}
                />
              </label>
            </div>
            <div className="tt-form-actions">
              <button type="button" className="btn-secondary" onClick={applyDefaultBounds}>
                Reset to building default
              </button>
              <button type="button" className="btn-secondary" onClick={() => setBoundsPlan(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={saveBounds} disabled={boundsSaving}>
                {boundsSaving ? <span className="spinner-sm" /> : 'Save bounds'}
              </button>
            </div>
          </div>
        )}

        <div className="fp-modal-footer">
          <p className="fp-footer-hint">
            Upload each floor, then click <strong>Confirm</strong> when finished for this building.
          </p>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={closeFloorPlanModal}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleConfirmFloorPlans}
              disabled={fpUploading || boundsSaving}
            >
              <Check size={16} /> Confirm
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Building"
        message={
          deleteTarget
            ? `Delete building "${deleteTarget.name}"? All markers and floor plans will be removed.`
            : ''
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
