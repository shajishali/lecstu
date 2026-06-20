import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useAuthStore } from '@store/authStore';
import api from '@services/api';
import { showToast } from '@components/Toast';
import { formatCourseLabel } from '@utils/courseDisplay';
import { Calendar, Clock, Pencil, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';

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

interface BatchGroup {
  id: string;
  name: string;
  batchYear: number;
  batchLabel?: string | null;
  memberCount: number;
  department: { id: string; code: string; name: string };
  pathway?: { id: string; code: string; name: string } | null;
}

interface CreateOptions {
  timetableCode: string | null;
  department?: { id: string; code: string; name: string } | null;
  groups: BatchGroup[];
  courses: { id: string; code: string; name: string }[];
  halls: { id: string; name: string; building: string; doorPassword?: string | null }[];
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

function getSlotPositionPx(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = (sh - GRID_START_HOUR) * 60 + sm;
  const endMin = (eh - GRID_START_HOUR) * 60 + em;
  const topPx = (startMin / 60) * LECTURER_HOUR_HEIGHT_PX;
  const heightPx = ((endMin - startMin) / 60) * LECTURER_HOUR_HEIGHT_PX;
  return { topPx, heightPx: Math.max(heightPx, 4) };
}

function formatLastUpdated(iso: string | null | undefined): string {
  if (!iso) return 'Not updated yet';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  const suffix = hr >= 12 ? 'PM' : 'AM';
  const display = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
  return `${display}:${m} ${suffix}`;
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

function formatTimeRange24(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime}`;
}

const COURSE_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#2563eb',
];

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
): { block: MergedTimeBlock; topPx: number; heightPx: number }[] {
  return buildMergedBlocks(slots).map((block) => ({
    block,
    ...getSlotPositionPx(block.startTime, block.endTime),
  }));
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [personalSlots, setPersonalSlots] = useState<PersonalSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [detailBlock, setDetailBlock] = useState<MergedTimeBlock | null>(null);
  const [editDay, setEditDay] = useState<DayOfWeek>('MONDAY');
  const [editStart, setEditStart] = useState('09:00');
  const [editEnd, setEditEnd] = useState('10:00');
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editHallName, setEditHallName] = useState('');
  const [editDoorPassword, setEditDoorPassword] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editMergedClasses, setEditMergedClasses] = useState<string[]>([]);
  const [savingSlot, setSavingSlot] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createOptions, setCreateOptions] = useState<CreateOptions | null>(null);
  const [loadingCreateOptions, setLoadingCreateOptions] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [createDay, setCreateDay] = useState<DayOfWeek>('MONDAY');
  const [createStart, setCreateStart] = useState('09:00');
  const [createEnd, setCreateEnd] = useState('10:00');
  const [createCourseId, setCreateCourseId] = useState('');
  const [createCourseCode, setCreateCourseCode] = useState('');
  const [createCourseName, setCreateCourseName] = useState('');
  const [createHallName, setCreateHallName] = useState('');
  const [createDoorPassword, setCreateDoorPassword] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createGroupIds, setCreateGroupIds] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const colorMap = useRef(new Map<string, string>());

  const scheduleByDay = useMemo(() => {
    const byDay: Record<string, TimetableSlot[]> = {};
    for (const day of DAYS) byDay[day] = [];
    for (const s of flat) {
      if (byDay[s.dayOfWeek]) byDay[s.dayOfWeek].push(s);
    }
    for (const day of DAYS) {
      byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return byDay;
  }, [flat]);

  const gridEndHour = useMemo(() => computeGridEndHour(flat), [flat]);
  const visibleHours = gridEndHour - GRID_START_HOUR;
  const timeSlots = useMemo(() => buildTimeSlots(gridEndHour), [gridEndHour]);
  const gridBodyHeight = visibleHours * LECTURER_HOUR_HEIGHT_PX;
  const gridRows = visibleHours + 1;

  const mergedTimeBlocks = useMemo(() => {
    let count = 0;
    for (const day of DAYS) {
      count += buildMergedBlocks(scheduleByDay[day] || []).length;
    }
    return count;
  }, [scheduleByDay]);

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
      setLastUpdated(ttData.lastUpdated ?? null);
      colorMap.current.clear();

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
    const mergedPeers = flat
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
    setDetailBlock(null);
    setSelectedSlot(slot);
    setEditMergedClasses(mergedPeers);
    setEditDay(slot.dayOfWeek as DayOfWeek);
    setEditStart(slot.startTime);
    setEditEnd(slot.endTime);
    setEditCourseName(slot.course.name);
    setEditCourseCode(slot.course.code);
    setEditHallName(slot.hall.name);
    setEditDoorPassword(slot.hall.doorPassword || '');
    setEditNotes(slot.notes || '');
  };

  const openDetailModal = (block: MergedTimeBlock) => {
    setDetailBlock(block);
  };

  const lecturerDisplayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || 'You'
    : 'You';
  const timetableCodeLabel = timetableCodes.length > 0 ? timetableCodes.join(', ') : '—';

  const openCreateModal = async () => {
    setShowCreateModal(true);
    setLoadingCreateOptions(true);
    setCreateGroupIds([]);
    setBatchSearch('');
    setCreateDay('MONDAY');
    setCreateStart('09:00');
    setCreateEnd('10:00');
    setCreateCourseId('__new__');
    setCreateCourseCode('');
    setCreateCourseName('');
    setCreateHallName('');
    setCreateDoorPassword('');
    setCreateNotes('');
    try {
      const res = await api.get('/lecturers/me/timetable/options');
      const opts = res.data.data as CreateOptions;
      setCreateOptions(opts);
      setCreateCourseId('__new__');
      setCreateCourseCode('');
      setCreateCourseName('');
      if (opts.halls.length > 0) {
        setCreateHallName(opts.halls[0].name);
        setCreateDoorPassword(opts.halls[0].doorPassword || '');
      }
    } catch {
      showToast('error', 'Failed to load batch and course options');
      setShowCreateModal(false);
    } finally {
      setLoadingCreateOptions(false);
    }
  };

  const filteredBatches = useMemo(() => {
    if (!createOptions?.groups) return [];
    const q = batchSearch.trim().toLowerCase();
    if (!q) return createOptions.groups;
    return createOptions.groups.filter((g) => {
      const hay = [
        g.name,
        g.batchLabel,
        String(g.batchYear),
        g.department?.name,
        g.department?.code,
        g.pathway?.name,
        g.pathway?.code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [createOptions, batchSearch]);

  const toggleCreateGroup = (groupId: string) => {
    setCreateGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };

  const handleCreateCourseChange = (courseId: string) => {
    setCreateCourseId(courseId);
    if (courseId === '__new__') return;
    const course = createOptions?.courses.find((c) => c.id === courseId);
    if (course) {
      setCreateCourseCode(course.code);
      setCreateCourseName(course.name);
    }
  };

  const handleCreateCourseCodeChange = (value: string) => {
    setCreateCourseCode(value.toUpperCase());
    const matched = createOptions?.courses.find(
      (c) => c.code.toUpperCase() === value.trim().toUpperCase(),
    );
    setCreateCourseId(matched?.id ?? '__new__');
  };

  const handleCreateHallChange = (value: string) => {
    setCreateHallName(value);
    const hall = createOptions?.halls.find(
      (h) => h.name.toLowerCase() === value.trim().toLowerCase(),
    );
    if (hall?.doorPassword) {
      setCreateDoorPassword(hall.doorPassword);
    }
  };

  const handleCreateLecture = async () => {
    if (createGroupIds.length === 0) {
      showToast('error', 'Select at least one batch');
      return;
    }
    if (!createHallName.trim()) {
      showToast('error', 'Place (hall) is required');
      return;
    }
    if (!createCourseCode.trim()) {
      showToast('error', 'Course code is required');
      return;
    }

    setSavingCreate(true);
    try {
      await api.post('/lecturers/me/timetable', {
        dayOfWeek: createDay,
        startTime: createStart,
        endTime: createEnd,
        courseId: createCourseId && createCourseId !== '__new__' ? createCourseId : undefined,
        courseCode: createCourseCode.trim(),
        courseName: createCourseName.trim() || undefined,
        hallName: createHallName.trim(),
        hallDoorPassword: createDoorPassword.trim() || null,
        groupIds: createGroupIds,
        notes: createNotes.trim() || null,
      });
      showToast('success', 'Lecture created. Students in selected batches will see it on their timetable.');
      setShowCreateModal(false);
      window.dispatchEvent(new Event('timetable-updated'));
      await fetchAll(true);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      showToast('error', ax.response?.data?.message || 'Failed to create lecture');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleSaveSlot = async () => {
    if (!selectedSlot) return;
    if (!editCourseCode.trim()) {
      showToast('error', 'Subject code is required');
      return;
    }
    setSavingSlot(true);
    try {
      await api.patch(`/lecturers/me/timetable/${selectedSlot.id}`, {
        dayOfWeek: editDay,
        startTime: editStart,
        endTime: editEnd,
        courseCode: editCourseCode.trim(),
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
            My teaching schedule
          </h1>
          <p className="tt-subtitle">
            Teaching slots from the admin timetable (matched by your code: <strong>{codeLabel}</strong>)
            · {mergedTimeBlocks} teaching time{mergedTimeBlocks !== 1 ? 's' : ''} ({flat.length}{' '}
            class{flat.length !== 1 ? 'es' : ''} merged by schedule)
          </p>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Pathways taught together at the same time appear in one box.{' '}
            <strong>Click a lecture</strong> for full subject details, or use <strong>Edit</strong> to
            change day, time, place, or notes — students see updates on their timetable. You can also
            add lectures manually for your batches.
          </p>
        </div>
        <div className="tt-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm flex items-center gap-1.5"
            onClick={openCreateModal}
          >
            <Plus size={16} /> Add lecture
          </button>
          <span className="tt-last-updated text-sm text-slate-600 whitespace-nowrap">
            Last updated: <strong>{formatLastUpdated(lastUpdated)}</strong>
          </span>
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
            Ask admin to import the faculty timetable, or{' '}
            <button type="button" className="text-[var(--color-primary)] underline font-medium" onClick={openCreateModal}>
              create a lecture manually
            </button>{' '}
            for your batches. Your lectures are matched using the two-letter code in the sheet (e.g.{' '}
            <strong>SP</strong> for Shaji Piraba). Your profile code is <strong>{codeLabel}</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="tt-grid-wrapper">
            <div className="tt-grid-scroll">
              <div
                className="tt-grid"
                style={{ gridTemplateColumns: `72px repeat(${DAYS.length}, minmax(0, 1fr))` }}
              >
                <div
                  className="tt-time-col"
                  style={{ minHeight: gridBodyHeight + LECTURER_HOUR_HEIGHT_PX }}
                >
                  <div className="tt-corner" />
                  {timeSlots.map((t) => (
                    <div key={t} className="tt-time-label">
                      {formatTime(t)}
                    </div>
                  ))}
                </div>

                {DAYS.map((day) => {
                  const slots = scheduleByDay[day] || [];
                  return (
                    <div key={day} className="tt-day-col">
                      <div className="tt-day-header">{DAY_LABELS[day]}</div>
                      <div
                        className="tt-day-body"
                        style={{
                          height: gridBodyHeight,
                          minHeight: 'var(--tt-body-height)',
                        }}
                      >
                        {layoutMergedBlocks(slots).map(({ block, topPx, heightPx }) => {
                          const primaryColor = getCourseColor(
                            block.sessions[0].course.id,
                            colorMap.current,
                          );
                          const isCompact = heightPx < 90;
                          const cardTitle = block.sessions
                            .map((s) => formatCourseLabel(s.course.code, s.course.name))
                            .join(' · ');
                          return (
                            <div
                              key={block.key}
                              className={`tt-slot-group tt-slot-group-merged tt-lecture-card-wrap tt-lecture-card-wrap-clickable${isCompact ? ' tt-lecture-card-wrap-compact' : ''}`}
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                              }}
                              title={`${cardTitle} — click for details`}
                              role="button"
                              tabIndex={0}
                              onClick={() => openDetailModal(block)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  openDetailModal(block);
                                }
                              }}
                            >
                              <div
                                className="tt-slot tt-slot-merged tt-lecture-card"
                                style={{
                                  backgroundColor: `${primaryColor}20`,
                                  borderLeft: `3px solid ${primaryColor}`,
                                }}
                              >
                                <div className="tt-lecture-card-top">
                                  <div className="tt-lecture-time-block">
                                    {!isCompact && (
                                      <Clock size={14} className="tt-lecture-time-icon" aria-hidden />
                                    )}
                                    <div className="tt-lecture-time-texts">
                                      <div className="tt-lecture-time-main">
                                        {formatTimeRange(block.startTime, block.endTime)}
                                      </div>
                                      {!isCompact && (
                                        <div className="tt-lecture-time-sub">
                                          {formatTimeRange24(block.startTime, block.endTime)}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {block.sessions.length === 1 && (
                                    <button
                                      type="button"
                                      className={`tt-lecture-edit-btn${isCompact ? ' tt-lecture-edit-btn-compact' : ''}`}
                                      title="Edit this lecture"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditModal(block.sessions[0].slots[0]);
                                      }}
                                    >
                                      <Pencil size={isCompact ? 12 : 14} />
                                      {!isCompact && <span>Edit</span>}
                                    </button>
                                  )}
                                </div>

                                <div className="tt-lecture-card-scroll">
                                  {block.sessions.map((session) => {
                                    const color = getCourseColor(session.course.id, colorMap.current);
                                    const classNames = session.slots.map((s) => s.group.name).join(', ');
                                    return (
                                      <div key={session.key} className="tt-lecture-card-body">
                                        <div className="tt-lecture-row">
                                          <span className="tt-lecture-label">Course</span>
                                          <span className="tt-lecture-value tt-lecture-course" style={{ color }}>
                                            {formatCourseLabel(session.course.code, session.course.name)}
                                          </span>
                                        </div>
                                        <div className="tt-lecture-row">
                                          <span className="tt-lecture-label">Place</span>
                                          <span className="tt-lecture-value">
                                            {session.hall.name}
                                            {session.hall.building ? ` · ${session.hall.building}` : ''}
                                          </span>
                                        </div>
                                        {session.hall.doorPassword && (
                                          <div className="tt-lecture-row">
                                            <span className="tt-lecture-label">Door</span>
                                            <span className="tt-lecture-value font-mono">
                                              {session.hall.doorPassword}
                                            </span>
                                          </div>
                                        )}
                                        <div className="tt-lecture-row">
                                          <span className="tt-lecture-label">Classes</span>
                                          <span className="tt-lecture-value">{classNames}</span>
                                        </div>
                                        {block.sessions.length > 1 && (
                                          <button
                                            type="button"
                                            className="tt-lecture-edit-btn tt-lecture-edit-btn-inline"
                                            title="Edit this lecture"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditModal(session.slots[0]);
                                            }}
                                          >
                                            <Pencil size={12} />
                                            {!isCompact && <span>Edit</span>}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
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
                const course = flat.find((s) => s.course.id === courseId)?.course;
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

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => !savingCreate && setShowCreateModal(false)}>
          <div className="modal tt-detail-modal tt-edit-modal tt-create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create lecture for batches</h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => !savingCreate && setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body space-y-4">
              {loadingCreateOptions ? (
                <div className="py-8 text-center text-slate-500">
                  <div className="spinner mx-auto mb-2" />
                  Loading batches and courses...
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Select batches, then type lecture details below. Scroll this popup to see all
                    fields. A timetable entry is created for each selected batch at the same day and
                    time.
                  </p>

                  <div className="lecturer-batch-picker">
                    <div className="lecturer-batch-picker-head">
                      <label className="block text-sm font-medium text-slate-700">
                        Batches ({createGroupIds.length} selected)
                      </label>
                      <input
                        type="search"
                        className="lecturer-batch-search"
                        placeholder="Search batch, pathway, department..."
                        value={batchSearch}
                        onChange={(e) => setBatchSearch(e.target.value)}
                      />
                    </div>
                    <div className="lecturer-batch-scroll" role="listbox" aria-multiselectable>
                      {filteredBatches.length === 0 ? (
                        <p className="text-sm text-slate-500 p-3 text-center">No batches match your search.</p>
                      ) : (
                        filteredBatches.map((g) => {
                          const checked = createGroupIds.includes(g.id);
                          const batchLabel = g.batchLabel ?? `Y${g.batchYear}`;
                          return (
                            <label
                              key={g.id}
                              className={`lecturer-batch-row${checked ? ' lecturer-batch-row-selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCreateGroup(g.id)}
                              />
                              <span className="lecturer-batch-row-main">
                                <span className="lecturer-batch-name">{g.name}</span>
                                <span className="lecturer-batch-meta">
                                  {batchLabel}
                                  {g.pathway ? ` · ${g.pathway.code || g.pathway.name}` : ''}
                                  {g.department ? ` · ${g.department.code}` : ''}
                                  {g.memberCount > 0 ? ` · ${g.memberCount} students` : ''}
                                </span>
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <label className="block text-sm">
                    <span className="text-slate-600">Quick pick course (optional)</span>
                    <select
                      className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                      value={createCourseId || '__new__'}
                      onChange={(e) => handleCreateCourseChange(e.target.value)}
                    >
                      <option value="__new__">Type course details manually</option>
                      {createOptions?.courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {formatCourseLabel(c.code, c.name)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="text-slate-600">Course code</span>
                      <input
                        type="text"
                        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono uppercase"
                        value={createCourseCode}
                        onChange={(e) => handleCreateCourseCodeChange(e.target.value)}
                        placeholder="ETEC22033"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-600">Lecture name</span>
                      <input
                        type="text"
                        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                        value={createCourseName}
                        onChange={(e) => setCreateCourseName(e.target.value)}
                        placeholder="e.g. ETEC 22033 T"
                      />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="text-slate-600">Place (hall / room)</span>
                    <input
                      type="text"
                      list="lecturer-hall-options"
                      className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                      value={createHallName}
                      onChange={(e) => handleCreateHallChange(e.target.value)}
                      placeholder="Type hall name manually, e.g. AB-LCH-03-2"
                    />
                    <datalist id="lecturer-hall-options">
                      {createOptions?.halls.map((h) => (
                        <option key={h.id} value={h.name}>
                          {h.building ? `${h.name} · ${h.building}` : h.name}
                        </option>
                      ))}
                    </datalist>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Pick from suggestions or type a new room name.
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="text-slate-600">Door password</span>
                    <input
                      type="text"
                      className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono"
                      value={createDoorPassword}
                      onChange={(e) => setCreateDoorPassword(e.target.value)}
                      placeholder="Room access code for students"
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="text-slate-600">Day</span>
                    <select
                      className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                      value={createDay}
                      onChange={(e) => setCreateDay(e.target.value as DayOfWeek)}
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
                        value={createStart}
                        onChange={(e) => setCreateStart(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-slate-600">End time</span>
                      <input
                        type="time"
                        className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5"
                        value={createEnd}
                        onChange={(e) => setCreateEnd(e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="text-slate-600">Additional notes</span>
                    <textarea
                      className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 min-h-[72px]"
                      value={createNotes}
                      onChange={(e) => setCreateNotes(e.target.value)}
                      placeholder="Optional notes for students"
                    />
                  </label>
                </>
              )}
            </div>
            <div className="modal-footer flex gap-2 justify-end p-4 border-t">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={savingCreate}
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingCreate || loadingCreateOptions}
                onClick={handleCreateLecture}
              >
                {savingCreate ? 'Creating...' : 'Create lecture'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailBlock && (
        <div className="modal-overlay" onClick={() => setDetailBlock(null)}>
          <div className="modal tt-detail-modal tt-lecturer-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Lecture details</h3>
              <button type="button" className="btn-close" onClick={() => setDetailBlock(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="tt-detail-grid">
                <div className="tt-detail-row">
                  <label>Day</label>
                  <span>{WEEKDAY_FULL[detailBlock.dayOfWeek as DayOfWeek] ?? detailBlock.dayOfWeek}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Time</label>
                  <span>
                    {formatTimeRange(detailBlock.startTime, detailBlock.endTime)}
                    <span className="block text-xs text-slate-500 mt-0.5">
                      {formatTimeRange24(detailBlock.startTime, detailBlock.endTime)}
                    </span>
                  </span>
                </div>
                <div className="tt-detail-row">
                  <label>Lecturer</label>
                  <span>
                    {lecturerDisplayName}
                    {timetableCodeLabel !== '—' && (
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Timetable code: {timetableCodeLabel}
                      </span>
                    )}
                    {user?.designation && (
                      <span className="block text-xs text-slate-500 mt-0.5">{user.designation}</span>
                    )}
                  </span>
                </div>
              </div>

              {detailBlock.sessions.map((session, sessionIndex) => {
                const primarySlot = session.slots[0];
                const classNames = session.slots.map((s) => s.group.name).join(', ');
                const courseColor = getCourseColor(session.course.id, colorMap.current);
                return (
                  <div
                    key={session.key}
                    className={`tt-lecturer-detail-session${sessionIndex > 0 ? ' mt-4 border-t border-slate-200 pt-4' : ' mt-4'}`}
                  >
                    <div
                      className="mb-3 rounded-lg px-3 py-2 text-sm font-bold"
                      style={{
                        backgroundColor: `${courseColor}18`,
                        borderLeft: `4px solid ${courseColor}`,
                        color: courseColor,
                      }}
                    >
                      {formatCourseLabel(session.course.code, session.course.name)}
                    </div>
                    <div className="tt-detail-grid">
                      <div className="tt-detail-row">
                        <label>Subject code</label>
                        <span className="font-mono">{session.course.code || '—'}</span>
                      </div>
                      <div className="tt-detail-row">
                        <label>Lecture name</label>
                        <span>{session.course.name || '—'}</span>
                      </div>
                      <div className="tt-detail-row">
                        <label>Place</label>
                        <span>
                          {session.hall.name}
                          {session.hall.building ? ` · ${session.hall.building}` : ''}
                        </span>
                      </div>
                      <div className="tt-detail-row">
                        <label>Door password</label>
                        <span>
                          {session.hall.doorPassword ? (
                            <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-sm text-emerald-800">
                              {session.hall.doorPassword}
                            </code>
                          ) : (
                            <span className="text-slate-500">Not set</span>
                          )}
                        </span>
                      </div>
                      <div className="tt-detail-row">
                        <label>Classes</label>
                        <span>{classNames}</span>
                      </div>
                      <div className="tt-detail-row">
                        <label>Semester / year</label>
                        <span>
                          Semester {primarySlot.semester}, {primarySlot.year}
                        </span>
                      </div>
                      {primarySlot.notes?.trim() && (
                        <div className="tt-detail-row">
                          <label>Notes</label>
                          <span>{primarySlot.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer tt-lecturer-detail-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailBlock(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="text-slate-600">Subject code</span>
                  <input
                    type="text"
                    className="mt-1 w-full border border-slate-300 rounded px-2 py-1.5 font-mono uppercase"
                    value={editCourseCode}
                    onChange={(e) => setEditCourseCode(e.target.value.toUpperCase())}
                    placeholder="ETEC22033"
                  />
                </label>
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
              </div>

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
