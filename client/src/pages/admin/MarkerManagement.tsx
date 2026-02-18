import { useEffect, useState, useCallback } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import MapPreview from './MapPreview';
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react';

interface Marker {
  id: string;
  floor: number;
  type: string;
  label: string;
  x: number;
  y: number;
  building: { id: string; name: string; code: string };
  hall: { id: string; name: string } | null;
  office: { id: string; roomNumber: string; lecturer: { firstName: string; lastName: string } } | null;
}

interface DropdownData {
  buildings: { id: string; name: string; code: string; floors: number }[];
  halls: { id: string; name: string }[];
  offices: { id: string; roomNumber: string; lecturer: { firstName: string; lastName: string } }[];
}

const MARKER_TYPES = ['HALL', 'OFFICE', 'LAB', 'AMENITY', 'ENTRANCE'];

const TYPE_COLORS: Record<string, string> = {
  HALL: '#3b82f6', OFFICE: '#8b5cf6', LAB: '#10b981', AMENITY: '#f59e0b', ENTRANCE: '#ef4444',
};

export default function MarkerManagement() {
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdowns, setDropdowns] = useState<DropdownData | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editMarker, setEditMarker] = useState<Marker | null>(null);
  const [form, setForm] = useState({ buildingId: '', floor: 0, type: 'HALL', label: '', x: '', y: '', hallId: '', officeId: '' });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Marker | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);

  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterType, setFilterType] = useState('');

  const fetchMarkers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterBuilding) params.buildingId = filterBuilding;
      if (filterType) params.type = filterType;
      const res = await api.get('/admin/markers', { params });
      setMarkers(res.data.data);
    } catch { showToast('error', 'Failed to load markers'); }
    finally { setLoading(false); }
  }, [filterBuilding, filterType]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const res = await api.get('/admin/markers/dropdowns');
      setDropdowns(res.data.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchMarkers(); fetchDropdowns(); }, [fetchMarkers, fetchDropdowns]);

  const openCreate = () => {
    setEditMarker(null);
    setForm({ buildingId: dropdowns?.buildings[0]?.id || '', floor: 0, type: 'HALL', label: '', x: '', y: '', hallId: '', officeId: '' });
    setFormOpen(true);
  };

  const openEdit = (m: Marker) => {
    setEditMarker(m);
    setForm({
      buildingId: m.building.id, floor: m.floor, type: m.type, label: m.label,
      x: String(m.x), y: String(m.y),
      hallId: m.hall?.id || '', officeId: m.office?.id || '',
    });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, x: parseFloat(form.x), y: parseFloat(form.y) };
      if (editMarker) {
        await api.patch(`/admin/markers/${editMarker.id}`, payload);
        showToast('success', 'Marker updated');
      } else {
        await api.post('/admin/markers', payload);
        showToast('success', 'Marker created');
      }
      setFormOpen(false);
      fetchMarkers();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/markers/${deleteTarget.id}`);
      showToast('success', 'Marker deleted');
      setDeleteTarget(null);
      fetchMarkers();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const selectedBuilding = dropdowns?.buildings.find((b) => b.id === form.buildingId);

  const entityLabel = (m: Marker) => {
    if (m.hall) return m.hall.name;
    if (m.office) return `${m.office.roomNumber} (${m.office.lecturer.firstName} ${m.office.lecturer.lastName})`;
    return '—';
  };

  const columns = [
    {
      key: 'type', label: 'Type', sortable: true,
      render: (r: Marker) => <span className="marker-type-badge" style={{ background: TYPE_COLORS[r.type] + '18', color: TYPE_COLORS[r.type] }}>{r.type}</span>,
    },
    { key: 'label', label: 'Label', sortable: true },
    { key: 'building', label: 'Building', render: (r: Marker) => r.building.name },
    { key: 'floor', label: 'Floor', sortable: true },
    { key: 'position', label: 'Position', render: (r: Marker) => `(${r.x.toFixed(1)}, ${r.y.toFixed(1)})` },
    { key: 'entity', label: 'Linked Entity', render: entityLabel },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (r: Marker) => (
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Edit"><Edit2 size={14} /></button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="admin-loading"><div className="spinner" /><p>Loading markers...</p></div>;

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div><h1>Map Markers</h1><p>{markers.length} markers</p></div>
        <div className="tt-header-actions">
          <button className="btn-secondary" onClick={() => setPreviewOpen(true)}><MapPin size={16} /> Map Preview</button>
          <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add Marker</button>
        </div>
      </div>

      {dropdowns && (
        <div className="tt-filter-panel" style={{ marginBottom: '1rem' }}>
          <div className="tt-filter-row">
            <label>Building
              <select value={filterBuilding} onChange={(e) => setFilterBuilding(e.target.value)}>
                <option value="">All Buildings</option>
                {dropdowns.buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label>Type
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {MARKER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={markers} pageSize={15} searchPlaceholder="Search markers..." emptyMessage="No markers found" />

      {/* Create/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editMarker ? 'Edit Marker' : 'Create Marker'} width="550px">
        <form onSubmit={handleSave} className="entity-form">
          <div className="form-row-2">
            <label>Building
              <select value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })} required>
                <option value="">— Select —</option>
                {dropdowns?.buildings.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
              </select>
            </label>
            <label>Floor
              <select value={form.floor} onChange={(e) => setForm({ ...form, floor: parseInt(e.target.value) })}>
                {Array.from({ length: selectedBuilding?.floors || 1 }, (_, i) => (
                  <option key={i} value={i}>Floor {i}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row-2">
            <label>Marker Type
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, hallId: '', officeId: '' })}>
                {MARKER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>Label<input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required placeholder="e.g. Main Entrance" /></label>
          </div>
          <div className="form-row-2">
            <label>X Position<input type="number" step="any" value={form.x} onChange={(e) => setForm({ ...form, x: e.target.value })} required /></label>
            <label>Y Position<input type="number" step="any" value={form.y} onChange={(e) => setForm({ ...form, y: e.target.value })} required /></label>
          </div>

          {form.type === 'HALL' && dropdowns && (
            <label>Linked Hall
              <select value={form.hallId} onChange={(e) => setForm({ ...form, hallId: e.target.value })}>
                <option value="">— None —</option>
                {dropdowns.halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
          )}

          {form.type === 'OFFICE' && dropdowns && (
            <label>Linked Office
              <select value={form.officeId} onChange={(e) => setForm({ ...form, officeId: e.target.value })}>
                <option value="">— None —</option>
                {dropdowns.offices.map((o) => <option key={o.id} value={o.id}>{o.roomNumber} ({o.lecturer.firstName} {o.lecturer.lastName})</option>)}
              </select>
            </label>
          )}

          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : (editMarker ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Modal>

      {/* Map Preview */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Map Preview" width="900px">
        <MapPreview markers={markers} buildings={dropdowns?.buildings || []} />
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Marker" message={deleteTarget ? `Delete marker "${deleteTarget.label}" from ${deleteTarget.building.name}?` : ''} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
