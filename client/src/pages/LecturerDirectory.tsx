import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { Search, User, Building, BookOpen, MapPin } from 'lucide-react';

interface LecturerItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  department: { id: string; name: string; code: string } | null;
  lecturerOffice: { id: string; roomNumber: string; building: string; floor: number } | null;
  _count: { timetableEntries: number };
}

interface Department {
  id: string;
  name: string;
  code: string;
}

export default function LecturerDirectory() {
  const navigate = useNavigate();
  const [lecturers, setLecturers] = useState<LecturerItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get('/lecturers/departments');
      setDepartments(res.data.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchLecturers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (deptFilter) params.departmentId = deptFilter;
      const res = await api.get('/lecturers', { params });
      setLecturers(res.data.data || []);
    } catch {
      showToast('error', 'Failed to load lecturers');
    } finally {
      setLoading(false);
    }
  }, [search, deptFilter]);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);
  useEffect(() => { fetchLecturers(); }, [fetchLecturers]);

  return (
    <div className="lecdir-page">
      <div className="lecdir-header">
        <h1>Lecturer Directory</h1>
        <p className="lecdir-subtitle">Browse lecturers and view their availability</p>
      </div>

      <div className="lecdir-filters">
        <div className="lecdir-search">
          <Search size={16} className="lecdir-search-icon" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
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
              className="lecdir-card"
              onClick={() => navigate(`/lecturers/${lec.id}`)}
            >
              <div className="lecdir-avatar">
                {lec.profileImage ? (
                  <img src={`/uploads/avatars/${lec.profileImage}`} alt="" />
                ) : (
                  <div className="lecdir-avatar-placeholder">
                    {lec.firstName[0]}{lec.lastName[0]}
                  </div>
                )}
              </div>
              <div className="lecdir-card-body">
                <h3>{lec.firstName} {lec.lastName}</h3>
                <p className="lecdir-email">{lec.email}</p>
                {lec.department && (
                  <span className="lecdir-dept">
                    <BookOpen size={12} /> {lec.department.name}
                  </span>
                )}
                {lec.lecturerOffice && (
                  <span className="lecdir-office">
                    <MapPin size={12} /> {lec.lecturerOffice.building}, Room {lec.lecturerOffice.roomNumber}
                  </span>
                )}
                {lec._count.timetableEntries > 0 && (
                  <span className="lecdir-classes">
                    <Building size={12} /> {lec._count.timetableEntries} class{lec._count.timetableEntries !== 1 ? 'es' : ''}/week
                  </span>
                )}
              </div>
              <div className="lecdir-card-action">
                View Availability &rarr;
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
