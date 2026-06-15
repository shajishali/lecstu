import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import type { User as UserType } from '../types/auth';
import { Link } from 'react-router-dom';
import { Camera, Save, AlertCircle, CheckCircle, User, Calendar, MapPin } from 'lucide-react';

const FCT_BUILDING_DEFAULT =
  'Faculty of Computing and Technology, University of Kelaniya';
import StudentEnrollmentForm, { parseGroupName } from '@components/StudentEnrollmentForm';

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Group {
  id: string;
  name: string;
  batchYear: number;
  batchLabel?: string | null;
  pathway?: { id: string; name: string; code: string } | null;
}

export default function Profile() {
  const { user, getMe, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    departmentId: '',
    groupId: '',
    timetableCode: '',
    officeRoom: '',
    officeBuilding: FCT_BUILDING_DEFAULT,
    officeFloor: '0',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      const primaryGroup = user.studentGroupMemberships?.[0]?.group;
      setForm({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        departmentId: user.department?.id || '',
        groupId: primaryGroup?.id || '',
        timetableCode: user.timetableCode || '',
        officeRoom: user.lecturerOffice?.roomNumber || '',
        officeBuilding: user.lecturerOffice?.building || FCT_BUILDING_DEFAULT,
        officeFloor: String(user.lecturerOffice?.floor ?? 0),
      });
    }
  }, [user]);

  useEffect(() => {
    api.get<{ success: boolean; data: { departments: Department[] } }>('/profile/departments')
      .then((res) => setDepartments(res.data.data.departments))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role === 'STUDENT') {
      api.get<{ success: boolean; data: { groups: Group[] } }>('/profile/groups')
        .then((res) => setGroups(res.data.data.groups))
        .catch(() => {});
    }
  }, [user?.role]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const primaryGroup = user?.studentGroupMemberships?.[0]?.group;
  const parsedGroup = primaryGroup ? parseGroupName(primaryGroup.name) : { program: '', year: '', pathway: '' };
  const pathwaySuffix =
    parsedGroup.pathway ||
    primaryGroup?.pathway?.code?.replace(/^(CS|ET|CT|BS)-/, '') ||
    '';

  const handleEnrollment = async (data: {
    programCode: string;
    studyYear: string;
    pathwayCode?: string;
  }) => {
    setEnrolling(true);
    try {
      const res = await api.patch<{ success: boolean; data: { user: UserType; groupName: string } }>(
        '/profile/enrollment',
        data,
      );
      const updatedUser = res.data.data?.user;
      const groupName = res.data.data?.groupName;
      if (updatedUser) {
        setUser(updatedUser);
      }
      await getMe({ silent: true });
      showMessage(
        'success',
        groupName
          ? `Enrollment updated to ${groupName}. Your profile and timetable are now in sync.`
          : 'Academic enrollment updated. Your profile and timetable are now in sync.',
      );
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showMessage('error', ax.response?.data?.message || 'Failed to update enrollment');
    } finally {
      setEnrolling(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/profile', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || null,
        ...(user.role !== 'STUDENT' && { departmentId: form.departmentId || null }),
        ...(user.role === 'LECTURER' && {
          timetableCode: form.timetableCode.trim() || null,
          office: {
            roomNumber: form.officeRoom.trim(),
            building: form.officeBuilding.trim() || FCT_BUILDING_DEFAULT,
            floor: parseInt(form.officeFloor, 10) || 0,
          },
        }),
      });
      await getMe({ silent: true });
      showMessage('success', 'Profile updated successfully');
    } catch (err: any) {
      showMessage('error', err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', 'File size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await getMe({ silent: true });
      showMessage('success', 'Avatar updated');
    } catch (err: any) {
      showMessage('error', err.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const roleBadge: Record<string, string> = {
    ADMIN: 'bg-amber-100 text-amber-800',
    LECTURER: 'bg-violet-100 text-violet-800',
    STUDENT: 'bg-[var(--color-primary-light)] text-[var(--color-primary-hover)]',
  };
  const inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] disabled:bg-slate-100 disabled:text-slate-500';

  if (!user) return null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">My Profile</h1>

      {message && (
        <div className={`mb-5 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
          message.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-600'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div
            className="relative flex h-32 w-32 cursor-pointer items-center justify-center overflow-hidden rounded-full mx-auto"
            onClick={handleAvatarClick}
          >
            {user.profileImage ? (
              <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-slate-500">
                <User size={48} />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
              {uploading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Camera size={20} className="text-white" />}
            </div>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarChange} className="hidden" />
          </div>
          <h3 className="mt-4 text-center text-lg font-semibold text-slate-900">{user.firstName} {user.lastName}</h3>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${roleBadge[user.role] || 'bg-slate-200 text-slate-600'}`}>{user.role}</span>
          <p className="mt-2 text-center text-sm text-slate-500">{user.email}</p>
          {user.role === 'LECTURER' && user.lecturerOffice && (
            <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-sm text-slate-600">
              <MapPin size={14} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
              <span>
                Room {user.lecturerOffice.roomNumber}
                {user.lecturerOffice.floor > 0 ? `, Floor ${user.lecturerOffice.floor}` : ''}
                <br />
                <span className="text-xs text-slate-500">{user.lecturerOffice.building}</span>
              </span>
            </p>
          )}
          {user.role === 'STUDENT' && user.studentGroupMemberships && user.studentGroupMemberships.length > 0 && (
            <p className="mt-2 text-center text-sm font-medium [color:var(--color-primary-hover)]">
              Group: {user.studentGroupMemberships.map((m) =>
                m.group.pathway ? `${m.group.name} (${m.group.pathway.code})` : m.group.name
              ).join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-slate-800">Edit Profile</h2>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pFirstName" className="text-sm font-semibold text-slate-700">First Name</label>
                <input id="pFirstName" type="text" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pLastName" className="text-sm font-semibold text-slate-700">Last Name</label>
                <input id="pLastName" type="text" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pEmail" className="text-sm font-semibold text-slate-700">Email</label>
              <input id="pEmail" type="email" value={user.email} disabled className={inputCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pPhone" className="text-sm font-semibold text-slate-700">Phone</label>
              <input id="pPhone" type="text" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="e.g. +94 77 123 4567" className={inputCls} />
            </div>
            {user.role === 'LECTURER' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pTimetableCode" className="text-sm font-semibold text-slate-700">
                  Timetable code (FET)
                </label>
                <input
                  id="pTimetableCode"
                  type="text"
                  value={form.timetableCode}
                  onChange={(e) => update('timetableCode', e.target.value.toUpperCase())}
                  placeholder="e.g. KP, ND, KVS"
                  className={inputCls}
                />
                <p className="text-xs text-slate-500">
                  Leave blank to auto-generate: first letter of first name + first letter of last name
                  (e.g. Lahiru Kumara → LK, Nimal Perera → NP). Shown on your directory card only — your
                  weekly availability is edited under My Schedule.
                </p>
                <Link
                  to="/lecturer/schedule"
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] hover:underline"
                >
                  <Calendar size={14} /> Edit my weekly schedule
                </Link>
              </div>
            )}
            {user.role === 'LECTURER' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MapPin size={16} className="text-[var(--color-primary)]" />
                  <h3 className="text-sm font-semibold text-slate-800">Office location</h3>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Shown on the Lecturers directory, your public profile, and appointment confirmations so students can find you easily.
                </p>
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pOfficeRoom" className="text-sm font-semibold text-slate-700">
                        Room / office number
                      </label>
                      <input
                        id="pOfficeRoom"
                        type="text"
                        value={form.officeRoom}
                        onChange={(e) => update('officeRoom', e.target.value)}
                        placeholder="e.g. LB-CMP-03-5, CT-105"
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="pOfficeFloor" className="text-sm font-semibold text-slate-700">
                        Floor
                      </label>
                      <input
                        id="pOfficeFloor"
                        type="number"
                        min={0}
                        max={20}
                        value={form.officeFloor}
                        onChange={(e) => update('officeFloor', e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="pOfficeBuilding" className="text-sm font-semibold text-slate-700">
                      Building
                    </label>
                    <input
                      id="pOfficeBuilding"
                      type="text"
                      value={form.officeBuilding}
                      onChange={(e) => update('officeBuilding', e.target.value)}
                      placeholder={FCT_BUILDING_DEFAULT}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            )}
            {user.role !== 'STUDENT' && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pDept" className="text-sm font-semibold text-slate-700">Department</label>
                <select id="pDept" value={form.departmentId} onChange={(e) => update('departmentId', e.target.value)} className={inputCls}>
                  <option value="">- None -</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">Role</label>
              <input type="text" value={user.role} disabled className={inputCls} />
            </div>
            <button type="submit" disabled={saving} className="mt-2 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]">
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><Save size={16} /> Save Changes</>}
            </button>
          </form>

          {user.role === 'STUDENT' && (
            <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">Current class group</label>
                <input
                  type="text"
                  readOnly
                  value={primaryGroup?.name ?? 'Not assigned'}
                  className={inputCls}
                />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800">Academic year enrollment</h3>
                <StudentEnrollmentForm
                  key={primaryGroup?.id ?? 'no-group'}
                  initialProgram={parsedGroup.program}
                  initialYear={parsedGroup.year || primaryGroup?.batchLabel || ''}
                  initialPathway={pathwaySuffix}
                  onSubmit={handleEnrollment}
                  submitting={enrolling}
                  submitLabel="Update for new study year"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
