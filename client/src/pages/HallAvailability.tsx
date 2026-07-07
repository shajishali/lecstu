import { useEffect, useState, useCallback, useMemo } from 'react';
import { showToast } from '@components/Toast';
import api, { showApiErrorToast } from '@services/api';
import { useAuthStore } from '@store/authStore';
import {
  Search, Zap, Clock, Building, Users, ChevronDown, ChevronUp,
  RefreshCw, CalendarPlus, X, CalendarSearch,
} from 'lucide-react';

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

interface DaySchedule {
  day: string;
  date: string;
  occupied: OccupiedSlot[];
  freeSlots: FreeSlot[];
}

interface WeeklySchedule {
  hall: HallInfo;
  days: DaySchedule[];
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

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatFreeTimeRanges(slots: FreeSlot[]): string {
  if (slots.length === 0) return 'Fully occupied';
  return slots
    .map((s) => `${formatTime(s.startTime)} - ${formatTime(s.endTime)}`)
    .join(', ');
}

function getCurrentDay(): string {
  const jsDay = new Date().getDay();
  return jsDay >= 1 && jsDay <= 5 ? DAYS[jsDay - 1] : 'MONDAY';
}

function getNextDateForDay(dayName: string): string {
  const dayMap: Record<string, number> = {
    MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5,
  };
  const target = dayMap[dayName] ?? 1;
  const today = new Date();
  const todayNum = today.getDay() || 7;
  let daysAhead = target - (todayNum === 7 ? 0 : todayNum);
  if (daysAhead <= 0) daysAhead += 7;
  const d = new Date(today);
  d.setDate(d.getDate() + daysAhead);
  return toLocalDateString(d);
}

function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const min = (h - 8) * 60 + m;
  return (min / 600) * 100;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

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

function canBookRole(role?: string): boolean {
  return role === 'STUDENT' || role === 'LECTURER';
}

export default function HallAvailability() {
  const { user } = useAuthStore();
  const canBook = canBookRole(user?.role);

  const [tab, setTab] = useState<'search' | 'now'>('now');
  const [loading, setLoading] = useState(false);
  const [allHalls, setAllHalls] = useState<HallInfo[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, AvailableResult>>({});

  const [bookModal, setBookModal] = useState<{
    hall: HallInfo;
    slot: FreeSlot;
    date: string;
  } | null>(null);
  const [bookReason, setBookReason] = useState('');
  const [bookStartTime, setBookStartTime] = useState('');
  const [bookEndTime, setBookEndTime] = useState('');
  const [bookSubmitting, setBookSubmitting] = useState(false);

  const [weeklyModal, setWeeklyModal] = useState<HallInfo | null>(null);
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyExpandedDay, setWeeklyExpandedDay] = useState<string | null>(null);

  const [day, setDay] = useState(getCurrentDay());
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [minCapacity, setMinCapacity] = useState('');
  const [building, setBuilding] = useState('');
  const [equipment, setEquipment] = useState('');
  const [searchApplied, setSearchApplied] = useState(false);

  const [buildings, setBuildings] = useState<string[]>([]);
  const [equipmentOptions, setEquipmentOptions] = useState<string[]>([]);

  const [emptyStateDismissed, setEmptyStateDismissed] = useState(false);
  const [expandedHall, setExpandedHall] = useState<string | null>(null);
  const [hallSchedule, setHallSchedule] = useState<ScheduleData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleDay, setScheduleDay] = useState(getCurrentDay());
  const [scheduleDate, setScheduleDate] = useState('');

  const fetchFilters = useCallback(async () => {
    try {
      const res = await api.get('/halls/filters');
      setBuildings(res.data.data.buildings || []);
      setEquipmentOptions(res.data.data.equipment || []);
    } catch { /* ignore */ }
  }, []);

  const fetchAllHalls = useCallback(async () => {
    try {
      const res = await api.get('/halls/list');
      setAllHalls(res.data.data || []);
    } catch {
      showToast('error', 'Failed to load halls');
    }
  }, []);

  useEffect(() => {
    fetchFilters();
    fetchAllHalls();
  }, [fetchFilters, fetchAllHalls]);

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
      const results: AvailableResult[] = res.data.data || [];
      const map: Record<string, AvailableResult> = {};
      for (const r of results) map[r.hall.id] = r;
      setAvailabilityMap(map);
      setSearchApplied(true);
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
      const results: AvailableResult[] = res.data.data || [];
      const map: Record<string, AvailableResult> = {};
      for (const r of results) map[r.hall.id] = r;
      setAvailabilityMap(map);
      setSearchApplied(false);
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
    if (tab === 'now') {
      fetchAvailableNow();
    } else {
      setAvailabilityMap({});
      setSearchApplied(false);
    }
  }, [tab, fetchAvailableNow]);

  const displayedHalls = useMemo(() => {
    let halls = [...allHalls];

    if (tab === 'search' && searchApplied) {
      if (building) {
        halls = halls.filter((h) => h.building.toLowerCase() === building.toLowerCase());
      }
      if (minCapacity) {
        const cap = parseInt(minCapacity, 10);
        if (!Number.isNaN(cap)) halls = halls.filter((h) => h.capacity >= cap);
      }
      if (equipment) {
        const req = equipment.toLowerCase();
        halls = halls.filter((h) => h.equipment.some((eq) => eq.toLowerCase().includes(req)));
      }
    }

    return halls.sort((a, b) => {
      const aAvail = availabilityMap[a.id] ? 1 : 0;
      const bAvail = availabilityMap[b.id] ? 1 : 0;
      if (aAvail !== bAvail) return bAvail - aAvail;
      return a.name.localeCompare(b.name);
    });
  }, [allHalls, tab, searchApplied, building, minCapacity, equipment, availabilityMap]);

  const fetchSchedule = async (hallId: string) => {
    if (expandedHall === hallId) {
      setExpandedHall(null);
      setHallSchedule(null);
      return;
    }
    setExpandedHall(hallId);
    setScheduleLoading(true);
    const scheduleDayVal = tab === 'now' ? getCurrentDay() : day;
    const scheduleDateVal = tab === 'now'
      ? toLocalDateString(new Date())
      : getNextDateForDay(day);
    try {
      const res = await api.get(`/halls/${hallId}/schedule`, {
        params: { day: scheduleDayVal, date: scheduleDateVal },
      });
      setHallSchedule(res.data.data);
      setScheduleDay(scheduleDayVal);
      setScheduleDate(scheduleDateVal);
    } catch {
      showToast('error', 'Failed to load schedule');
    } finally {
      setScheduleLoading(false);
    }
  };

  const openWeeklyCheck = async (hall: HallInfo) => {
    setWeeklyModal(hall);
    setWeeklySchedule(null);
    setWeeklyExpandedDay(null);
    setWeeklyLoading(true);
    try {
      const res = await api.get(`/halls/${hall.id}/weekly-schedule`);
      setWeeklySchedule(res.data.data);
    } catch {
      showToast('error', 'Failed to load weekly availability');
      setWeeklyModal(null);
    } finally {
      setWeeklyLoading(false);
    }
  };

  const closeWeeklyModal = () => {
    setWeeklyModal(null);
    setWeeklySchedule(null);
    setWeeklyExpandedDay(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchAvailable();
  };

  const openBookModal = (hall: HallInfo, slot: FreeSlot, date: string) => {
    setBookModal({ hall, slot, date });
    setBookReason('');
    setBookStartTime(slot.startTime);
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
        `Booking request sent for ${new Date(bookModal.date).toLocaleDateString()} • ${formatTime(bookStartTime)}-${formatTime(bookEndTime)}. Admin will review and notify you.`
      );
      closeBookModal();
      closeWeeklyModal();
      window.dispatchEvent(new CustomEvent('notifications-updated'));
      window.dispatchEvent(new CustomEvent('approvals-updated'));
      if (tab === 'now') fetchAvailableNow();
      else if (searchApplied) searchAvailable();
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to submit booking');
    } finally {
      setBookSubmitting(false);
    }
  };

  const getHallSlots = (hallId: string): FreeSlot[] => {
    return availabilityMap[hallId]?.matchingFreeSlots ?? [];
  };

  const isSlotBookable = (dateStr: string, slot: FreeSlot): boolean => {
    if (slot.durationMinutes < 30) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const slotDate = parseLocalDate(dateStr);
    slotDate.setHours(0, 0, 0, 0);
    if (slotDate < today) return false;
    if (slotDate.getTime() === today.getTime()) {
      const now = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
      return slot.endTime > now;
    }
    return true;
  };

  const modalOpen = Boolean(weeklyModal || bookModal);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  return (
    <div className="hall-avail-page">
      <div className="ha-header">
        <div>
          <h1>Hall Availability</h1>
          <p className="ha-subtitle">Find lecture halls and check free times for the week</p>
        </div>
      </div>

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
          <span>All halls listed. {Object.keys(availabilityMap).length} available right now</span>
          <button className="btn btn-secondary btn-sm" onClick={fetchAvailableNow} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
      )}

      {!loading && (
        <p className="ha-result-count">
          {displayedHalls.length} hall{displayedHalls.length !== 1 ? 's' : ''} found
        </p>
      )}

      {loading && (
        <div className="ha-loading">
          <div className="spinner" />
          <p>Checking availability...</p>
        </div>
      )}

      {!loading && displayedHalls.length === 0 && !emptyStateDismissed && (
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
          <h3>No halls found</h3>
          <p>{tab === 'search' ? 'Try adjusting your filters.' : 'No lecture halls are registered.'}</p>
        </div>
      )}

      {!loading && displayedHalls.length > 0 && (
        <div className="ha-results">
          {displayedHalls.map((hall) => {
            const slots = getHallSlots(hall.id);
            const isAvailableNow = tab === 'now' && slots.length > 0;

            return (
              <div key={hall.id} className={`ha-card ${expandedHall === hall.id ? 'expanded' : ''}`}>
                <div className="ha-card-header" onClick={() => fetchSchedule(hall.id)}>
                  <div className="ha-card-info">
                    <h3>{hall.name}</h3>
                    <div className="ha-card-meta">
                      <span><Building size={14} /> {hall.building}, Floor {hall.floor}</span>
                      <span><Users size={14} /> {hall.capacity} seats</span>
                      {hall.equipment.length > 0 && (
                        <span className="ha-equip">{hall.equipment.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div className="ha-card-right">
                    {isAvailableNow ? (
                      <div className="ha-free-count ha-free-count-ranges">
                        <Clock size={14} className="shrink-0" />
                        <span>{formatFreeTimeRanges(slots)}</span>
                      </div>
                    ) : tab === 'search' && searchApplied && slots.length > 0 ? (
                      <div className="ha-free-count ha-free-count-ranges">
                        <Clock size={14} className="shrink-0" />
                        <span>{formatFreeTimeRanges(slots)}</span>
                      </div>
                    ) : (
                      <div className="ha-status-occupied">Check weekly schedule</div>
                    )}
                    <span className="ha-card-chevron" aria-hidden>
                      {expandedHall === hall.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </div>
                </div>

                <div className="ha-card-body">
                  <button
                    type="button"
                    className="ha-avail-check-btn"
                    onClick={(e) => { e.stopPropagation(); openWeeklyCheck(hall); }}
                  >
                    <CalendarSearch size={16} /> Availability Check
                  </button>

                  {slots.length > 0 && (
                    <div className="ha-free-slots">
                      {slots.map((fs, i) => (
                        <div key={i} className="ha-slot-row">
                          <span className="ha-slot-time">
                            {formatTime(fs.startTime)} - {formatTime(fs.endTime)}
                            <span className="ha-slot-duration">({fs.durationMinutes} min)</span>
                          </span>
                          {canBook && (
                            <button
                              type="button"
                              className="ha-book-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                const date = tab === 'now'
                                  ? toLocalDateString(new Date())
                                  : getNextDateForDay(day);
                                openBookModal(hall, fs, date);
                              }}
                              title="Book this slot"
                            >
                              <CalendarPlus size={16} /> Book
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {expandedHall === hall.id && (
                    <div className="ha-expanded">
                    {scheduleLoading ? (
                      <div className="ha-loading-sm"><div className="spinner" /></div>
                    ) : hallSchedule ? (
                      <div className="ha-timeline-section">
                        <h4>
                          {DAY_LABELS[scheduleDay] || scheduleDay}
                          {scheduleDate && (
                            <span className="ml-2 text-sm font-normal text-slate-500">
                              ({formatShortDate(scheduleDate)})
                            </span>
                          )}
                          {' '}Schedule
                        </h4>
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
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Availability Check Modal */}
      {weeklyModal && (
        <div className="ha-modal-overlay" onClick={closeWeeklyModal}>
          <div
            className="ha-weekly-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-avail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ha-weekly-header">
              <div className="min-w-0 flex-1">
                <h3 id="weekly-avail-title" className="text-lg font-semibold text-slate-800">
                  Weekly Availability
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  <strong>{weeklyModal.name}</strong>, {weeklyModal.building}, Floor {weeklyModal.floor}
                </p>
              </div>
              <button
                type="button"
                onClick={closeWeeklyModal}
                className="ha-modal-close-btn shrink-0"
              >
                <X size={16} /> Close
              </button>
            </div>

            <div className="ha-weekly-body">
              {weeklyLoading ? (
                <div className="ha-loading-sm"><div className="spinner" /></div>
              ) : weeklySchedule ? (
                <div className="ha-weekly-days">
                  {weeklySchedule.days.map((daySchedule) => {
                    const bookableSlots = daySchedule.freeSlots.filter(
                      (fs) => isSlotBookable(daySchedule.date, fs)
                    );
                    const isExpanded = weeklyExpandedDay === daySchedule.date;

                    return (
                      <div key={daySchedule.date} className="ha-weekly-day">
                        <button
                          type="button"
                          className="ha-weekly-day-header"
                          onClick={() => setWeeklyExpandedDay(isExpanded ? null : daySchedule.date)}
                        >
                          <div className="min-w-0">
                            <span className="ha-weekly-day-name">{DAY_LABELS[daySchedule.day]}</span>
                            <span className="ha-weekly-day-date">{formatShortDate(daySchedule.date)}</span>
                          </div>
                          <div className="ha-weekly-day-summary">
                            <span className={bookableSlots.length > 0 ? 'ha-weekly-avail-summary' : 'ha-weekly-busy'}>
                              {formatFreeTimeRanges(bookableSlots)}
                            </span>
                            {isExpanded ? <ChevronUp size={16} className="shrink-0" /> : <ChevronDown size={16} className="shrink-0" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="ha-weekly-day-detail">
                            {daySchedule.occupied.length > 0 && (
                              <div className="ha-weekly-occupied">
                                <p className="ha-weekly-section-label">Occupied (timetable & bookings)</p>
                                {daySchedule.occupied.map((occ) => (
                                  <div key={occ.id} className="ha-weekly-occ-row">
                                    <span className="ha-occ-time">
                                      {formatTime(occ.startTime)} - {formatTime(occ.endTime)}
                                    </span>
                                    <span>{occ.course.code}: {occ.course.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {bookableSlots.length > 0 ? (
                              <div className="ha-weekly-slots">
                                <p className="ha-weekly-section-label">
                                  Free times (book any part of each range)
                                </p>
                                {bookableSlots.map((fs, i) => (
                                  <div key={i} className="ha-weekly-slot-row">
                                    <span>
                                      {formatTime(fs.startTime)} - {formatTime(fs.endTime)}
                                      <span className="ml-2 text-slate-500">({fs.durationMinutes} min)</span>
                                    </span>
                                    {canBook && (
                                      <button
                                        type="button"
                                        className="ha-weekly-book-btn"
                                        onClick={() => openBookModal(weeklySchedule.hall, fs, daySchedule.date)}
                                      >
                                        <CalendarPlus size={14} /> Book
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="ha-weekly-no-slots">No bookable free slots on this day.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Book Hall Modal */}
      {bookModal && (
        <div className="ha-modal-overlay z-[60]" onClick={closeBookModal}>
          <div
            className="ha-book-modal"
            role="dialog"
            aria-modal="true"
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
                {parseLocalDate(bookModal.date).toLocaleDateString(undefined, {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                })}
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
