import { useEffect, useState, useCallback } from 'react';
import api from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import {
  Plus, Edit2, Trash2, Users, UserPlus, UserMinus,
} from 'lucide-react';

interface Group {
  id: string;
  name: string;
  batchYear: number;
  department: { id: string; name: string; code: string };
  _count: { members: number; timetableEntries: number };
  members?: { student: { id: string; firstName: string; lastName: string; email: string } }[];
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export default function GroupManagement() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [form, setForm] = useState({ name: '', batchYear: 2026, departmentId: '' });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [membersOpen, setMembersOpen] = useState(false);
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get('/admin/groups');
      setGroups(res.data.data);
    } catch { showToast('error', 'Failed to load groups'); }
    finally { setLoading(false); }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/profile/departments');
      const data = res.data.data;
      setDepartments(Array.isArray(data) ? data : data.departments || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchGroups(); fetchDepartments(); }, [fetchGroups, fetchDepartments]);

  const openCreate = () => {
    setEditGroup(null);
    setForm({ name: '', batchYear: 2026, departmentId: departments[0]?.id || '' });
    setFormOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditGroup(g);
    setForm({ name: g.name, batchYear: g.batchYear, departmentId: g.department.id });
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editGroup) {
        await api.patch(`/admin/groups/${editGroup.id}`, form);
        showToast('success', 'Group updated');
      } else {
        await api.post('/admin/groups', form);
        showToast('success', 'Group created');
      }
      setFormOpen(false);
      fetchGroups();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/groups/${deleteTarget.id}`);
      showToast('success', 'Group deleted');
      setDeleteTarget(null);
      fetchGroups();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to delete');
    } finally { setDeleting(false); }
  };

  const openMembers = async (g: Group) => {
    setMembersLoading(true);
    setMembersOpen(true);
    try {
      const res = await api.get(`/admin/groups/${g.id}`);
      setMembersGroup(res.data.data);
    } catch { showToast('error', 'Failed to load members'); }
    finally { setMembersLoading(false); }
  };

  const removeMember = async (studentId: string) => {
    if (!membersGroup) return;
    try {
      await api.delete(`/admin/groups/${membersGroup.id}/students/${studentId}`);
      showToast('success', 'Student removed');
      openMembers(membersGroup);
      fetchGroups();
    } catch { showToast('error', 'Failed to remove student'); }
  };

  const openAssign = async () => {
    if (!membersGroup) return;
    setAssignOpen(true);
    setSelectedStudents([]);
    try {
      const res = await api.get(`/admin/groups/${membersGroup.id}/available-students`);
      setAvailableStudents(res.data.data);
    } catch { showToast('error', 'Failed to load students'); }
  };

  const handleAssign = async () => {
    if (!membersGroup || selectedStudents.length === 0) return;
    setAssigning(true);
    try {
      const res = await api.post(`/admin/groups/${membersGroup.id}/students`, { studentIds: selectedStudents });
      showToast('success', res.data.message);
      setAssignOpen(false);
      openMembers(membersGroup);
      fetchGroups();
    } catch { showToast('error', 'Failed to assign students'); }
    finally { setAssigning(false); }
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'batchYear', label: 'Batch Year', sortable: true },
    { key: 'department', label: 'Department', render: (r: Group) => r.department.name },
    { key: 'members', label: 'Students', render: (r: Group) => r._count.members },
    { key: 'entries', label: 'Timetable', render: (r: Group) => r._count.timetableEntries },
    {
      key: 'actions', label: 'Actions', sortable: false,
      render: (r: Group) => (
        <div className="tt-actions">
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openMembers(r); }} title="Members"><Users size={14} /></button>
          <button className="tt-action-btn edit" onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Edit"><Edit2 size={14} /></button>
          <button className="tt-action-btn delete" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }} title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="admin-loading"><div className="spinner" /><p>Loading groups...</p></div>;

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div><h1>Student Groups</h1><p>{groups.length} groups</p></div>
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Add Group</button>
      </div>

      <DataTable columns={columns} data={groups} pageSize={15} searchPlaceholder="Search groups..." emptyMessage="No groups found" />

      {/* Create/Edit Modal */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editGroup ? 'Edit Group' : 'Create Group'} width="450px">
        <form onSubmit={handleSave} className="entity-form">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label>Batch Year<input type="number" value={form.batchYear} onChange={(e) => setForm({ ...form, batchYear: parseInt(e.target.value) })} min={2020} max={2100} required /></label>
          <label>Department
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
              <option value="">— Select —</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? <span className="spinner-sm" /> : (editGroup ? 'Update' : 'Create')}</button>
          </div>
        </form>
      </Modal>

      {/* Members Modal */}
      <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`Members — ${membersGroup?.name || ''}`} width="600px">
        {membersLoading ? <div className="admin-loading"><div className="spinner" /></div> : (
          <>
            <div className="members-toolbar">
              <span>{membersGroup?.members?.length || 0} students</span>
              <button className="btn-primary" onClick={openAssign}><UserPlus size={14} /> Assign Students</button>
            </div>
            <div className="members-list">
              {membersGroup?.members?.map((m) => (
                <div key={m.student.id} className="member-row">
                  <div>
                    <strong>{m.student.firstName} {m.student.lastName}</strong>
                    <span className="member-email">{m.student.email}</span>
                  </div>
                  <button className="tt-action-btn delete" onClick={() => removeMember(m.student.id)} title="Remove"><UserMinus size={14} /></button>
                </div>
              ))}
              {(!membersGroup?.members || membersGroup.members.length === 0) && (
                <p className="empty-text">No students assigned yet</p>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Assign Students Modal */}
      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title="Assign Students" width="550px">
        <div className="assign-list">
          {availableStudents.length === 0 ? (
            <p className="empty-text">No available students</p>
          ) : (
            availableStudents.map((s) => (
              <label key={s.id} className="assign-item">
                <input type="checkbox" checked={selectedStudents.includes(s.id)} onChange={() => toggleStudent(s.id)} />
                <span>{s.firstName} {s.lastName} <span className="member-email">{s.email}</span></span>
              </label>
            ))
          )}
        </div>
        <div className="tt-form-actions">
          <span className="assign-count">{selectedStudents.length} selected</span>
          <button className="btn-secondary" onClick={() => setAssignOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleAssign} disabled={assigning || selectedStudents.length === 0}>
            {assigning ? <span className="spinner-sm" /> : 'Assign'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} title="Delete Group" message={deleteTarget ? `Delete group "${deleteTarget.name}"? This will remove all member assignments.` : ''} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  );
}
