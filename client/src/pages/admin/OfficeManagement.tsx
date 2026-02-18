import { useEffect, useState, useCallback } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface Office {
  id: string;
  roomNumber: string;
  building: string;
  floor: number;
  lecturer: { id: string; firstName: string; lastName: string; email: string };
}

interface Lecturer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function OfficeManagement() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editOffice, setEditOffice] = useState<Office | null>(null);
  const [form, setForm] = useState({ roomNumber: '', building: '', floor: 0, lecturerId: '' });
  const [availableLecturers, setAvailableLecturers] = useState<Lecturer[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Office | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchOffices = useCallback(async () => {
    try {
      const res = await api.get('/admin/offices');
      setOffices(res.data.data);
    } catch { showToast('error', 'Failed to load offices'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOffices(); }, [fetchOffices]);

  const fetchAvailableLecturers = async () => {
    try {
      const res = await api.get('/admin/offices/available-lecturers');
      setAvailableLecturers(res.data.data);
    } catch { /* ignore */ }
  };

  const openCreate = async () => {
    setEditOffice(null);
    setForm({ roomNumber: '', building: '', floor: 0, lecturerId: '' });
    await fetchAvailableLecturers();
    setFormOpen(true);
  };

  const openEdit = async (o: Office) => {
    setEditOffice(o);
    setForm({ roomNumber: o.roomNumber, building: o.building, floor: o.floor, lecturerId: o.lecturer.id });
    await fetchAvailableLecturers();
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editOffice) {
        await api.patch(`/admin/offices/${editOffice.id}`, form);
        showToast('success', 'Office updated');
      } else {
        await api.post('/admin/offices', form);
        showToast('success', 'Office created');
      }
      setFormOpen(false);
      fetchOffices();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/offices/${deleteTarget.id}`);
      showToast('success', 'Office deleted');
      setDeleteTarget(null);
      fetchOffices();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const allLecturers = editOffice
    ? [{ id: editOffice.lecturer.id, firstName: editOffice.lecturer.firstName, lastName: editOffice.lecturer.lastName, email: editOffice.lecturer.email }, ...availableLecturers]
    : availableLecturers;

  const columns = [
    { key: 'roomNumber', label: 'Room', sortable: true },
    { key: 'building', label: 'Building', sortable: true },
    { key: 'floor', label: 'Floor', sortable: true },
    {
      key: 'lecturer', label: 'Lecturer',
      render: (r: Office) => `${r.lecturer.firstName} ${r.lecturer.lastName}`,
    },
    {
      key: 'email', label: 'Email', sortable: false,
      render: (r: Office) => <span className="member-email">{r.lecturer.email}</span>,
    },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (r: Office) => (
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Edit"><Edit2 size={14} /></button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="admin-loading"><div className="spinner" /><p>Loading offices...</p></div>;

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div><h1>Lecturer Offices</h1><p>{offices.length} offices</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add Office</button>
      </div>

      <DataTable columns={columns} data={offices} pageSize={15} searchPlaceholder="Search offices..." emptyMessage="No offices found" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editOffice ? 'Edit Office' : 'Assign Office'} width="480px">
        <form onSubmit={handleSave} className="entity-form">
          <label>Lecturer
            <select value={form.lecturerId} onChange={(e) => setForm({ ...form, lecturerId: e.target.value })} required>
              <option value="">— Select Lecturer —</option>
              {allLecturers.map((l) => (
                <option key={l.id} value={l.id}>{l.firstName} {l.lastName} ({l.email})</option>
              ))}
            </select>
          </label>
          <div className="form-row-2">
            <label>Room Number<input value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} required /></label>
            <label>Building<input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} required /></label>
          </div>
          <label>Floor<input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: parseInt(e.target.value) })} min={-2} max={20} /></label>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : (editOffice ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Office" message={deleteTarget ? `Delete office "${deleteTarget.roomNumber}" (${deleteTarget.lecturer.firstName} ${deleteTarget.lecturer.lastName})?` : ''} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
