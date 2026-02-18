import { useEffect, useState, useCallback } from 'react';
import { showToast } from '@components/Toast';
import api from '@services/api';
import { Search, Zap, Clock, Building, Users, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

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

function timeToPercent(time: string): number {
  const [h, m] = time.split(':').map(Number);
  const min = (h - 8) * 60 + m;
  return (min / 600) * 100; // 08:00–18:00 = 600 min
}

export default function HallAvailability() {
  const [tab, setTab] = useState<'search' | 'now'>('now');
  const [loading, setLoading] = useState(false);

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
      {!loading && results.length === 0 && (
        <div className="ha-empty">
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

              {/* Free slots summary */}
              <div className="ha-free-slots">
                {r.matchingFreeSlots.map((fs, i) => (
                  <span key={i} className="ha-slot-badge free">
                    {formatTime(fs.startTime)} – {formatTime(fs.endTime)}
                    <small>({fs.durationMinutes}min)</small>
                  </span>
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
                              title={`${occ.course.code} — ${formatTime(occ.startTime)}–${formatTime(occ.endTime)}`}
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
                              title={`Free: ${formatTime(fs.startTime)}–${formatTime(fs.endTime)}`}
                            />
                          ))}
                        </div>
                      </div>
                      {hallSchedule.occupied.length > 0 && (
                        <div className="ha-schedule-detail">
                          {hallSchedule.occupied.map((occ) => (
                            <div key={occ.id} className="ha-occ-row">
                              <span className="ha-occ-time">
                                {formatTime(occ.startTime)} – {formatTime(occ.endTime)}
                              </span>
                              <span className="ha-occ-course">{occ.course.code} — {occ.course.name}</span>
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
    </div>
  );
}
