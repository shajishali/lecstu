import { useEffect, useState, useCallback } from 'react';
import { showToast } from '@components/Toast';
import api, { showApiErrorToast } from '@services/api';
import { useAuthStore } from '@store/authStore';
import { Search, Zap, Clock, Building, Users, ChevronDown, ChevronUp, RefreshCw, CalendarPlus, X } from 'lucide-react';

interface FreeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface HallInfo {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  equipment: string[];
}

interface OccupiedSlot {
  id: string;
  startTime: string;
  endTime: string;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string };
  group: { id: string; name: string };
}

interface AvailableResult {
  hall: HallInfo;
  freeSlots: FreeSlot[];
  matchingFreeSlots: FreeSlot[];
}

interface ScheduleData {
  hall: HallInfo;
  occupied: OccupiedSlot[];
  freeSlots: FreeSlot[];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Monday', TUESDAY: 'Tuesday', WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday', FRIDAY: 'Friday',
};

const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function getCurrentDay(): string {
  const jsDay = new Date().getDay();
  return jsDay >= 1 && jsDay <= 5 ? DAYS[jsDay - 1] : 'MONDAY';
}

/** Get next date for a day of week (MONDAY=1, etc.) */
function getNextDateForDay(dayName: string): string {
  const dayMap: Record<string, number> = {
    MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5,
  };
  const target = dayMap[dayName] ?? 1;
  const today = new Date();
  const todayNum = today.getDay() || 7; // Sun=7 for calc
  let daysAhead = target - (todayNum === 7 ? 0 : todayNum);
  if (daysAhead <= 0) daysAhead += 7;
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}

function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const min = (h - 8) * 60 + m;
  return (min / 600) * 100; // 08:00-18:00 = 600 min
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Generate 30-min time options within a slot */
function getTimeOptionsInSlot(slotStart: string, slotEnd: string): string[] {
  const startMin = timeToMinutes(slotStart);
  const endMin = timeToMinutes(slotEnd);
  const options: string[] = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    options.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  }
  return options;
}

export default function HallAvailability() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'search' | 'now'>('now');
  const [loading, setLoading] = useState(false);
  const [bookModal, setBookModal] = useState<{
    hall: HallInfo;
    slot: FreeSlot;
    date: string;
  } | null>(null);
  const [bookReason, setBookReason] = useState('');
  const [bookStartTime, setBookStartTime] = useState('');
  const [bookEndTime, setBookEndTime] = useState('');
  const [bookSubmitting, setBookSubmitting] = useState(false);

  // Filter state
  const [day, setDay] = useState(getCurrentDay());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [building, setBuilding] = useState('');
  const [equipment, setEquipment] = useState('');

  // Filter options from server
  const [buildings, setBuildings] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);

  // Results
  const [results, setResults] = useState<AvailableResult[]>([]);
  const [emptyStateDismissed, setEmptyStateDismissed] = useState(false);
  const [expandedHall, setExpandedHall] = useState<string | null>(null);
  const [hallSchedule, setHallSchedule] = useState<ScheduleData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDay, setScheduleDay] = useState(getCurrentDay());

  const fetchFilters = useCallback(async () => {
    try {
      const res = await api.get('/halls/filters');
      setBuildings(res.data.data.buildings || []);
      setEquipmentOptions(res.data.data.equipment || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchFilters(); }, [fetchFilters]);

  const searchAvailable = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { day };
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;
      if (minCapacity) params.minCapacity = minCapacity;
      if (building) params.building = building;
      if (equipment) params.equipment = equipment;

      const res = await api.get('/halls/available', { params });
      setResults(res.data.data || []);
      setExpandedHall(null);
      setHallSchedule(null);
      setEmptyStateDismissed(false);
    } catch {
      showToast('error', 'Failed to search halls');
    } finally {
      setLoading(false);
    }
  }, [day, startTime, endTime, minCapacity, building, equipment]);

  const fetchAvailableNow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/halls/available-now');
      setResults(res.data.data || []);
      setExpandedHall(null);
      setHallSchedule(null);
      setEmptyStateDismissed(false);
    } catch {
      showToast('error', 'Failed to check available halls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'now') fetchAvailableNow();
  }, [tab, fetchAvailableNow]);

  const fetchSchedule = async (hallId: string) => {
    if (expandedHall === hallId) {
      setExpandedHall(null);
      setHallSchedule(null);
      return;
    }
    setExpandedHall(hallId);
    setScheduleLoading(true);
    try {
      const res = await api.get(`/halls/${hallId}/schedule`, { params: { day: tab === 'now' ? getCurrentDay() : day } });
      setHallSchedule(res.data.data);
      setScheduleDay(tab === 'now' ? getCurrentDay() : day);
    } catch {
      showToast('error', 'Failed to load schedule');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchAvailable();
  };

  const openBookModal = (hall: HallInfo, slot: FreeSlot) => {
    const date = tab === 'now' ? new Date().toISOString().split('T')[0] : getNextDateForDay(day);
    setBookModal({ hall, slot, date });
    setBookReason('');
    setBookStartTime(slot.startTime);
    // Default end: 1 hour from start, or slot end if slot is shorter
    const slotStartMin = timeToMinutes(slot.startTime);
    const slotEndMin = timeToMinutes(slot.endTime);
    const oneHourLater = Math.min(slotStartMin + 60, slotEndMin);
    const defaultEnd = `${String(Math.floor(oneHourLater / 60)).padStart(2, '0')}:${String(oneHourLater % 60).padStart(2, '0')}`;
    setBookEndTime(defaultEnd);
  };

  const closeBookModal = () => {
    setBookModal(null);
    setBookReason('');
    setBookStartTime('');
    setBookEndTime('');
  };

  const submitHallBooking = async () => {
    if (!bookModal) return;
    if (timeToMinutes(bookEndTime) <= timeToMinutes(bookStartTime)) {
      showToast('error', 'End time must be after start time');
      return;
    }
    setBookSubmitting(true);
    try {
      await api.post('/halls/bookings', {
        hallId: bookModal.hall.id,
        date: bookModal.date,
        startTime: bookStartTime,
        endTime: bookEndTime,
        reason: bookReason || undefined,
      });
      showToast(
        'success',
        `Booking request sent for ${new Date(bookModal.date).toLocaleDateString()} • ${formatTime(bookStartTime)}–${formatTime(bookEndTime)}. Admin will review and notify you.`
      );
      closeBookModal();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      window.dispatchEvent(new CustomEvent('approvals-updated'));
    } catch (err: any) {
      showApiErrorToast(err, 'Failed to submit booking');
    } finally {
      setBookSubmitting(false);
    }
  };

  return (
    <div className="hall-avail-page">
      <div className="ha-header">
        <div>
          <h1>Hall Availability</h1>
          <p className="ha-subtitle">Find available lecture halls across campus</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="ha-tabs">
        <button
          className={`ha-tab ${tab === 'now' ? 'active' : ''}`}
          onClick={() => setTab('now')}
        >
          <Zap size={16} /> Available Now
        </button>
        <button
          className={`ha-tab ${tab === 'search' ? 'active' : ''}`}
          onClick={() => setTab('search')}
        >
          <Search size={16} /> Search
        </button>
      </div>

      {/* Search filters */}
      {tab === 'search' && (
        <form className="ha-filters" onSubmit={handleSearch}>
          <div className="ha-filter-row">
            <div className="form-group">
              <label>Day</label>
              <select value={day} onChange={(e) => setDay(e.target.value)}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{DAY_LABELS[d]}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>From</label>
              <select value={startTime} onChange={(e) => setStartTime(e.target.value)}>
                <option value="">Any</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>To</label>
              <select value={endTime} onChange={(e) => setEndTime(e.target.value)}>
                <option value="">Any</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Min Capacity</label>
              <input
                type="number"
                placeholder="e.g. 50"
                value={minCapacity}
                onChange={(e) => setMinCapacity(e.target.value)}
                min="0"
              />
            </div>
          </div>
          <div className="ha-filter-row">
            <div className="form-group">
              <label>Building</label>
              <select value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option value="">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Equipment</label>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
                <option value="">Any</option>
                {equipmentOptions.map((eq) => (
                  <option key={eq} value={eq}>{eq}</option>
                ))}
              </select>
            </div>
            <div className="form-group ha-search-btn-wrap">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Search size={16} /> {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'now' && (
        <div className="ha-now-bar">
          <span className="ha-now-indicator" />
          <span>Showing halls available right now</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchAvailableNow} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="ha-result-count">
          {results.length} hall{results.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="ha-loading">
          <div className="spinner" />
          <p>Checking availability...</p>
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length === 0 && !emptyStateDismissed && (
        <div className="ha-empty" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setEmptyStateDismissed(true)}
            className="absolute right-4 top-4 flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
            title="Close"
            aria-label="Close"
          >
            <X size={16} /> Close
          </button>
          <Building size={48} strokeWidth={1} />
          <h3>No available halls found</h3>
          <p>{tab === 'search' ? 'Try adjusting your filters.' : 'All halls are currently occupied.'}</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="ha-results">
          {results.map((r) => (
            <div key={r.hall.id} className={`ha-card ${expandedHall === r.hall.id ? 'expanded' : ''}`}>
              <div className="ha-card-header" onClick={() => fetchSchedule(r.hall.id)}>
                <div className="ha-card-info">
                  <h3>{r.hall.name}</h3>
                  <div className="ha-card-meta">
                    <span><Building size={14} /> {r.hall.building}, Floor {r.hall.floor}</span>
                    <span><Users size={14} /> {r.hall.capacity} seats</span>
                    {r.hall.equipment.length > 0 && (
                      <span className="ha-equip">{r.hall.equipment.join(', ')}</span>
                    )}
                  </div>
                </div>
                <div className="ha-card-right">
                  <div className="ha-free-count">
                    <Clock size={14} />
                    {r.matchingFreeSlots.length} free slot{r.matchingFreeSlots.length !== 1 ? 's' : ''}
                  </div>
                  {expandedHall === r.hall.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>

              {/* Free slots summary - lecturer appointment style */}
              <div className="ha-free-slots">
                {r.matchingFreeSlots.map((fs, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {formatTime(fs.startTime)} - {formatTime(fs.endTime)}
                      <span className="ml-2 text-slate-500">({fs.durationMinutes} min)</span>
                    </span>
                    {user?.role === 'STUDENT' && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                        onClick={(e) => { e.stopPropagation(); openBookModal(r.hall, fs); }}
                        title="Book this slot"
                      >
                        <CalendarPlus size={16} /> Book
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Expanded timeline */}
              {expandedHall === r.hall.id && (
                <div className="ha-expanded">
                  {scheduleLoading ? (
                    <div className="ha-loading-sm"><div className="spinner" /></div>
                  ) : hallSchedule ? (
                    <div className="ha-timeline-section">
                      <h4>{DAY_LABELS[scheduleDay] || scheduleDay} Schedule</h4>
                      <div className="ha-timeline">
                        <div className="ha-timeline-labels">
                          {['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'].map((t) => (
                            <span key={t} className="ha-tl-label">{formatTime(t)}</span>
                          ))}
                        </div>
                        <div className="ha-timeline-bar">
                          {hallSchedule.occupied.map((occ) => (
                            <div
                              key={occ.id}
                              className="ha-tl-occupied"
                              style={{
                                left: `${timeToPercent(occ.startTime)}%`,
                                width: `${timeToPercent(occ.endTime) - timeToPercent(occ.startTime)}%`,
                              }}
                              title={`${occ.course.code} - ${formatTime(occ.startTime)}-${formatTime(occ.endTime)}`}
                            >
                              <span>{occ.course.code}</span>
                            </div>
                          ))}
                          {hallSchedule.freeSlots.map((fs, i) => (
                            <div
                              key={`free-${i}`}
                              className="ha-tl-free"
                              style={{
                                left: `${timeToPercent(fs.startTime)}%`,
                                width: `${timeToPercent(fs.endTime) - timeToPercent(fs.startTime)}%`,
                              }}
                              title={`Free: ${formatTime(fs.startTime)}-${formatTime(fs.endTime)}`}
                            />
                          ))}
                        </div>
                      </div>
                      {hallSchedule.occupied.length > 0 && (
                        <div className="ha-schedule-detail">
                          {hallSchedule.occupied.map((occ) => (
                            <div key={occ.id} className="ha-occ-row">
                              <span className="ha-occ-time">
                                {formatTime(occ.startTime)} - {formatTime(occ.endTime)}
                              </span>
                              <span className="ha-occ-course">{occ.course.code} - {occ.course.name}</span>
                              <span className="ha-occ-lec">{occ.lecturer.firstName} {occ.lecturer.lastName}</span>
                              <span className="ha-occ-grp">{occ.group.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Book Hall Modal */}
      {bookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeBookModal}>
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Book Hall</h3>
              <button
                type="button"
                onClick={closeBookModal}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                title="Close"
              >
                <X size={16} /> Close
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
              <p><strong>{bookModal.hall.name}</strong> - {bookModal.hall.building}, Floor {bookModal.hall.floor}</p>
              <p className="mt-1 text-slate-600">
                {new Date(bookModal.date).toLocaleDateString()}
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Time limit (within available slot)</label>
              <p className="mb-2 text-xs text-slate-500">
                Available: {formatTime(bookModal.slot.startTime)} - {formatTime(bookModal.slot.endTime)} ({bookModal.slot.durationMinutes} min)
              </p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">From</label>
                  <select
                    value={bookStartTime}
                    onChange={(e) => {
                      setBookStartTime(e.target.value);
                      if (timeToMinutes(e.target.value) >= timeToMinutes(bookEndTime)) {
                        const opts = getTimeOptionsInSlot(bookModal.slot.startTime, bookModal.slot.endTime);
                        const idx = opts.indexOf(e.target.value);
                        if (idx < opts.length - 1) setBookEndTime(opts[idx + 1]);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  >
                    {getTimeOptionsInSlot(bookModal.slot.startTime, bookModal.slot.endTime)
                      .filter((t) => timeToMinutes(t) < timeToMinutes(bookModal.slot.endTime))
                      .map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600">To</label>
                  <select
                    value={bookEndTime}
                    onChange={(e) => setBookEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
                  >
                    {getTimeOptionsInSlot(bookModal.slot.startTime, bookModal.slot.endTime)
                      .filter((t) => timeToMinutes(t) > timeToMinutes(bookStartTime))
                      .map((t) => (
                        <option key={t} value={t}>{formatTime(t)}</option>
                      ))}
                  </select>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Duration: {timeToMinutes(bookEndTime) - timeToMinutes(bookStartTime)} min
              </p>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason (optional)</label>
              <input
                type="text"
                placeholder="e.g. Group study, project meeting"
                value={bookReason}
                onChange={(e) => setBookReason(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <p className="mb-4 text-xs text-slate-500">
              Your request will be sent to admin for approval. You will be notified when approved or rejected.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeBookModal}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitHallBooking}
                disabled={bookSubmitting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
              >
                {bookSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
