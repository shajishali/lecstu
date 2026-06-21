import { useEffect, useState, useCallback, useRef, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { showToast } from '@components/Toast';
import api, { showApiErrorToast } from '@services/api';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { Search, User, Building, BookOpen, MapPin, Calendar, Plus, Edit2, Trash2, Clock } from 'lucide-react';

interface AdminLastModified {
  at: string;
  by: { firstName: string; lastName: string } | null;
}

interface TeachingHall {
  name: string;
  building: string;
}

interface LecturerItem {
  id: string;
  firstName: string;
  lastName: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  profileImage: string | null;
  timetableCode: string | null;
  derivedFromName?: boolean;
  bookable: boolean;
  isFetOnly: boolean;
  department: { id: string; name: string; code: string } | null;
  lecturerOffice: { id: string; roomNumber: string; building: string; floor: number } | null;
  teachingHalls: TeachingHall[];
  _count: { scheduleSlots: number };
  adminLastModified?: AdminLastModified | null;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

const CACHE_TTL_MS = 60_000;
let cachedLecturers: { key: string; data: LecturerItem[]; at: number } | null = null;

function cacheKey(search: string, deptFilter: string) {
  return `${search}::${deptFilter}`;
}

function clearLecturerCache() {
  cachedLecturers = null;
}

function formatAdminModified(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function adminModifiedLabel(info: AdminLastModified): string {
  const when = formatAdminModified(info.at);
  const who = info.by ? `${info.by.firstName} ${info.by.lastName}` : 'Admin';
  return `Updated by ${who} · ${when}`;
}

const emptyCreateForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  departmentId: '',
  designation: '',
  timetableCode: '',
});

export default function LecturerDirectory() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const initialLoadDone = useRef(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [editLecturer, setEditLecturer] = useState<LecturerItem | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
    designation: '',
    timetableCode: '',
  });
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<LecturerItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/lecturers/departments');
      setDepartments(res.data.data || []);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchLecturers = useCallback(async (opts?: { background?: boolean; force?: boolean }) => {
    const key = cacheKey(search, deptFilter);
    const cached = cachedLecturers;
    if (!opts?.force && cached && cached.key === key && Date.now() - cached.at < CACHE_TTL_MS) {
      setLecturers(cached.data);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (opts?.background) setRefreshing(true);
    else setLoading(true);

    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (deptFilter) params.departmentId = deptFilter;
      const res = await api.get('/lecturers', { params });
      const data = res.data.data || [];
      cachedLecturers = { key, data, at: Date.now() };
      setLecturers(data);
    } catch {
      showToast('error', 'Failed to load lecturers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, deptFilter]);

  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      void Promise.all([fetchDepartments(), fetchLecturers()]);
      return;
    }
    void fetchLecturers({ background: true });
  }, [fetchDepartments, fetchLecturers]);

  const refreshList = () => {
    clearLecturerCache();
    void fetchLecturers({ background: true, force: true });
  };

  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setCreateOpen(true);
  };

  const openEdit = (lec: LecturerItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditLecturer(lec);
    setEditForm({
      firstName: lec.firstName,
      lastName: lec.lastName,
      phone: lec.phone || '',
      departmentId: lec.department?.id || '',
      designation: lec.designation || '',
      timetableCode: lec.timetableCode || '',
    });
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (createForm.password.length < 8) {
      showToast('error', 'Password must be at least 8 characters');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/users', {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: 'LECTURER',
        phone: createForm.phone.trim() || undefined,
        departmentId: createForm.departmentId || undefined,
        designation: createForm.designation.trim() || undefined,
        timetableCode: createForm.timetableCode.trim() || undefined,
      });
      showToast('success', 'Lecturer added');
      setCreateOpen(false);
      refreshList();
    } catch (err) {
      showApiErrorToast(err, 'Failed to add lecturer');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editLecturer) return;
    setSaving(true);
    try {
      await api.patch(`/admin/users/${editLecturer.id}`, {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim() || null,
        departmentId: editForm.departmentId || null,
        designation: editForm.designation.trim() || null,
        timetableCode: editForm.timetableCode.trim() || null,
      });
      showToast('success', 'Lecturer updated');
      setEditLecturer(null);
      refreshList();
    } catch (err) {
      showApiErrorToast(err, 'Failed to update lecturer');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      showToast('success', 'Lecturer removed');
      setDeleteTarget(null);
      refreshList();
    } catch (err) {
      showApiErrorToast(err, 'Failed to remove lecturer');
    } finally {
      setDeleting(false);
    }
  };

  const openProfile = (lec: LecturerItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigate(`/lecturers/${lec.id}`);
  };

  const bookAppointment = (lec: LecturerItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!lec.bookable) {
      showToast('info', 'This lecturer must register with a timetable code before students can book.');
      return;
    }
    navigate(`/appointments/book/${lec.id}`);
  };

  return (
    <div className="lecdir-page">
      <div className="lecdir-header">
        <div>
          <h1>Lecturer Directory</h1>
          <p className="lecdir-subtitle">
            Browse lecturers, office locations, and book appointments using each lecturer&apos;s own schedule
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary btn-sm lecdir-add-btn" onClick={openCreate}>
            <Plus size={16} /> Add Lecturer
          </button>
        )}
      </div>

      {isAdmin && (
        <p className="lecdir-admin-hint">
          As admin you can add lecturers, edit their details, or remove duplicate entries.
          Lecturers you add or edit appear at the top with the last updated date.
        </p>
      )}

      <div className="lecdir-filters">
        <div className="lecdir-search">
          <Search size={16} className="lecdir-search-icon" />
          <input
            type="text"
            placeholder="Search by name, email, or timetable code..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {refreshing && (
          <span className="text-sm text-slate-500">Updating...</span>
        )}
      </div>

      {loading ? (
        <div className="ha-loading"><div className="spinner" /><p>Loading lecturers...</p></div>
      ) : lecturers.length === 0 ? (
        <div className="ha-empty">
          <User size={48} strokeWidth={1} />
          <h3>No lecturers found</h3>
          <p>Try adjusting your search or filter.</p>
          {isAdmin && (
            <button type="button" className="btn btn-primary btn-sm mt-3" onClick={openCreate}>
              <Plus size={16} /> Add Lecturer
            </button>
          )}
        </div>
      ) : (
        <div className="lecdir-grid">
          {lecturers.map((lec) => (
            <div
              key={lec.id}
              className={`group lecdir-card${isAdmin && lec.adminLastModified ? ' lecdir-card-admin-updated' : ''}`}
              onClick={() => openProfile(lec)}
              onKeyDown={(e) => e.key === 'Enter' && openProfile(lec)}
              role="button"
              tabIndex={0}
            >
              {isAdmin && (
                <div className="lecdir-admin-actions">
                  <button
                    type="button"
                    className="lecdir-admin-btn edit"
                    title="Edit lecturer"
                    onClick={(e) => openEdit(lec, e)}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="lecdir-admin-btn delete"
                    title="Remove lecturer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(lec);
                    }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              )}
              <div className="lecdir-avatar">
                {lec.profileImage ? (
                  <img src={`/uploads/avatars/${lec.profileImage}`} alt="" />
                ) : (
                  <div className="lecdir-avatar-placeholder">
                    {(lec.firstName[0] || '?')}{(lec.lastName[0] || '')}
                  </div>
                )}
              </div>
              <div className="lecdir-card-body">
                <h3>
                  {lec.firstName} {lec.lastName}
                  {lec.timetableCode && (
                    <span className="lecdir-code-badge"> {lec.timetableCode}</span>
                  )}
                </h3>
                {lec.timetableCode && lec.derivedFromName && (
                  <p className="lecdir-designation text-slate-500">
                    Short code from name (first + last initial → {lec.timetableCode})
                  </p>
                )}
                {lec.timetableCode && !lec.derivedFromName && !lec.isFetOnly && (
                  <p className="lecdir-designation">Timetable code: {lec.timetableCode}</p>
                )}
                {lec.designation && !lec.isFetOnly && (
                  <p className="lecdir-designation">{lec.designation}</p>
                )}
                {lec.email && <p className="lecdir-email">{lec.email}</p>}
                {isAdmin && lec.adminLastModified && (
                  <span className="lecdir-admin-updated" title={adminModifiedLabel(lec.adminLastModified)}>
                    <Clock size={12} />
                    {adminModifiedLabel(lec.adminLastModified)}
                  </span>
                )}
                {lec.department && (
                  <span className="lecdir-dept">
                    <BookOpen size={12} /> {lec.department.name}
                  </span>
                )}
                {lec.lecturerOffice && (
                  <span className="lecdir-office">
                    <MapPin size={12} /> Office: {lec.lecturerOffice.building}, Room {lec.lecturerOffice.roomNumber}
                  </span>
                )}
                {lec.teachingHalls.length > 0 && (
                  <span className="lecdir-office" title={lec.teachingHalls.map((h) => h.name).join(', ')}>
                    <Building size={12} /> Teaches at: {lec.teachingHalls.slice(0, 2).map((h) => h.name).join(', ')}
                    {lec.teachingHalls.length > 2 ? ` +${lec.teachingHalls.length - 2}` : ''}
                  </span>
                )}
                {lec._count.scheduleSlots > 0 && (
                  <span className="lecdir-classes">
                    <Calendar size={12} /> {lec._count.scheduleSlots} schedule block{lec._count.scheduleSlots !== 1 ? 's' : ''}/week
                  </span>
                )}
              </div>
              <div className="lecdir-card-actions">
                <button
                  type="button"
                  className="lecdir-card-action"
                  onClick={(e) => openProfile(lec, e)}
                >
                  View Availability <span className="lecdir-card-action-arrow">→</span>
                </button>
                {user?.role === 'STUDENT' && lec.bookable && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm lecdir-book-btn"
                    onClick={(e) => bookAppointment(lec, e)}
                  >
                    Book Appointment
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Lecturer" width="480px">
        <form onSubmit={handleCreate} className="entity-form entity-form-compact">
          <div className="form-row-2">
            <label>
              <span className="form-field-label">First name</span>
              <input
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                required
              />
            </label>
            <label>
              <span className="form-field-label">Last name</span>
              <input
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                required
              />
            </label>
          </div>
          <label>
            Email
            <input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
              minLength={8}
            />
          </label>
          <div className="form-row-2">
            <label>
              <span className="form-field-label whitespace-nowrap">
                Phone <span className="text-xs font-normal text-slate-500">(optional)</span>
              </span>
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </label>
            <label>
              <span className="form-field-label">Department</span>
              <select
                value={createForm.departmentId}
                onChange={(e) => setCreateForm({ ...createForm, departmentId: e.target.value })}
              >
                <option value="">— None —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row-2">
            <label>
              <span className="form-field-label">Designation</span>
              <input
                value={createForm.designation}
                onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })}
                placeholder="Senior Lecturer"
              />
            </label>
            <label>
              <span className="form-field-label">Timetable code</span>
              <input
                value={createForm.timetableCode}
                onChange={(e) => setCreateForm({ ...createForm, timetableCode: e.target.value })}
                placeholder="KP (auto if empty)"
              />
            </label>
          </div>
          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? <span className="spinner-sm" /> : 'Add Lecturer'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editLecturer}
        onClose={() => setEditLecturer(null)}
        title={editLecturer ? `Edit — ${editLecturer.firstName} ${editLecturer.lastName}` : 'Edit Lecturer'}
        width="480px"
      >
        {editLecturer && (
          <form onSubmit={handleSaveEdit} className="entity-form entity-form-compact">
            {editLecturer.email && (
              <p className="text-sm text-slate-600">{editLecturer.email}</p>
            )}
            <div className="form-row-2">
              <label>
                <span className="form-field-label">First name</span>
                <input
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  required
                />
              </label>
              <label>
                <span className="form-field-label">Last name</span>
                <input
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  required
                />
              </label>
            </div>
            <div className="form-row-2">
              <label>
                <span className="form-field-label">Phone</span>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </label>
              <label>
                <span className="form-field-label">Department</span>
                <select
                  value={editForm.departmentId}
                  onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                >
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row-2">
              <label>
                <span className="form-field-label">Designation</span>
                <input
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                />
              </label>
              <label>
                <span className="form-field-label">Timetable code</span>
                <input
                  value={editForm.timetableCode}
                  onChange={(e) => setEditForm({ ...editForm, timetableCode: e.target.value })}
                />
              </label>
            </div>
            <div className="tt-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditLecturer(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <span className="spinner-sm" /> : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove Lecturer"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.firstName} ${deleteTarget.lastName} from the directory? Their account, schedule slots, timetable entries, and appointments will be permanently deleted. Use this to remove duplicate lecturer records.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
