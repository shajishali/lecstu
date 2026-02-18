import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '@store/authStore';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { Printer, Download, RefreshCw } from 'lucide-react';

interface SlotData {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; capacity: number };
  group: { id: string; name: string; batchYear: number };
}

type WeeklyTimetable = Record<string, SlotData[]>;

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
};

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
];

const COURSE_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#2563eb',
  '#65a30d', '#9333ea', '#c026d3', '#0284c7', '#ca8a04',
];

function getCourseColor(courseId: string, colorMap: Map<string, string>): string {
  if (colorMap.has(courseId)) return colorMap.get(courseId)!;
  const color = COURSE_COLORS[colorMap.size % COURSE_COLORS.length];
  colorMap.set(courseId, color);
  return color;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function getCurrentDayIndex(): number {
  const jsDay = new Date().getDay(); // 0=Sun
  return jsDay >= 1 && jsDay <= 5 ? jsDay - 1 : -1;
}

function getCurrentTimePosition(): number | null {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const startHour = 8;
  const endHour = 18;

  if (hours < startHour || hours >= endHour) return null;

  const totalMinutes = (hours - startHour) * 60 + minutes;
  const totalRange = (endHour - startHour) * 60;
  return (totalMinutes / totalRange) * 100;
}

function getSlotPosition(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = (sh - 8) * 60 + sm;
  const endMin = (eh - 8) * 60 + em;
  const totalRange = 10 * 60; // 08:00 to 18:00
  return {
    top: (startMin / totalRange) * 100,
    height: ((endMin - startMin) / totalRange) * 100,
  };
}

export default function MyTimetable() {
  const { user } = useAuthStore();
  const [weekly, setWeekly] = useState<WeeklyTimetable>({});
  const [flat, setFlat] = useState<SlotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
  const colorMap = useRef(new Map<string, string>());
  const gridRef = useRef<HTMLDivElement>(null);

  const fetchTimetable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/timetable/my');
      const data = res.data.data;
      setWeekly(data.weekly || {});
      setFlat(data.flat || []);
      colorMap.current.clear();
    } catch {
      showToast('error', 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  useEffect(() => {
    const update = () => setCurrentTimePos(getCurrentTimePosition());
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePrint = () => window.print();

  const handleExport = () => {
    if (flat.length === 0) return;
    const header = 'Day,Start,End,Course,Lecturer,Hall,Group';
    const rows = flat.map(
      (s) =>
        `${s.dayOfWeek},${s.startTime},${s.endTime},${s.course.code} - ${s.course.name},${s.lecturer.firstName} ${s.lecturer.lastName},${s.hall.name} (${s.hall.building}),${s.group.name}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timetable-${user?.firstName || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const todayIdx = getCurrentDayIndex();

  if (loading) {
    return (
      <div className="timetable-page">
        <div className="loading-screen"><div className="spinner" /><p>Loading timetable...</p></div>
      </div>
    );
  }

  return (
    <div className="timetable-page">
      <div className="tt-header">
        <div>
          <h1>My Timetable</h1>
          <p className="tt-subtitle">
            {user?.role === 'STUDENT' ? 'Student' : 'Lecturer'} schedule —{' '}
            {flat.length} slot{flat.length !== 1 ? 's' : ''} this semester
          </p>
        </div>
        <div className="tt-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchTimetable} title="Refresh">
            <RefreshCw size={16} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print">
            <Printer size={16} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={flat.length === 0}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {flat.length === 0 ? (
        <div className="tt-empty">
          <h3>No timetable entries found</h3>
          <p>
            {user?.role === 'STUDENT'
              ? 'You may not be assigned to any student groups yet. Contact your admin.'
              : 'No lectures assigned to you this semester.'}
          </p>
        </div>
      ) : (
        <div className="tt-grid-wrapper" ref={gridRef}>
          <div className="tt-grid">
            {/* Time column */}
            <div className="tt-time-col">
              <div className="tt-corner" />
              {TIME_SLOTS.map((t) => (
                <div key={t} className="tt-time-label">{formatTime(t)}</div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS.map((day, dayIdx) => {
              const slots = weekly[day] || [];
              return (
                <div key={day} className={`tt-day-col ${dayIdx === todayIdx ? 'tt-today' : ''}`}>
                  <div className={`tt-day-header ${dayIdx === todayIdx ? 'active' : ''}`}>
                    {DAY_LABELS[day]}
                    {dayIdx === todayIdx && <span className="tt-today-dot" />}
                  </div>
                  <div className="tt-day-body">
                    {slots.map((slot) => {
                      const { top, height } = getSlotPosition(slot.startTime, slot.endTime);
                      const color = getCourseColor(slot.course.id, colorMap.current);
                      return (
                        <div
                          key={slot.id}
                          className="tt-slot"
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            backgroundColor: `${color}15`,
                            borderLeft: `3px solid ${color}`,
                          }}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <span className="tt-slot-code" style={{ color }}>{slot.course.code}</span>
                          <span className="tt-slot-name">{slot.course.name}</span>
                          <span className="tt-slot-meta">{slot.hall.name}</span>
                        </div>
                      );
                    })}

                    {dayIdx === todayIdx && currentTimePos !== null && (
                      <div className="tt-now-line" style={{ top: `${currentTimePos}%` }}>
                        <div className="tt-now-dot" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="tt-legend">
            {Array.from(colorMap.current.entries()).map(([courseId, color]) => {
              const course = flat.find((s) => s.course.id === courseId)?.course;
              if (!course) return null;
              return (
                <div key={courseId} className="tt-legend-item">
                  <span className="tt-legend-dot" style={{ backgroundColor: color }} />
                  <span>{course.code} — {course.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedSlot && (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="modal tt-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Slot Details</h3>
              <button className="btn-close" onClick={() => setSelectedSlot(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="tt-detail-grid">
                <div className="tt-detail-row">
                  <label>Course</label>
                  <span>{selectedSlot.course.code} — {selectedSlot.course.name}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Day</label>
                  <span>{selectedSlot.dayOfWeek}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Time</label>
                  <span>{formatTime(selectedSlot.startTime)} – {formatTime(selectedSlot.endTime)}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Lecturer</label>
                  <span>{selectedSlot.lecturer.firstName} {selectedSlot.lecturer.lastName}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Hall</label>
                  <span>{selectedSlot.hall.name} ({selectedSlot.hall.building})</span>
                </div>
                <div className="tt-detail-row">
                  <label>Capacity</label>
                  <span>{selectedSlot.hall.capacity} seats</span>
                </div>
                <div className="tt-detail-row">
                  <label>Group</label>
                  <span>{selectedSlot.group.name} (Batch {selectedSlot.group.batchYear})</span>
                </div>
                <div className="tt-detail-row">
                  <label>Semester / Year</label>
                  <span>Semester {selectedSlot.semester}, {selectedSlot.year}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
