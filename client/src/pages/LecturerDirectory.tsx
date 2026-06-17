import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { Search, User, Building, BookOpen, MapPin, Calendar } from 'lucide-react';

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

export default function LecturerDirectory() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const initialLoadDone = useRef(false);

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

  const fetchLecturers = useCallback(async (opts?: { background?: boolean }) => {
    const key = cacheKey(search, deptFilter);
    const cached = cachedLecturers;
    if (cached && cached.key === key && Date.now() - cached.at < CACHE_TTL_MS) {
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
        <h1>Lecturer Directory</h1>
        <p className="lecdir-subtitle">
          Browse lecturers, office locations, and book appointments using each lecturer&apos;s own schedule
        </p>
      </div>

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
        </div>
      ) : (
        <div className="lecdir-grid">
          {lecturers.map((lec) => (
            <div
              key={lec.id}
              className="group lecdir-card"
              onClick={() => openProfile(lec)}
              onKeyDown={(e) => e.key === 'Enter' && openProfile(lec)}
              role="button"
              tabIndex={0}
            >
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
    </div>
  );
}
