import { useEffect, useState, useCallback } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface Hall {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  equipment: string[];
  isActive: boolean;
  _count: { timetableEntries: number };
}

const EMPTY_FORM = { name: '', building: '', floor: 0, capacity: 50, equipment: [] as string[], isActive: true };

export default function HallManagement() {
  const [halls, setHalls] = useState<Hall[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editHall, setEditHall] = useState<Hall | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [equipInput, setEquipInput] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Hall | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHalls = useCallback(async () => {
    try {
      const res = await api.get('/admin/halls');
      setHalls(res.data.data);
    } catch { showToast('error', 'Failed to load halls'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHalls(); }, [fetchHalls]);

  const openCreate = () => {
    setEditHall(null);
    setForm({ ...EMPTY_FORM });
    setEquipInput('');
    setFormOpen(true);
  };

  const openEdit = (h: Hall) => {
    setEditHall(h);
    setForm({ name: h.name, building: h.building, floor: h.floor, capacity: h.capacity, equipment: [...h.equipment], isActive: h.isActive });
    setEquipInput('');
    setFormOpen(true);
  };

  const addEquipment = () => {
    const val = equipInput.trim();
    if (val && !form.equipment.includes(val)) {
      setForm({ ...form, equipment: [...form.equipment, val] });
    }
    setEquipInput('');
  };

  const removeEquipment = (item: string) => {
    setForm({ ...form, equipment: form.equipment.filter((e) => e !== item) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editHall) {
        await api.patch(`/admin/halls/${editHall.id}`, form);
        showToast('success', 'Hall updated');
      } else {
        await api.post('/admin/halls', form);
        showToast('success', 'Hall created');
      }
      setFormOpen(false);
      fetchHalls();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/halls/${deleteTarget.id}`);
      showToast('success', 'Hall deleted');
      setDeleteTarget(null);
      fetchHalls();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'building', label: 'Building', sortable: true },
    { key: 'floor', label: 'Floor', sortable: true },
    { key: 'capacity', label: 'Capacity', sortable: true },
    {
      key: 'equipment', label: 'Equipment',
      render: (r: Hall) => r.equipment.length > 0
        ? <div className="equip-tags">{r.equipment.map((e) => <span key={e} className="equip-tag">{e}</span>)}</div>
        : '—',
    },
    {
      key: 'isActive', label: 'Status',
      render: (r: Hall) => <span className={`status-badge ${r.isActive ? 'active' : 'inactive'}`}>{r.isActive ? 'Active' : 'Inactive'}</span>,
    },
    { key: 'entries', label: 'Timetable', render: (r: Hall) => r._count.timetableEntries },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (r: Hall) => (
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Edit"><Edit2 size={14} /></button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="admin-loading"><div className="spinner" /><p>Loading halls...</p></div>;

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div><h1>Lecture Halls</h1><p>{halls.length} halls</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add Hall</button>
      </div>

      <DataTable columns={columns} data={halls} pageSize={15} searchPlaceholder="Search halls..." emptyMessage="No halls found" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editHall ? 'Edit Hall' : 'Create Hall'} width="500px">
        <form onSubmit={handleSave} className="entity-form">
          <div className="form-row-2">
            <label>Hall Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Building<input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} required /></label>
          </div>
          <div className="form-row-2">
            <label>Floor<input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: parseInt(e.target.value) })} min={-2} max={20} /></label>
            <label>Capacity<input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })} min={1} required /></label>
          </div>
          <label>
            Equipment
            <div className="equip-input-row">
              <input value={equipInput} onChange={(e) => setEquipInput(e.target.value)} placeholder="e.g. Projector" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEquipment(); } }} />
              <button type="button" className="btn-secondary" onClick={addEquipment}>Add</button>
            </div>
            {form.equipment.length > 0 && (
              <div className="equip-tags" style={{ marginTop: '0.4rem' }}>
                {form.equipment.map((eq) => (
                  <span key={eq} className="equip-tag removable" onClick={() => removeEquipment(eq)}>{eq} <X size={12} /></span>
                ))}
              </div>
            )}
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Active
          </label>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : (editHall ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Hall" message={deleteTarget ? `Delete hall "${deleteTarget.name}"? ${deleteTarget._count.timetableEntries > 0 ? `It has ${deleteTarget._count.timetableEntries} timetable entries which will also be deleted.` : ''}` : ''} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
