import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { Plus, Edit2, Trash2, Upload, Image, X } from 'lucide-react';

interface FloorPlan {
  id: string;
  floor: number;
  imagePath: string;
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
  const fpFileRef = useRef<HTMLInputElement>(null);

  const fetchBuildings = useCallback(async () => {
    try {
      const res = await api.get('/admin/buildings');
      setBuildings(res.data.data);
    } catch { showToast('error', 'Failed to load buildings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBuildings(); }, [fetchBuildings]);

  const openCreate = () => {
    setEditBuilding(null);
    setForm({ name: '', code: '', latitude: '', longitude: '', floors: 1 });
    setFormOpen(true);
  };

  const openEdit = (b: Building) => {
    setEditBuilding(b);
    setForm({ name: b.name, code: b.code, latitude: String(b.latitude), longitude: String(b.longitude), floors: b.floors });
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
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/buildings/${deleteTarget.id}`);
      showToast('success', 'Building deleted');
      setDeleteTarget(null);
      fetchBuildings();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const openFloorPlans = (b: Building) => {
    setFpBuilding(b);
    setFpFloor(0);
    setFloorPlanOpen(true);
  };

  const handleFloorPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fpBuilding) return;
    setFpUploading(true);
    try {
      const fd = new FormData();
      fd.append('floorplan', file);
      fd.append('floor', String(fpFloor));
      await api.post(`/admin/buildings/${fpBuilding.id}/floorplan`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('success', `Floor ${fpFloor} plan uploaded`);
      fetchBuildings();
      const res = await api.get(`/admin/buildings/${fpBuilding.id}`);
      setFpBuilding(res.data.data);
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Upload failed');
    } finally {
      setFpUploading(false);
      if (fpFileRef.current) fpFileRef.current.value = '';
    }
  };

  const handleDeleteFloorPlan = async (planId: string) => {
    if (!fpBuilding) return;
    try {
      await api.delete(`/admin/buildings/${fpBuilding.id}/floorplan/${planId}`);
      showToast('success', 'Floor plan deleted');
      fetchBuildings();
      const res = await api.get(`/admin/buildings/${fpBuilding.id}`);
      setFpBuilding(res.data.data);
    } catch { showToast('error', 'Failed to delete floor plan'); }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'code', label: 'Code', sortable: true },
    { key: 'floors', label: 'Floors', sortable: true },
    {
      key: 'coordinates', label: 'Coordinates', sortable: false,
      render: (r: Building) => <span className="coords-text">{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</span>,
    },
    { key: 'markers', label: 'Markers', render: (r: Building) => r._count.markers },
    { key: 'plans', label: 'Floor Plans', render: (r: Building) => r._count.floorPlans },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (r: Building) => (
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openFloorPlans(r); }} title="Floor Plans"><Image size={14} /></button>
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Edit"><Edit2 size={14} /></button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="admin-loading"><div className="spinner" /><p>Loading buildings...</p></div>;

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div><h1>Buildings</h1><p>{buildings.length} buildings</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add Building</button>
      </div>

      <DataTable columns={columns} data={buildings} pageSize={15} searchPlaceholder="Search buildings..." emptyMessage="No buildings found" />

      {/* Create/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editBuilding ? 'Edit Building' : 'Create Building'} width="500px">
        <form onSubmit={handleSave} className="entity-form">
          <div className="form-row-2">
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="e.g. MAIN" /></label>
          </div>
          <div className="form-row-2">
            <label>Latitude<input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required /></label>
            <label>Longitude<input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required /></label>
          </div>
          <label>Number of Floors<input type="number" value={form.floors} onChange={(e) => setForm({ ...form, floors: parseInt(e.target.value) })} min={1} max={30} required /></label>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : (editBuilding ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Modal>

      {/* Floor Plans Modal */}
      <Modal open={floorPlanOpen} onClose={() => setFloorPlanOpen(false)} title={`Floor Plans — ${fpBuilding?.name || ''}`} width="600px">
        <div className="fp-upload-row">
          <label>
            Floor
            <select value={fpFloor} onChange={(e) => setFpFloor(parseInt(e.target.value))}>
              {Array.from({ length: fpBuilding?.floors || 1 }, (_, i) => (
                <option key={i} value={i}>Floor {i}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={() => fpFileRef.current?.click()} disabled={fpUploading}>
            {fpUploading ? <span className="spinner-sm" /> : <><Upload size={14} /> Upload</>}
          </button>
          <input ref={fpFileRef} type="file" accept="image/*" onChange={handleFloorPlanUpload} hidden />
        </div>

        <div className="fp-list">
          {fpBuilding?.floorPlans && fpBuilding.floorPlans.length > 0 ? (
            fpBuilding.floorPlans.map((fp) => (
              <div key={fp.id} className="fp-item">
                <div className="fp-info">
                  <strong>Floor {fp.floor}</strong>
                  <img src={fp.imagePath} alt={`Floor ${fp.floor}`} className="fp-thumb" />
                </div>
                <button className="tt-action-btn delete" onClick={() => handleDeleteFloorPlan(fp.id)} title="Delete"><X size={14} /></button>
              </div>
            ))
          ) : (
            <p className="empty-text">No floor plans uploaded yet</p>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Building" message={deleteTarget ? `Delete building "${deleteTarget.name}"? All markers and floor plans will be removed.` : ''} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
