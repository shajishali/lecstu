import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@services/api';
import { showToast } from '@components/Toast';
import {
  Users,
  GraduationCap,
  BookOpen,
  Building,
  Calendar,
  MapPin,
  UserCheck,
  Layers,
  ArrowRight,
  CheckSquare,
} from 'lucide-react';

interface Stats {
  users: { total: number; students: number; lecturers: number; admins: number };
  academic: { faculties: number; departments: number; courses: number; groups: number };
  facilities: { halls: number; offices: number; buildings: number };
  operations: { timetableEntries: number; appointments: number };
}

const DEFAULT: Stats = {
  users: { total: 0, students: 0, lecturers: 0, admins: 0 },
  academic: { faculties: 0, departments: 0, courses: 0, groups: 0 },
  facilities: { halls: 0, offices: 0, buildings: 0 },
  operations: { timetableEntries: 0, appointments: 0 },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const toastShown = useRef(false);

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => {
        const d = res.data?.data;
        if (d && typeof d === 'object') {
          setStats({
            users: { ...DEFAULT.users, ...d.users },
            academic: { ...DEFAULT.academic, ...d.academic },
            facilities: { ...DEFAULT.facilities, ...d.facilities },
            operations: { ...DEFAULT.operations, ...d.operations },
          });
        }
      })
      .catch((err: { response?: { status?: number } }) => {
        const status = err?.response?.status;
        if (status === 401 || status === 403) return;
        if (!toastShown.current) {
          toastShown.current = true;
          showToast('error', 'Failed to load admin statistics');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--color-primary)]" />
        <p>Loading admin dashboard...</p>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: stats.users.total, icon: <Users size={22} />, color: '#3b82f6' },
    { label: 'Students', value: stats.users.students, icon: <GraduationCap size={22} />, color: '#10b981' },
    { label: 'Lecturers', value: stats.users.lecturers, icon: <UserCheck size={22} />, color: '#8b5cf6' },
    { label: 'Courses', value: stats.academic.courses, icon: <BookOpen size={22} />, color: '#f59e0b' },
    { label: 'Student Groups', value: stats.academic.groups, icon: <Layers size={22} />, color: '#ef4444' },
    { label: 'Lecture Halls', value: stats.facilities.halls, icon: <Building size={22} />, color: '#06b6d4' },
    { label: 'Timetable Entries', value: stats.operations.timetableEntries, icon: <Calendar size={22} />, color: '#ec4899' },
    { label: 'Buildings', value: stats.facilities.buildings, icon: <MapPin size={22} />, color: '#14b8a6' },
  ];

  const quickActions = [
    { label: 'Approvals', path: '/admin/approvals', icon: <CheckSquare size={16} /> },
    { label: 'Manage Users', path: '/admin/users', icon: <Users size={16} /> },
    { label: 'Manage Timetable', path: '/admin/timetable', icon: <Calendar size={16} /> },
    { label: 'Manage Halls', path: '/admin/halls', icon: <Building size={16} /> },
    { label: 'Manage Courses', path: '/admin/courses', icon: <BookOpen size={16} /> },
    { label: 'Manage Groups', path: '/admin/groups', icon: <Layers size={16} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Manage platform data and monitor statistics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: c.color + '18', color: c.color }}
            >
              {c.icon}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xl font-bold text-slate-900">{c.value}</span>
              <span className="text-sm text-slate-500">{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map((a) => (
            <button
              key={a.label}
              type="button"
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              onClick={() => navigate(a.path)}
            >
              {a.icon}
              <span>{a.label}</span>
              <ArrowRight size={14} className="text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Academic Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Faculties</h3>
            <span className="mt-1 block text-2xl font-bold text-slate-900">{stats.academic.faculties}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Departments</h3>
            <span className="mt-1 block text-2xl font-bold text-slate-900">{stats.academic.departments}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Offices</h3>
            <span className="mt-1 block text-2xl font-bold text-slate-900">{stats.facilities.offices}</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-medium text-slate-500">Appointments</h3>
            <span className="mt-1 block text-2xl font-bold text-slate-900">{stats.operations.appointments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
