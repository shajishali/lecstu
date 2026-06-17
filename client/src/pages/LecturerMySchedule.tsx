import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { showToast } from '@components/Toast';
import { formatCourseLabel } from '@utils/courseDisplay';
import { Calendar, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

type SlotType = 'BUSY' | 'OFFICE_HOUR';

interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  month?: number;
  week?: number;
  notes?: string | null;
  course: { id: string; name: string; code: string };
  hall: { id: string; name: string; building: string; doorPassword?: string | null };
  group: { id: string; name: string; batchYear: number; batchLabel?: string | null };
}

interface PersonalSlot {
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  slotType: SlotType;
  label: string;
  location: string;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};
const WEEKDAY_OPTIONS: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];
const WEEKDAY_FULL: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
};

const GRID_START_HOUR = 8;
const GRID_MIN_END_HOUR = 17;
const GRID_MAX_END_HOUR = 21;
const LECTURER_HOUR_HEIGHT_PX = 68;

function computeGridEndHour(slots: TimetableSlot[]): number {
  let end = GRID_MIN_END_HOUR;
  for (const s of slots) {
    const [eh, em] = s.endTime.split(':').map(Number);
    const ceilHour = em > 0 ? eh + 1 : eh;
    end = Math.max(end, ceilHour);
  }
  return Math.min(end, GRID_MAX_END_HOUR);
}

function buildTimeSlots(endHour: number): string[] {
  return Array.from({ length: endHour - GRID_START_HOUR }, (_, i) => {
    const h = GRID_START_HOUR + i;
    return `${String(h).padStart(2, '0')}:00`;
  });
}

function getSlotPosition(startTime: string, endTime: string, gridEndHour: number) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = (sh - GRID_START_HOUR) * 60 + sm;
  const endMin = (eh - GRID_START_HOUR) * 60 + em;
  const totalRange = (gridEndHour - GRID_START_HOUR) * 60;
  return {
    top: (startMin / totalRange) * 100,
    height: ((endMin - startMin) / totalRange) * 100,
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const COURSE_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#2563eb',
];

type PeriodKey = string;

function getPeriodKey(s: TimetableSlot): PeriodKey {
  return `${s.year ?? 2026}-${s.month ?? 1}-${s.week ?? 1}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function groupOverlappingSlots(slots: TimetableSlot[]): TimetableSlot[][] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
  );
  const groups: TimetableSlot[][] = [];
  let current: TimetableSlot[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    const prev = current[0];
    if (prev.startTime === s.startTime && prev.endTime === s.endTime) {
      current.push(s);
    } else {
      groups.push(current);
      current = [s];
    }
  }
  groups.push(current);
  return groups;
}

/** One timetable cell = same day & time; may include merged pathway groups. */
interface MergedLectureSession {
  key: string;
  course: TimetableSlot['course'];
  hall: TimetableSlot['hall'];
  slots: TimetableSlot[];
}

interface MergedTimeBlock {
  key: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  sessions: MergedLectureSession[];
}

function buildMergedBlocks(slots: TimetableSlot[]): MergedTimeBlock[] {
  return groupOverlappingSlots(slots).map((group) => {
    const first = group[0];
    const sessionMap = new Map<string, TimetableSlot[]>();
    for (const slot of group) {
      const sk = `${slot.course.id}|${slot.hall.id}`;
      const list = sessionMap.get(sk) ?? [];
      list.push(slot);
      sessionMap.set(sk, list);
    }
    const sessions = [...sessionMap.values()].map((sessionSlots) => ({
      key: `${sessionSlots[0].course.id}|${sessionSlots[0].hall.id}`,
      course: sessionSlots[0].course,
      hall: sessionSlots[0].hall,
      slots: sessionSlots.sort((a, b) => a.group.name.localeCompare(b.group.name)),
    }));
    return {
      key: `${first.dayOfWeek}-${first.startTime}-${first.endTime}`,
      dayOfWeek: first.dayOfWeek,
      startTime: first.startTime,
      endTime: first.endTime,
      sessions,
    };
  });
}

function layoutMergedBlocks(
  slots: TimetableSlot[],
  gridEndHour: number,
): { block: MergedTimeBlock; top: number; height: number; minHeightPx: number }[] {
  return buildMergedBlocks(slots).map((block) => ({
    block,
    ...getSlotPosition(block.startTime, block.endTime, gridEndHour),
    minHeightPx: mergedBlockMinHeight(block),
  }));
}

/** Ensure merged boxes are tall enough to read all pathways. */
function mergedBlockMinHeight(block: MergedTimeBlock): number {
  let px = 40;
  for (const session of block.sessions) {
    px += 62;
    px += Math.max(0, session.slots.length - 1) * 14;
  }
  return Math.min(Math.max(px, 130), 300);
}

function dayBodyHeightPx(slots: TimetableSlot[], gridEndHour: number): number {
  const defaultBody = (gridEndHour - GRID_START_HOUR) * LECTURER_HOUR_HEIGHT_PX;
  const blocks = layoutMergedBlocks(slots, gridEndHour);
  let needed = defaultBody;
  for (const { top, height, minHeightPx } of blocks) {
    const topPx = (top / 100) * defaultBody;
    const blockPx = Math.max((height / 100) * defaultBody, minHeightPx);
    needed = Math.max(needed, topPx + blockPx + 12);
  }
  return needed;
}

function getCourseColor(courseId: string, colorMap: Map<string, string>): string {
  if (colorMap.has(courseId)) return colorMap.get(courseId)!;
  const color = COURSE_COLORS[colorMap.size % COURSE_COLORS.length];
  colorMap.set(courseId, color);
  return color;
}

const emptyPersonalSlot = (): PersonalSlot => ({
  dayOfWeek: 'MONDAY',
  startTime: '09:00',
  endTime: '10:00',
  slotType: 'BUSY',
  label: '',
  location: '',
});

export default function LecturerMySchedule() {
  const { user } = useAuthStore();
  const [flat, setFlat] = useState<TimetableSlot[]>([]);
  const [timetableCodes, setTimetableCodes] = useState<string[]>([]);
  const [personalSlots, setPersonalSlots] = useState<PersonalSlot[]>([]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<PeriodKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [editDay, setEditDay] = useState<DayOfWeek>('MONDAY');
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('10:00');
  const [editYear, setEditYear] = useState(2026);
  const [editMonth, setEditMonth] = useState(1);
  const [editWeek, setEditWeek] = useState(1);
  const [editCourseName, setEditCourseName] = useState('');
  const [editHallName, setEditHallName] = useState('');
  const [editDoorPassword, setEditDoorPassword] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMergedClasses, setEditMergedClasses] = useState<string[]>([]);
  const [savingSlot, setSavingSlot] = useState(false);
  const colorMap = useRef(new Map<string, string>());

  const periods = useMemo(() => {
    const seen = new Set<PeriodKey>();
    const list: { key: PeriodKey; label: string }[] = [];
    for (const s of flat) {
      const key = getPeriodKey(s);
      if (seen.has(key)) continue;
      seen.add(key);
      const m = s.month ?? 1;
      list.push({
        key,
        label: `${s.year} · ${MONTH_NAMES[m - 1] ?? m} · Week ${s.week ?? 1}`,
      });
    }
    list.sort((a, b) => {
      const [ay, am, aw] = a.key.split('-').map(Number);
      const [by, bm, bw] = b.key.split('-').map(Number);
      if (ay !== by) return by - ay;
      if (am !== bm) return bm - am;
      return bw - aw;
    });
    return list;
  }, [flat]);

  const filteredFlat = useMemo(
    () => (selectedPeriodKey ? flat.filter((s) => getPeriodKey(s) === selectedPeriodKey) : flat),
    [flat, selectedPeriodKey],
  );

  const filteredWeekly = useMemo(() => {
    const byDay: Record<string, TimetableSlot[]> = {};
    for (const day of DAYS) byDay[day] = [];
    for (const s of filteredFlat) {
      if (byDay[s.dayOfWeek]) byDay[s.dayOfWeek].push(s);
    }
    for (const day of DAYS) {
      byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return byDay;
  }, [filteredFlat]);

  const gridEndHour = useMemo(() => computeGridEndHour(filteredFlat), [filteredFlat]);
  const visibleHours = gridEndHour - GRID_START_HOUR;
  const timeSlots = useMemo(() => buildTimeSlots(gridEndHour), [gridEndHour]);
  const gridRows = useMemo(() => {
    let maxBody = visibleHours * LECTURER_HOUR_HEIGHT_PX;
    for (const day of DAYS) {
      maxBody = Math.max(maxBody, dayBodyHeightPx(filteredWeekly[day] || [], gridEndHour));
    }
    return Math.ceil(maxBody / LECTURER_HOUR_HEIGHT_PX) + 1;
  }, [filteredWeekly, gridEndHour, visibleHours]);

  const maxDayBodyHeight = useMemo(() => {
    let max = visibleHours * LECTURER_HOUR_HEIGHT_PX;
    for (const day of DAYS) {
      max = Math.max(max, dayBodyHeightPx(filteredWeekly[day] || [], gridEndHour));
    }
    return max;
  }, [filteredWeekly, gridEndHour, visibleHours]);

  const mergedTimeBlocks = useMemo(() => {
    let count = 0;
    for (const day of DAYS) {
      count += buildMergedBlocks(filteredWeekly[day] || []).length;
    }
    return count;
  }, [filteredWeekly]);

  const fetchAll = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [ttRes, schedRes] = await Promise.all([
        api.get('/timetable/my', { params: { _: Date.now() } }),
        api.get('/lecturers/me/schedule'),
      ]);
      const ttData = ttRes.data.data;
      const slots = (ttData.flat || []) as TimetableSlot[];
      setFlat(slots);
      setTimetableCodes(ttData.timetableCodes || []);
      colorMap.current.clear();

      const periodList = [...new Set(slots.map(getPeriodKey))];
      if (periodList.length > 0) {
        setSelectedPeriodKey((prev) => (prev && periodList.includes(prev) ? prev : periodList[0]));
      } else {
        setSelectedPeriodKey(null);
      }

      const allSched = (schedRes.data.data || []) as PersonalSlot[];
      setPersonalSlots(
        allSched
          .filter((s) => s.slotType !== 'TEACHING')
          .map((s) => ({
            ...s,
            slotType: (s.slotType === 'OFFICE_HOUR' ? 'OFFICE_HOUR' : 'BUSY') as SlotType,
            label: s.label || '',
            location: s.location || '',
          })),
      );
    } catch {
      showToast('error', 'Failed to load your schedule');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onUpdate = () => fetchAll(true);
    window.addEventListener('timetable-updated', onUpdate);
    return () => window.removeEventListener('timetable-updated', onUpdate);
  }, [fetchAll]);

  const openEditModal = (slot: TimetableSlot) => {
    const mergedPeers = filteredFlat
      .filter(
        (s) =>
          s.dayOfWeek === slot.dayOfWeek &&
          s.startTime === slot.startTime &&
          s.endTime === slot.endTime &&
          s.course.id === slot.course.id &&
          s.hall.id === slot.hall.id,
      )
      .map((s) => s.group.name)
      .sort();
    setSelectedSlot(slot);
    setEditMergedClasses(mergedPeers);
    setEditDay(slot.dayOfWeek as DayOfWeek);
    setEditStart(slot.startTime);
    setEditEnd(slot.endTime);
    setEditYear(slot.year ?? 2026);
    setEditMonth(slot.month ?? 1);
    setEditWeek(slot.week ?? 1);
    setEditCourseName(slot.course.name);
    setEditHallName(slot.hall.name);
    setEditDoorPassword(slot.hall.doorPassword || '');
    setEditNotes(slot.notes || '');
  };

  const handleSaveSlot = async () => {
    if (!selectedSlot) return;
    setSavingSlot(true);
    try {
      await api.patch(`/lecturers/me/timetable/${selectedSlot.id}`, {
        dayOfWeek: editDay,
        startTime: editStart,
        endTime: editEnd,
        year: editYear,
        month: editMonth,
        week: editWeek,
        courseName: editCourseName.trim(),
        hallName: editHallName.trim(),
        hallDoorPassword: editDoorPassword.trim() || null,
        notes: editNotes.trim() || null,
      });
      showToast('success', 'Lecture updated. Student timetables will reflect this change.');
      setSelectedSlot(null);
      window.dispatchEvent(new Event('timetable-updated'));
      await fetchAll(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showToast('error', ax.response?.data?.message || 'Failed to update lecture');
    } finally {
      setSavingSlot(false);
    }
  };

  const handleSavePersonal = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPersonal(true);
    try {
      const payload = personalSlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        slotType: s.slotType,
        label: s.label.trim() || null,
        location: s.location.trim() || null,
      }));
      await api.put('/lecturers/me/schedule', { slots: payload });
      showToast('success', 'Personal busy times saved.');
      await fetchAll(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showToast('error', ax.response?.data?.message || 'Failed to save busy times');
    } finally {
      setSavingPersonal(false);
    }
  };

  if (user?.role !== 'LECTURER') {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Only lecturers can view this schedule.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="timetable-page">
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading schedule...</p>
        </div>
      </div>
    );
  }

  const codeLabel = timetableCodes.length > 0 ? timetableCodes.join(', ') : '—';

  return (
    <div
      className="timetable-page lecturer-schedule-page"
      style={
        {
          '--tt-visible-hours': visibleHours,
          '--tt-grid-rows': gridRows,
        } as CSSProperties
      }
    >
      <div className="tt-header">
        <div>
          <h1 className="flex items-center gap-2">
            <Calendar size={24} />
            My weekly schedule
          </h1>
          <p className="tt-subtitle">
            Teaching slots from the admin timetable (matched by your code: <strong>{codeLabel}</strong>)
            · {mergedTimeBlocks} teaching time{mergedTimeBlocks !== 1 ? 's' : ''} ({filteredFlat.length}{' '}
            class{filteredFlat.length !== 1 ? 'es' : ''} merged by schedule)
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pathways taught together at the same time appear in one box. Click edit on a lecture to
            change day, time, place, or notes — students see updates on their timetable.
          </p>
        </div>
        <div className="tt-actions">
          {periods.length > 1 && (
            <select
              className="border border-slate-300 rounded px-2 py-1 text-sm"
              value={selectedPeriodKey ?? ''}
              onChange={(e) => setSelectedPeriodKey(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchAll(true)}
            disabled={refreshing}
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {flat.length === 0 ? (
        <div className="tt-empty">
          <h3>No teaching slots found</h3>
          <p>
            Ask admin to import the faculty timetable. Your lectures are matched using the two-letter
            code in the sheet (e.g. <strong>SP</strong> for Shaji Piraba). Your profile code is{' '}
            <strong>{codeLabel}</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="tt-grid-wrapper">
            <div className="tt-grid-scroll">
              <div
                className="tt-grid"
                style={{ gridTemplateColumns: `80px repeat(${DAYS.length}, minmax(160px, 1fr))` }}
              >
                <div
                  className="tt-time-col"
                  style={{ minHeight: maxDayBodyHeight + LECTURER_HOUR_HEIGHT_PX }}
                >
                  <div className="tt-corner" />
                  {timeSlots.map((t) => (
                    <div key={t} className="tt-time-label">
                      {formatTime(t)}
                    </div>
                  ))}
                </div>

                {DAYS.map((day) => {
                  const slots = filteredWeekly[day] || [];
                  return (
                    <div key={day} className="tt-day-col">
                      <div className="tt-day-header">{DAY_LABELS[day]}</div>
                      <div
                        className="tt-day-body"
                        style={{
                          height: maxDayBodyHeight,
                          minHeight: 'var(--tt-body-height)',
                        }}
                      >
                        {layoutMergedBlocks(slots, gridEndHour).map(({ block, top, height, minHeightPx }) => {
                          const primaryColor = getCourseColor(
                            block.sessions[0].course.id,
                            colorMap.current,
                          );
                          return (
                            <div
                              key={block.key}
                              className="tt-slot-group tt-slot-group-merged"
                              style={{
                                top: `${top}%`,
                                height: `max(${height}%, ${minHeightPx}px)`,
                              }}
                            >
                              <div
                                className="tt-slot tt-slot-merged"
                                style={{
                                  backgroundColor: `${primaryColor}20`,
                                  borderLeft: `3px solid ${primaryColor}`,
                                }}
                              >
                                <span className="tt-slot-time tt-merged-time">
                                  {formatTime(block.startTime)} – {formatTime(block.endTime)}
                                </span>
                                {block.sessions.map((session) => {
                                  const color = getCourseColor(session.course.id, colorMap.current);
                                  const classNames = session.slots.map((s) => s.group.name).join(', ');
                                  return (
                                    <div key={session.key} className="tt-merged-session">
                                      <div className="tt-merged-session-head">
                                        <span className="tt-slot-code" style={{ color }}>
                                          {formatCourseLabel(session.course.code, session.course.name)}
                                        </span>
                                        <button
                                          type="button"
                                          className="tt-merged-edit-btn"
                                          title="Edit this lecture"
                                          onClick={() => openEditModal(session.slots[0])}
                                        >
                                          <Pencil size={11} />
                                        </button>
                                      </div>
                                      <span className="tt-slot-meta">
                                        {session.hall.name}
                                        {session.hall.building ? ` · ${session.hall.building}` : ''}
                                      </span>
                                      {session.hall.doorPassword && (
                                        <span className="tt-slot-door">
                                          Door: {session.hall.doorPassword}
                                        </span>
                                      )}
                                      <span className="tt-merged-classes">
                                        <strong>Classes:</strong> {classNames}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="tt-legend-wrapper">
            <div className="tt-legend">
              {Array.from(colorMap.current.entries()).map(([courseId, color]) => {
                const course = filteredFlat.find((s) => s.course.id === courseId)?.course;
                if (!course) return null;
                return (
                  <div key={courseId} className="tt-legend-item">
                    <span className="tt-legend-dot" style={{ backgroundColor: color }} />
                    <span>{formatCourseLabel(course.code, course.name)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <section className="mt-10 max-w-4xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-2">Other busy times</h2>
        <p className="text-sm text-slate-600 mb-4">
          Add blocks when you are unavailable for appointments (separate from teaching slots above).
        </p>
        <form onSubmit={handleSavePersonal} className="space-y-4">
          {personalSlots.length === 0 ? (
            <p className="text-slate-500 text-sm border border-dashed border-slate-300 rounded-lg p-4 text-center">
              No extra busy blocks. Teaching times are managed in the grid above.
            </p>
          ) : (
            personalSlots.map((slot, index) => (
              <div
                key={slot.id ?? `new-${index}`}
                className="grid gap-3 p-4 bg-white border border-slate-200 rounded-lg shadow-sm md:grid-cols-12 items-end"
              >
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Day</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.dayOfWeek}
                    onChange={(e) =>
                      setPersonalSlots((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, dayOfWeek: e.target.value as DayOfWeek } : s,
                        ),
                      )
                    }
                  >
                    {WEEKDAY_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {WEEKDAY_FULL[d]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">From</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.startTime}
                    onChange={(e) =>
                      setPersonalSlots((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, startTime: e.target.value } : s)),
                      )
                    }
                  />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">To</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.endTime}
                    onChange={(e) =>
                      setPersonalSlots((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, endTime: e.target.value } : s)),
                      )
                    }
                  />
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Type</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.slotType}
                    onChange={(e) =>
                      setPersonalSlots((prev) =>
                        prev.map((s, i) =>
                          i === index ? { ...s, slotType: e.target.value as SlotType } : s,
                        ),
                      )
                    }
                  >
                    <option value="BUSY">Busy</option>
                    <option value="OFFICE_HOUR">Office hour</option>
                  </select>
                </label>
                <label className="md:col-span-2 block text-sm">
                  <span className="text-slate-600">Label</span>
                  <input
                    type="text"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={slot.label}
                    onChange={(e) =>
                      setPersonalSlots((prev) =>
                        prev.map((s, i) => (i === index ? { ...s, label: e.target.value } : s)),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="md:col-span-2 btn btn-secondary btn-sm flex items-center justify-center gap-1"
                  onClick={() => setPersonalSlots((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 size={16} /> Remove
                </button>
              </div>
            ))
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="btn btn-secondary flex items-center gap-2"
              onClick={() => setPersonalSlots((prev) => [...prev, emptyPersonalSlot()])}
            >
              <Plus size={16} /> Add busy block
            </button>
            <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={savingPersonal}>
              <Save size={16} /> {savingPersonal ? 'Saving...' : 'Save busy times'}
            </button>
          </div>
        </form>
      </section>

      {selectedSlot && (
        <div className="modal-overlay" onClick={() => setSelectedSlot(null)}>
          <div className="modal tt-detail-modal tt-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit lecture</h3>
              <button type="button" className="btn-close" onClick={() => setSelectedSlot(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body space-y-4">
              {editMergedClasses.length > 1 ? (
                <p className="text-sm text-slate-600 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <strong>Merged pathways at this time:</strong>{' '}
                  {editMergedClasses.join(', ')}
                </p>
              ) : (
                <p className="text-sm text-slate-600">
                  Class: <strong>{selectedSlot.group.name}</strong>
                </p>
              )}

              <label className="block text-sm">
                <span className="text-slate-600">Lecture name</span>
                <input
                  type="text"
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  value={editCourseName}
                  onChange={(e) => setEditCourseName(e.target.value)}
                  placeholder="e.g. ETEC 22033 T"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">Place (hall / room)</span>
                <input
                  type="text"
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  value={editHallName}
                  onChange={(e) => setEditHallName(e.target.value)}
                  placeholder="e.g. AB-LCH-03-2"
                />
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">Door password</span>
                <input
                  type="text"
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                  value={editDoorPassword}
                  onChange={(e) => setEditDoorPassword(e.target.value)}
                  placeholder="Room access code for students"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Saved for this hall — students see it on their timetable.
                </span>
              </label>

              <label className="block text-sm">
                <span className="text-slate-600">Day</span>
                <select
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                  value={editDay}
                  onChange={(e) => setEditDay(e.target.value as DayOfWeek)}
                >
                  {WEEKDAY_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {WEEKDAY_FULL[d]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">Start time</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">End time</span>
                  <input
                    type="time"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={editEnd}
                    onChange={(e) => setEditEnd(e.target.value)}
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">Year</span>
                  <input
                    type="number"
                    min={2020}
                    max={2035}
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={editYear}
                    onChange={(e) => setEditYear(Number(e.target.value))}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Month</span>
                  <select
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={editMonth}
                    onChange={(e) => setEditMonth(Number(e.target.value))}
                  >
                    {MONTH_NAMES.map((name, i) => (
                      <option key={name} value={i + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-600">Week</span>
                  <input
                    type="number"
                    min={1}
                    max={53}
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                    value={editWeek}
                    onChange={(e) => setEditWeek(Number(e.target.value))}
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="text-slate-600">Additional notes</span>
                <textarea
                  className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 min-h-[72px]"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional notes for students (e.g. bring lab coat)"
                />
              </label>

              <p className="text-xs text-slate-500">
                Students in {selectedSlot.group.name} will see this change on their timetable.
              </p>
            </div>
            <div className="modal-footer flex gap-2 justify-end p-4 border-t">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedSlot(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingSlot}
                onClick={handleSaveSlot}
              >
                {savingSlot ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
