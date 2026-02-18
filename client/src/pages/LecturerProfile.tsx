import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { ArrowLeft, Mail, Phone, MapPin, BookOpen, Building } from 'lucide-react';

interface LecturerData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  department: { id: string; name: string; code: string } | null;
  office: { id: string; roomNumber: string; building: string; floor: number } | null;
  courses: { id: string; name: string; code: string }[];
}

interface TimeSlot {
  startTime: string;
  endTime: string;
}

interface TeachingSlot extends TimeSlot {
  course: { id: string; name: string; code: string };
  hall: { id: string; name: string; building: string };
  group: { id: string; name: string };
}

interface AppointmentSlot extends TimeSlot {
  id: string;
  status: string;
  studentName: string;
}

interface DayAvailability {
  day: string;
  teaching: TeachingSlot[];
  appointments: AppointmentSlot[];
  freeSlots: TimeSlot[];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_SHORT: Record<string, string> = {
  MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri',
};

const HOUR_SLOTS = Array.from({ length: 10 }, (_, i) => i + 8); // 8–17

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

type CellType = 'free' | 'teaching' | 'appointment';

interface CellData {
  type: CellType;
  label?: string;
  detail?: string;
}

function buildGrid(weekly: DayAvailability[]): Record<string, Record<number, CellData>> {
  const grid: Record<string, Record<number, CellData>> = {};

  for (const day of DAYS) {
    grid[day] = {};
    for (const h of HOUR_SLOTS) {
      grid[day][h] = { type: 'free' };
    }
  }

  for (const dayData of weekly) {
    for (const slot of dayData.teaching) {
      const startH = Math.floor(timeToMinutes(slot.startTime) / 60);
      const endH = Math.ceil(timeToMinutes(slot.endTime) / 60);
      for (let h = startH; h < endH && h <= 17; h++) {
        if (h >= 8) {
          grid[dayData.day][h] = {
            type: 'teaching',
            label: slot.course.code,
            detail: `${slot.course.name}\n${slot.hall.name} (${slot.hall.building})\n${slot.group.name}`,
          };
        }
      }
    }
    for (const appt of dayData.appointments) {
      const startH = Math.floor(timeToMinutes(appt.startTime) / 60);
      const endH = Math.ceil(timeToMinutes(appt.endTime) / 60);
      for (let h = startH; h < endH && h <= 17; h++) {
        if (h >= 8) {
          grid[dayData.day][h] = {
            type: 'appointment',
            label: appt.status === 'PENDING' ? 'Pending' : 'Booked',
            detail: `Appointment with ${appt.studentName}\n${formatTime(appt.startTime)} – ${formatTime(appt.endTime)}`,
          };
        }
      }
    }
  }

  return grid;
}

export default function LecturerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lecturer, setLecturer] = useState<LecturerData | null>(null);
  const [weekly, setWeekly] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ day: string; hour: number } | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [profRes, availRes] = await Promise.all([
        api.get(`/lecturers/${id}`),
        api.get(`/lecturers/${id}/availability`),
      ]);
      setLecturer(profRes.data.data);
      setWeekly(availRes.data.data || []);
    } catch {
      showToast('error', 'Failed to load lecturer data');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="lecprof-page">
        <div className="ha-loading"><div className="spinner" /><p>Loading lecturer profile...</p></div>
      </div>
    );
  }

  if (!lecturer) {
    return (
      <div className="lecprof-page">
        <div className="ha-empty"><h3>Lecturer not found</h3></div>
      </div>
    );
  }

  const grid = buildGrid(weekly);

  const totalFree = weekly.reduce((sum, d) => sum + d.freeSlots.length, 0);
  const totalTeaching = weekly.reduce((sum, d) => sum + d.teaching.length, 0);

  return (
    <div className="lecprof-page">
      <button className="btn btn-secondary btn-sm lecprof-back" onClick={() => navigate('/lecturers')}>
        <ArrowLeft size={16} /> Back to Directory
      </button>

      {/* Profile card */}
      <div className="lecprof-card">
        <div className="lecprof-avatar">
          {lecturer.profileImage ? (
            <img src={`/uploads/avatars/${lecturer.profileImage}`} alt="" />
          ) : (
            <div className="lecdir-avatar-placeholder large">
              {lecturer.firstName[0]}{lecturer.lastName[0]}
            </div>
          )}
        </div>
        <div className="lecprof-info">
          <h1>{lecturer.firstName} {lecturer.lastName}</h1>
          <div className="lecprof-meta">
            <span><Mail size={14} /> {lecturer.email}</span>
            {lecturer.phone && <span><Phone size={14} /> {lecturer.phone}</span>}
            {lecturer.department && (
              <span><BookOpen size={14} /> {lecturer.department.name}</span>
            )}
            {lecturer.office && (
              <span><MapPin size={14} /> {lecturer.office.building}, Room {lecturer.office.roomNumber}, Floor {lecturer.office.floor}</span>
            )}
          </div>
          {lecturer.courses.length > 0 && (
            <div className="lecprof-courses">
              <Building size={14} />
              {lecturer.courses.map((c) => (
                <span key={c.id} className="lecprof-course-badge">{c.code}</span>
              ))}
            </div>
          )}
        </div>
        <div className="lecprof-stats">
          <div className="lecprof-stat">
            <span className="lecprof-stat-num">{totalTeaching}</span>
            <span className="lecprof-stat-label">Classes/week</span>
          </div>
          <div className="lecprof-stat">
            <span className="lecprof-stat-num free">{totalFree}</span>
            <span className="lecprof-stat-label">Free slots</span>
          </div>
        </div>
      </div>

      {/* Availability grid */}
      <div className="lecprof-avail-section">
        <h2>Weekly Availability</h2>
        <div className="lecprof-legend">
          <span className="lecprof-legend-item"><span className="lecprof-dot free" /> Free</span>
          <span className="lecprof-legend-item"><span className="lecprof-dot teaching" /> Teaching</span>
          <span className="lecprof-legend-item"><span className="lecprof-dot appointment" /> Booked</span>
        </div>

        <div className="lecprof-grid-wrap">
          <div className="lecprof-grid">
            {/* Header row */}
            <div className="lecprof-grid-corner" />
            {DAYS.map((d) => (
              <div key={d} className="lecprof-grid-day">{DAY_SHORT[d]}</div>
            ))}

            {/* Hour rows */}
            {HOUR_SLOTS.map((h) => (
              <>
                <div key={`label-${h}`} className="lecprof-grid-hour">
                  {formatTime(`${String(h).padStart(2, '0')}:00`)}
                </div>
                {DAYS.map((d) => {
                  const cell = grid[d]?.[h] || { type: 'free' as CellType };
                  const isHovered = hoveredCell?.day === d && hoveredCell?.hour === h;
                  return (
                    <div
                      key={`${d}-${h}`}
                      className={`lecprof-grid-cell ${cell.type}${isHovered ? ' hovered' : ''}`}
                      onMouseEnter={() => setHoveredCell({ day: d, hour: h })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={cell.detail || (cell.type === 'free' ? 'Available' : '')}
                    >
                      {cell.label && <span className="lecprof-cell-label">{cell.label}</span>}
                    </div>
                  );
                })}
              </>
            ))}
          </div>
        </div>
      </div>

      {/* Daily detail */}
      <div className="lecprof-daily-detail">
        <h3>Daily Breakdown</h3>
        {weekly.map((dayData) => (
          <div key={dayData.day} className="lecprof-day-row">
            <div className="lecprof-day-label">{DAY_SHORT[dayData.day]}</div>
            <div className="lecprof-day-slots">
              {dayData.freeSlots.length === 0 ? (
                <span className="lecprof-no-free">No free slots</span>
              ) : (
                dayData.freeSlots.map((fs, i) => (
                  <span key={i} className="ha-slot-badge free">
                    {formatTime(fs.startTime)} – {formatTime(fs.endTime)}
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
