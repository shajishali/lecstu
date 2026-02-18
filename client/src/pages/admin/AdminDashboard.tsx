import { useEffect, useState } from 'react';
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

  useEffect(() => {
    api
      .get('/admin/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => showToast('error', 'Failed to load admin statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="spinner" />
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
    { label: 'Manage Users', path: '/admin/users', icon: <Users size={16} /> },
    { label: 'Manage Timetable', path: '/admin/timetable', icon: <Calendar size={16} /> },
    { label: 'Manage Halls', path: '/admin/halls', icon: <Building size={16} /> },
    { label: 'Manage Courses', path: '/admin/courses', icon: <BookOpen size={16} /> },
    { label: 'Manage Groups', path: '/admin/groups', icon: <Layers size={16} /> },
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-page-header">
        <h1>Admin Dashboard</h1>
        <p>Manage platform data and monitor statistics</p>
      </div>

      <div className="admin-stats-grid">
        {cards.map((c) => (
          <div key={c.label} className="admin-stat-card">
            <div className="stat-icon" style={{ backgroundColor: c.color + '18', color: c.color }}>
              {c.icon}
            </div>
            <div className="stat-info">
              <span className="stat-value">{c.value}</span>
              <span className="stat-label">{c.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-section">
        <h2>Quick Actions</h2>
        <div className="admin-quick-actions">
          {quickActions.map((a) => (
            <button key={a.label} className="quick-action-btn" onClick={() => navigate(a.path)}>
              {a.icon}
              <span>{a.label}</span>
              <ArrowRight size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="admin-section">
        <h2>Academic Summary</h2>
        <div className="admin-summary-grid">
          <div className="summary-card">
            <h3>Faculties</h3>
            <span className="summary-value">{stats.academic.faculties}</span>
          </div>
          <div className="summary-card">
            <h3>Departments</h3>
            <span className="summary-value">{stats.academic.departments}</span>
          </div>
          <div className="summary-card">
            <h3>Offices</h3>
            <span className="summary-value">{stats.facilities.offices}</span>
          </div>
          <div className="summary-card">
            <h3>Appointments</h3>
            <span className="summary-value">{stats.operations.appointments}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
