import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import api, { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';
import DataTable from '@components/DataTable';
import Modal from '@components/Modal';
import ConfirmDialog from '@components/ConfirmDialog';
import { useAuthStore } from '@store/authStore';
import { useStudentEnrollmentOptions, useEnrollmentFields } from '@hooks/useStudentEnrollmentOptions';
import type { UserRole } from '../../types/auth';
import {
  Plus,
  Edit2,
  KeyRound,
  UserCheck,
  UserX,
  Users,
  GraduationCap,
  Shield,
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  recoveryEmail?: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone: string | null;
  designation: string | null;
  timetableCode: string | null;
  isActive: boolean;
  createdAt: string;
  department: { id: string; name: string; code: string } | null;
  studentGroupMemberships: { group: { id: string; name: string; batchLabel: string | null } }[];
  lecturerOffice: { id: string; roomNumber: string; building: string } | null;
}

type RoleFilter = 'ALL' | UserRole | 'INACTIVE';

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  LECTURER: 'Lecturer',
  STUDENT: 'Student',
};

function parseGroupName(name: string): { program: string; year: string; pathway: string } {
  const parts = name.split('-');
  if (parts.length >= 2 && parts[1]?.match(/^Y[1-4]$/i)) {
    return {
      program: parts[0],
      year: parts[1].toUpperCase(),
      pathway: parts.length >= 3 ? parts.slice(2).join('-') : '',
    };
  }
  return { program: '', year: '', pathway: '' };
}

const emptyCreateForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'STUDENT' as UserRole,
  phone: '',
  departmentId: '',
  designation: '',
  timetableCode: '',
  programCode: '',
  studyYear: '',
  pathwayCode: '',
});

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const { programs, loading: programsLoading } = useStudentEnrollmentOptions();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [creating, setCreating] = useState(false);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    recoveryEmail: '',
    departmentId: '',
    designation: '',
    timetableCode: '',
    programCode: '',
    studyYear: '',
    pathwayCode: '',
  });
  const [saving, setSaving] = useState(false);

  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState(false);

  const createEnrollment = useEnrollmentFields(
    programs,
    createForm.programCode,
    createForm.studyYear,
    createForm.pathwayCode,
  );

  const editEnrollment = useEnrollmentFields(
    programs,
    editForm.programCode,
    editForm.studyYear,
    editForm.pathwayCode,
  );

  const fetchUsers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (roleFilter === 'INACTIVE') params.active = 'false';
      else if (roleFilter !== 'ALL') {
        params.role = roleFilter;
        params.active = 'true';
      }
      const res = await api.get('/admin/users', { params });
      setUsers(res.data.data || []);
    } catch (err) {
      showApiErrorToast(err, 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [roleFilter]);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/profile/departments');
      const data = res.data.data;
      setDepartments(Array.isArray(data) ? data : data.departments || []);
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const counts = useMemo(() => {
    const active = users.filter((u) => u.isActive);
    return {
      total: users.length,
      students: active.filter((u) => u.role === 'STUDENT').length,
      lecturers: active.filter((u) => u.role === 'LECTURER').length,
      admins: active.filter((u) => u.role === 'ADMIN').length,
      inactive: users.filter((u) => !u.isActive).length,
    };
  }, [users]);

  const openCreate = () => {
    setCreateForm(emptyCreateForm());
    setCreateOpen(true);
  };

  const openEdit = (u: AdminUser) => {
    const groupName = u.studentGroupMemberships[0]?.group?.name || '';
    const parsed = parseGroupName(groupName);
    setEditUser(u);
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone || '',
      recoveryEmail: u.recoveryEmail || '',
      departmentId: u.department?.id || '',
      designation: u.designation || '',
      timetableCode: u.timetableCode || '',
      programCode: parsed.program,
      studyYear: parsed.year,
      pathwayCode: parsed.pathway,
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
      const payload: Record<string, unknown> = {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
        phone: createForm.phone.trim() || undefined,
      };
      if (createForm.role === 'STUDENT') {
        payload.programCode = createForm.programCode;
        payload.studyYear = createForm.studyYear;
        if (createEnrollment.needsPathway) payload.pathwayCode = createForm.pathwayCode;
      } else {
        if (createForm.departmentId) payload.departmentId = createForm.departmentId;
        if (createForm.role === 'LECTURER') {
          payload.designation = createForm.designation.trim() || undefined;
          payload.timetableCode = createForm.timetableCode.trim() || undefined;
        }
      }
      await api.post('/admin/users', payload);
      showToast('success', 'User created');
      setCreateOpen(false);
      fetchUsers();
    } catch (err) {
      showApiErrorToast(err, 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        phone: editForm.phone.trim() || null,
        recoveryEmail: editForm.recoveryEmail.trim() || null,
      };
      if (editUser.role === 'LECTURER' || editUser.role === 'ADMIN') {
        payload.departmentId = editForm.departmentId || null;
      }
      if (editUser.role === 'LECTURER') {
        payload.designation = editForm.designation.trim() || null;
        payload.timetableCode = editForm.timetableCode.trim() || null;
      }
      if (editUser.role === 'STUDENT') {
        payload.programCode = editForm.programCode;
        payload.studyYear = editForm.studyYear;
        if (editEnrollment.needsPathway) payload.pathwayCode = editForm.pathwayCode;
      }
      await api.patch(`/admin/users/${editUser.id}`, payload);
      showToast('success', 'User updated');
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      showApiErrorToast(err, 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (newPassword.length < 8) {
      showToast('error', 'Password must be at least 8 characters');
      return;
    }
    setResetting(true);
    try {
      await api.patch(`/admin/users/${passwordUser.id}/password`, { password: newPassword });
      showToast('success', 'Password reset');
      setPasswordUser(null);
      setNewPassword('');
    } catch (err) {
      showApiErrorToast(err, 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    setToggling(true);
    try {
      await api.patch(`/admin/users/${toggleTarget.id}`, { isActive: !toggleTarget.isActive });
      showToast('success', toggleTarget.isActive ? 'User deactivated' : 'User activated');
      setToggleTarget(null);
      fetchUsers();
    } catch (err) {
      showApiErrorToast(err, 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (u: AdminUser) => (
        <div>
          <strong>{u.firstName} {u.lastName}</strong>
          {!u.isActive && <span className="ml-2 text-xs text-rose-600 font-medium">Inactive</span>}
        </div>
      ),
    },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (u: AdminUser) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
            u.role === 'ADMIN'
              ? 'bg-violet-100 text-violet-800'
              : u.role === 'LECTURER'
                ? 'bg-sky-100 text-sky-800'
                : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {ROLE_LABELS[u.role]}
        </span>
      ),
    },
    {
      key: 'detail',
      label: 'Class / Dept',
      render: (u: AdminUser) => {
        if (u.role === 'STUDENT') {
          const g = u.studentGroupMemberships[0]?.group?.name;
          return g || '—';
        }
        if (u.department) return u.department.code;
        return '—';
      },
    },
    {
      key: 'timetableCode',
      label: 'Code',
      render: (u: AdminUser) => u.timetableCode || '—',
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      render: (u: AdminUser) => (
        <div className="tt-actions">
          <button type="button" className="tt-action-btn edit" title="Edit" onClick={() => openEdit(u)}>
            <Edit2 size={14} />
          </button>
          <button type="button" className="tt-action-btn edit" title="Reset password" onClick={() => { setPasswordUser(u); setNewPassword(''); }}>
            <KeyRound size={14} />
          </button>
          {u.id !== currentUser?.id && (
            <button
              type="button"
              className={`tt-action-btn ${u.isActive ? 'delete' : 'edit'}`}
              title={u.isActive ? 'Deactivate' : 'Activate'}
              onClick={() => setToggleTarget(u)}
            >
              {u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
            </button>
          )}
        </div>
      ),
    },
  ];

  const filterTabs: { key: RoleFilter; label: string; icon?: React.ReactNode }[] = [
    { key: 'ALL', label: 'All', icon: <Users size={14} /> },
    { key: 'STUDENT', label: 'Students', icon: <GraduationCap size={14} /> },
    { key: 'LECTURER', label: 'Lecturers' },
    { key: 'ADMIN', label: 'Admins', icon: <Shield size={14} /> },
    { key: 'INACTIVE', label: 'Inactive' },
  ];

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="entity-mgmt">
      <div className="admin-page-header">
        <div>
          <h1>User Management</h1>
          <p>Create accounts, assign students to groups, and manage access</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Shown', value: counts.total },
          { label: 'Students', value: counts.students },
          { label: 'Lecturers', value: counts.lecturers },
          { label: 'Admins', value: counts.admins },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`btn btn-sm ${roleFilter === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={users.map((u) => ({ ...u, name: `${u.firstName} ${u.lastName}` }))}
        pageSize={15}
        searchPlaceholder="Search name, email, timetable code..."
        emptyMessage="No users match this filter"
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create User" width="520px">
        <form onSubmit={handleCreate} className="entity-form">
          <div className="grid grid-cols-2 gap-3">
            <label>
              First name
              <input value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} required />
            </label>
            <label>
              Last name
              <input value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} required />
            </label>
          </div>
          <label>
            Email
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={8} />
          </label>
          <label>
            Role
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
            >
              <option value="STUDENT">Student</option>
              <option value="LECTURER">Lecturer</option>
              <option value="ADMIN">Admin</option>
            </select>
          </label>
          <label>
            Phone <span className="text-slate-500 text-xs">(optional)</span>
            <input value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
          </label>

          {createForm.role === 'STUDENT' && (
            <>
              <label>
                Degree program
                <select
                  value={createForm.programCode}
                  onChange={(e) => setCreateForm({ ...createForm, programCode: e.target.value, studyYear: '', pathwayCode: '' })}
                  required
                  disabled={programsLoading}
                >
                  <option value="">Select program</option>
                  {programs.map((p) => (
                    <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Study year
                <select
                  value={createForm.studyYear}
                  onChange={(e) => setCreateForm({ ...createForm, studyYear: e.target.value, pathwayCode: '' })}
                  required
                  disabled={!createForm.programCode}
                >
                  <option value="">Select year</option>
                  {createEnrollment.yearOptions.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              {createEnrollment.needsPathway && (
                <label>
                  Pathway
                  <select
                    value={createForm.pathwayCode}
                    onChange={(e) => setCreateForm({ ...createForm, pathwayCode: e.target.value })}
                    required
                  >
                    <option value="">Select pathway</option>
                    {createEnrollment.pathwayOptions.map((p) => (
                      <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}

          {(createForm.role === 'LECTURER' || createForm.role === 'ADMIN') && (
            <label>
              Department
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
          )}

          {createForm.role === 'LECTURER' && (
            <>
              <label>
                Designation
                <input value={createForm.designation} onChange={(e) => setCreateForm({ ...createForm, designation: e.target.value })} placeholder="Senior Lecturer" />
              </label>
              <label>
                Timetable code <span className="text-slate-500 text-xs">(optional — auto from name if empty)</span>
                <input value={createForm.timetableCode} onChange={(e) => setCreateForm({ ...createForm, timetableCode: e.target.value })} placeholder="KP" />
              </label>
            </>
          )}

          <div className="tt-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? <span className="spinner-sm" /> : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={editUser ? `Edit — ${editUser.firstName} ${editUser.lastName}` : 'Edit'} width="520px">
        {editUser && (
          <form onSubmit={handleSaveEdit} className="entity-form">
            <p className="text-sm text-slate-600 mb-2">{editUser.email} · {ROLE_LABELS[editUser.role]}</p>
            <div className="grid grid-cols-2 gap-3">
              <label>
                First name
                <input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
              </label>
              <label>
                Last name
                <input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required />
              </label>
            </div>
            <label>
              Phone
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </label>
            <label>
              Recovery email (password reset)
              <input
                type="email"
                value={editForm.recoveryEmail}
                onChange={(e) => setEditForm({ ...editForm, recoveryEmail: e.target.value })}
                placeholder="personal Gmail for reset codes"
              />
              <span className="text-xs text-slate-500">
                Optional. Reset codes go here instead of {editUser.email} when set. Use when
                university mail blocks external senders.
              </span>
            </label>

            {editUser.role === 'STUDENT' && (
              <>
                <label>
                  Degree program
                  <select
                    value={editForm.programCode}
                    onChange={(e) => setEditForm({ ...editForm, programCode: e.target.value, studyYear: '', pathwayCode: '' })}
                    required
                  >
                    <option value="">Select program</option>
                    {programs.map((p) => (
                      <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Study year
                  <select
                    value={editForm.studyYear}
                    onChange={(e) => setEditForm({ ...editForm, studyYear: e.target.value, pathwayCode: '' })}
                    required
                  >
                    <option value="">Select year</option>
                    {editEnrollment.yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                {editEnrollment.needsPathway && (
                  <label>
                    Pathway
                    <select
                      value={editForm.pathwayCode}
                      onChange={(e) => setEditForm({ ...editForm, pathwayCode: e.target.value })}
                      required
                    >
                      <option value="">Select pathway</option>
                      {editEnrollment.pathwayOptions.map((p) => (
                        <option key={p.code} value={p.code}>{p.code} — {p.name}</option>
                      ))}
                    </select>
                  </label>
                )}
              </>
            )}

            {(editUser.role === 'LECTURER' || editUser.role === 'ADMIN') && (
              <label>
                Department
                <select value={editForm.departmentId} onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}>
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            )}

            {editUser.role === 'LECTURER' && (
              <>
                <label>
                  Designation
                  <input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} />
                </label>
                <label>
                  Timetable code
                  <input value={editForm.timetableCode} onChange={(e) => setEditForm({ ...editForm, timetableCode: e.target.value })} />
                </label>
              </>
            )}

            <div className="tt-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <span className="spinner-sm" /> : 'Save'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!passwordUser} onClose={() => setPasswordUser(null)} title="Reset password" width="400px">
        {passwordUser && (
          <form onSubmit={handleResetPassword} className="entity-form">
            <p className="text-sm text-slate-600">
              Set a new password for <strong>{passwordUser.firstName} {passwordUser.lastName}</strong>
            </p>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            <p className="text-xs text-slate-500">At least 8 characters, one uppercase letter, and one number.</p>
            <div className="tt-form-actions">
              <button type="button" className="btn-secondary" onClick={() => setPasswordUser(null)}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={resetting}>
                {resetting ? <span className="spinner-sm" /> : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toggleTarget}
        title={toggleTarget?.isActive ? 'Deactivate user' : 'Activate user'}
        message={
          toggleTarget
            ? toggleTarget.isActive
              ? `${toggleTarget.firstName} ${toggleTarget.lastName} will not be able to sign in.`
              : `${toggleTarget.firstName} ${toggleTarget.lastName} will be able to sign in again.`
            : ''
        }
        confirmLabel={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
        onConfirm={handleToggleActive}
        onCancel={() => setToggleTarget(null)}
        loading={toggling}
      />
    </div>
  );
}
