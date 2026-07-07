import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { parseGroupName } from '@components/StudentEnrollmentForm';
import { showToast } from '@components/Toast';
import TranslatableText from '@components/TranslatableText';
import api from '@services/api';
import { useMarkSectionReadOnVisit } from '@hooks/useMarkSectionReadOnVisit';
import { formatBatchTableTitle, extractBatchYearLabel } from '@utils/batchTableMeta';
import { formatCourseLabel, formatCatalogCourseLabel } from '@utils/courseDisplay';
import { formatTimetableLecturer } from '@utils/timetableLecturerDisplay';
import { Printer, Download, RefreshCw } from 'lucide-react';
import FetTimetableGrid from '@components/FetTimetableGrid';
import type { TimetableGridSnapshot } from '../types/timetableGrid';

interface SlotData {
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
  lecturerInitials?: string | null;
  lecturer: { id: string; firstName: string; lastName: string; email: string };
  hall: { id: string; name: string; building: string; capacity: number; doorPassword?: string | null };
  group: { id: string; name: string; batchYear: number; batchLabel?: string | null };
}

type WeeklyTimetable = Record<string, SlotData[]>;

interface PersonalizationMeta {
  supportsModuleSelection: boolean;
  modulesConfigured: boolean;
  selectedCourseIds: string[];
  electiveCourseIds: string[];
  catalog: Array<{
    courseId: string;
    code: string;
    name: string;
    requirementType: 'COMPULSORY' | 'OPTIONAL';
    credits: number | null;
  }>;
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

/** FET grids typically run 08:00-20:55 (13 hourly bands) */
const GRID_START_HOUR = 8;
const GRID_END_HOUR = 21;
const TIME_SLOTS = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => {
  const h = GRID_START_HOUR + i;
  return `${String(h).padStart(2, '0')}:00`;
});

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

function getCurrentDayName(): string | null {
  const jsDay = new Date().getDay(); // 0=Sun, 1=Mon … 6=Sat
  const map: Record<number, string> = {
    0: 'SUNDAY',
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
  };
  return map[jsDay] ?? null;
}

function getCurrentDayIndex(): number {
  const name = getCurrentDayName();
  if (!name) return 0;
  const idx = DAYS.indexOf(name);
  return idx >= 0 ? idx : 0;
}

function getCurrentTimePosition(): number | null {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  if (hours < GRID_START_HOUR || hours >= GRID_END_HOUR) return null;

  const totalMinutes = (hours - GRID_START_HOUR) * 60 + minutes;
  const totalRange = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  return (totalMinutes / totalRange) * 100;
}

function getSlotPosition(startTime: string, endTime: string) {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = (sh - GRID_START_HOUR) * 60 + sm;
  const endMin = (eh - GRID_START_HOUR) * 60 + em;
  const totalRange = (GRID_END_HOUR - GRID_START_HOUR) * 60;
  return {
    top: (startMin / totalRange) * 100,
    height: ((endMin - startMin) / totalRange) * 100,
  };
}

/** Group slots that share the same time range (overlapping in the grid) so we can stack them. */
function groupOverlappingSlots(slots: SlotData[]): SlotData[][] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime)
  );
  const groups: SlotData[][] = [];
  let current: SlotData[] = [sorted[0]];
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

interface TimetableEnrollment {
  programCode: string;
  studyYear: string;
  pathwayCode: string;
  groupName: string;
  selectedBatchYearLabel?: string | null;
}

function countGridOccupiedSlots(grid: TimetableGridSnapshot | null): number {
  if (!grid?.cells?.length) return 0;
  let count = 0;
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell && !cell.isEmpty && !cell.isBreak && !cell.mergeContinue) count += 1;
    }
  }
  return count;
}

function formatMembershipGroupName(
  group: NonNullable<import('../types/auth').User['studentGroupMemberships']>[number]['group'] | undefined,
  selectedBatchYearLabel?: string | null,
): string {
  if (!group) return '';
  const parsed = parseGroupName(group.name);
  if (parsed.year === 'Y1' && parsed.program && selectedBatchYearLabel) {
    return `Y1-${parsed.program}-${selectedBatchYearLabel.slice(-2)}`;
  }
  return group.name;
}

export default function MyTimetable() {
  const { user } = useAuthStore();
  useMarkSectionReadOnVisit(user?.role, '/timetable');
  const location = useLocation();
  const [, setWeekly] = useState<WeeklyTimetable>({});
  const [flat, setFlat] = useState<SlotData[]>([]);
  const [gridSnapshot, setGridSnapshot] = useState<TimetableGridSnapshot | null>(null);
  const [enrollment, setEnrollment] = useState<TimetableEnrollment | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [personalization, setPersonalization] = useState<PersonalizationMeta | null>(null);
  const [savingModules, setSavingModules] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotData | null>(null);
  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => Math.max(0, getCurrentDayIndex()));
  const colorMap = useRef(new Map<string, string>());
  const gridRef = useRef<HTMLDivElement>(null);
  const lastFetchedGroupIdRef = useRef<string>('');
  const lastTimetableErrorToastAt = useRef(0);
  const hasLoadedOnceRef = useRef(false);

  const profileMembership = user?.studentGroupMemberships?.[0];
  const profileGroup = profileMembership?.group;
  const enrolledGroupId = profileGroup?.id ?? '';
  const enrolledGroupName = formatMembershipGroupName(profileGroup, profileMembership?.selectedBatchYearLabel);
  const enrolledGroupKey = `${enrolledGroupId}:${profileMembership?.selectedBatchYearLabel ?? ''}`;

  /** Prefer live profile group so UI updates before/without waiting on timetable API cache */
  const displayEnrollment = useMemo((): TimetableEnrollment | null => {
    if (profileGroup) {
      const parsed = parseGroupName(profileGroup.name);
      const pathwayFromGroup =
        parsed.pathway ||
        profileGroup.pathway?.code?.replace(/^(CS|ET|CT|BS)-/, '') ||
        '';
      return {
        programCode: parsed.program,
        studyYear: parsed.year || profileGroup.batchLabel || '',
        pathwayCode: pathwayFromGroup,
        groupName: formatMembershipGroupName(profileGroup, profileMembership?.selectedBatchYearLabel),
        selectedBatchYearLabel: profileMembership?.selectedBatchYearLabel ?? null,
      };
    }
    return enrollment;
  }, [profileGroup, profileMembership?.selectedBatchYearLabel, enrollment]);

  const fetchTimetable = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true && hasLoadedOnceRef.current;
    const groupChanged = lastFetchedGroupIdRef.current !== enrolledGroupKey;
    if (groupChanged) {
      setWeekly({});
      setFlat([]);
      setGridSnapshot(null);
      setEnrollment(null);
      setLastUpdated(null);
      colorMap.current.clear();
      hasLoadedOnceRef.current = false;
    }
    lastFetchedGroupIdRef.current = enrolledGroupKey;

    if (silent) setRefreshing(true);
    else setInitialLoading(true);
    try {
      const res = await api.get('/timetable/my', {
        params: { _: Date.now() },
      });
      const data = res.data.data;
      setWeekly(data.weekly || {});
      setFlat(data.flat || []);
      setGridSnapshot(data.grid ?? null);
      setEnrollment(data.enrollment ?? null);
      setPersonalization(data.personalization ?? null);
      const p = data.personalization as PersonalizationMeta | undefined;
      if (p?.supportsModuleSelection) {
        const electiveIds = new Set(p.electiveCourseIds ?? []);
        setModuleDraft(
          p.modulesConfigured ? p.selectedCourseIds.filter((id) => electiveIds.has(id)) : [],
        );
      } else {
        setModuleDraft([]);
      }
      setLastUpdated(data.lastUpdated ?? null);
      colorMap.current.clear();
      hasLoadedOnceRef.current = true;
    } catch {
      const now = Date.now();
      if (now - lastTimetableErrorToastAt.current > 3000) {
        lastTimetableErrorToastAt.current = now;
        showToast('error', 'Failed to load timetable');
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [enrolledGroupKey, enrolledGroupName]);

  useEffect(() => {
    fetchTimetable();
  }, [fetchTimetable]);

  // Refetch when navigating here from another page (e.g. after profile enrollment change)
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    const navigatedToTimetable =
      location.pathname === '/timetable' && prevPathRef.current !== '/timetable';
    prevPathRef.current = location.pathname;
    if (navigatedToTimetable) {
      fetchTimetable({ silent: hasLoadedOnceRef.current });
    }
  }, [location.pathname, enrolledGroupId, fetchTimetable]);

  // Refetch when timetable is updated (admin import, enrollment change) - keep grid visible
  useEffect(() => {
    const onTimetableUpdated = () => fetchTimetable({ silent: true });
    window.addEventListener('timetable-updated', onTimetableUpdated);
    return () => window.removeEventListener('timetable-updated', onTimetableUpdated);
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
        `${s.dayOfWeek},${s.startTime},${s.endTime},${s.course.code} - ${s.course.name},${formatTimetableLecturer(s)},${s.hall.name} (${s.hall.building}),${s.group.name}`
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

  const compulsoryCatalog = useMemo(
    () => personalization?.catalog.filter((c) => c.requirementType === 'COMPULSORY') ?? [],
    [personalization],
  );

  const optionalCatalog = useMemo(
    () => personalization?.catalog.filter((c) => c.requirementType === 'OPTIONAL') ?? [],
    [personalization],
  );

  const saveModuleSelections = async () => {
    const electiveOnly = moduleDraft.filter((id) =>
      (personalization?.electiveCourseIds ?? []).includes(id),
    );
    setSavingModules(true);
    try {
      await api.put('/courses/my/course-selections', { courseIds: electiveOnly });
      showToast('success', 'Personal timetable saved.');
      await fetchTimetable({ silent: true });
    } catch {
      showToast('error', 'Failed to save module selections');
    } finally {
      setSavingModules(false);
    }
  };

  const toggleModuleDraft = (courseId: string) => {
    setModuleDraft((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  };

  const todayDayName = getCurrentDayName(); // e.g. "MONDAY" or null on Sunday

  const scheduleByDay = useMemo(() => {
    const byDay: WeeklyTimetable = {};
    for (const day of DAYS) byDay[day] = [];
    for (const s of flat) {
      if (byDay[s.dayOfWeek]) byDay[s.dayOfWeek].push(s);
    }
    for (const day of DAYS) byDay[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return byDay;
  }, [flat]);

  const safeMobileIdx = Math.min(mobileDayIndex, DAYS.length - 1);

  const displayClassTitle = useMemo(() => {
    if (!displayEnrollment?.programCode || !displayEnrollment.studyYear) return null;
    const groupKey = displayEnrollment.pathwayCode
      ? `${displayEnrollment.programCode}-${displayEnrollment.studyYear}-${displayEnrollment.pathwayCode}`
      : `${displayEnrollment.programCode}-${displayEnrollment.studyYear}`;
    const batchYear =
      displayEnrollment.selectedBatchYearLabel ??
      extractBatchYearLabel(displayEnrollment.groupName, groupKey);
    return formatBatchTableTitle(groupKey, batchYear);
  }, [displayEnrollment]);

  const showStoredFetGrid = Boolean(gridSnapshot);
  const gridSlotCount = useMemo(() => countGridOccupiedSlots(gridSnapshot), [gridSnapshot]);
  const displaySlotCount = Math.max(flat.length, gridSlotCount);
  const hasTimetableContent = flat.length > 0 || gridSlotCount > 0;

  function formatLastUpdated(iso: string | null | undefined): string {
    if (!iso) return 'Not updated yet';
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  if (initialLoading) {
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
            {user?.role === 'STUDENT' ? 'Student' : 'Lecturer'} schedule:{' '}
            {displaySlotCount} slot{displaySlotCount !== 1 ? 's' : ''}
            {displayClassTitle && (
              <> · Class: <strong>{displayClassTitle}</strong></>
            )}
            {!displayClassTitle && displayEnrollment?.groupName && (
              <> · Class: <strong>{displayEnrollment.groupName}</strong></>
            )}
            {' · '}
            Last updated: <strong>{formatLastUpdated(lastUpdated)}</strong>
          </p>
        </div>
        <div className="tt-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchTimetable({ silent: true })}
            title="Refresh"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint} title="Print">
            <Printer size={16} />
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={displaySlotCount === 0}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {personalization?.supportsModuleSelection && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Personalize your timetable (Y3 / Y4)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Compulsory modules always stay on your timetable. Tick the optional or elective subjects you are taking,
            then save to build your personal view.
          </p>

          {compulsoryCatalog.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-800">Compulsory modules</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {compulsoryCatalog.map((course) => (
                  <span
                    key={course.courseId}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700"
                  >
                    {formatCatalogCourseLabel(course.code, course.name)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {optionalCatalog.length > 0 ? (
            <div className="mt-4">
              <h3 className="text-sm font-medium text-slate-800">Optional / elective modules</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {optionalCatalog.map((course) => (
                  <label
                    key={course.courseId}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={moduleDraft.includes(course.courseId)}
                      onChange={() => toggleModuleDraft(course.courseId)}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-slate-800">
                        {formatCatalogCourseLabel(course.code, course.name)}
                      </span>
                      {course.credits != null && (
                        <span className="ml-2 text-slate-500">{course.credits} credits</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModuleDraft(optionalCatalog.map((c) => c.courseId))}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setModuleDraft([])}
                >
                  Clear optional
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={savingModules}
                  onClick={saveModuleSelections}
                >
                  {savingModules ? 'Saving...' : 'Save personal timetable'}
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No optional electives are listed for your pathway in the handbook. If the imported timetable includes
              extra subjects from other pathways, they will appear here for selection.
            </p>
          )}
        </div>
      )}

      {!hasTimetableContent ? (
        <div className="tt-empty">
          <h3>No timetable entries found</h3>
          <p>
            {user?.role === 'STUDENT' ? (
              user.studentGroupMemberships?.length ? (
                <>
                  Your profile class is{' '}
                  <strong>{displayEnrollment?.groupName ?? user.studentGroupMemberships.map((m) => m.group.name).join(', ')}</strong>
                  {displayEnrollment?.pathwayCode
                    ? ` (${displayEnrollment.programCode}, ${displayEnrollment.studyYear}, pathway ${displayEnrollment.pathwayCode})`
                    : displayEnrollment?.programCode
                      ? ` (${displayEnrollment.programCode}, ${displayEnrollment.studyYear})`
                      : ''}
                  . There are no classes in the timetable for this group yet - ask admin to import the{' '}
                  <strong>{displayEnrollment?.groupName ?? 'your group'}</strong> timetable PDF in Admin → Timetable → Import
                  (use Replace period), then refresh this page. Update enrollment in My Profile if the class is wrong.
                </>
              ) : (
                'You are not assigned to a student group yet. Set your program, study year, and pathway in My Profile → Academic year enrollment.'
              )
            ) : (
              'No lectures assigned yet. Ask admin to import the faculty timetable - your slots are matched using the two-letter code in the sheet (e.g. SP for Shaji Piraba). Open My Schedule to view and edit your teaching grid.'
            )}
          </p>
        </div>
      ) : (
        <>
        <div className="tt-grid-wrapper" ref={gridRef}>
          {/* Mobile view: day-by-day cards */}
          <div className="tt-mobile-view">
            <div className="tt-mobile-day-tabs">
              {DAYS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  className={`tt-mobile-day-tab ${idx === safeMobileIdx ? 'active' : ''} ${day === todayDayName ? 'today' : ''}`}
                  onClick={() => setMobileDayIndex(idx)}
                >
                  <TranslatableText text={DAY_LABELS[day]} />
                </button>
              ))}
            </div>
            <div className="tt-mobile-slots">
              {(scheduleByDay[DAYS[safeMobileIdx]] || []).length === 0 ? (
                <p className="tt-mobile-empty">
                  No classes on <TranslatableText text={DAY_LABELS[DAYS[safeMobileIdx]]} />
                </p>
              ) : (
                (scheduleByDay[DAYS[safeMobileIdx]] || [])
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((slot) => {
                    const color = getCourseColor(slot.course.id, colorMap.current);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        className="tt-mobile-slot-card"
                        style={{ borderLeftColor: color }}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <span className="tt-mobile-slot-time">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                        <span className="tt-mobile-slot-course" style={{ color }}>
                          {formatCourseLabel(slot.course.code, slot.course.name)}
                        </span>
                        <span className="tt-mobile-slot-hall">
                          {slot.hall.name}
                          {slot.hall.building ? ` · ${slot.hall.building}` : ''}
                          {slot.hall.doorPassword ? ` · Door: ${slot.hall.doorPassword}` : ''}
                          {formatTimetableLecturer(slot) !== '-' && ` · ${formatTimetableLecturer(slot)}`}
                        </span>
                      </button>
                    );
                  })
              )}
            </div>
          </div>

          {/* Stored FET table (faithful to uploaded Excel) or slot-based calendar */}
          <div className="tt-grid-scroll">
          {showStoredFetGrid && gridSnapshot ? (
            <FetTimetableGrid grid={gridSnapshot} className="max-h-[min(78vh,calc(100vh-220px))]" />
          ) : (
          <div
            className="tt-grid"
            style={{
              gridTemplateColumns: `72px repeat(${DAYS.length}, minmax(128px, 1fr))`,
            }}
          >
            {/* Time column */}
            <div className="tt-time-col">
              <div className="tt-corner" />
              {TIME_SLOTS.map((t) => (
                <div key={t} className="tt-time-label">{formatTime(t)}</div>
              ))}
            </div>

            {DAYS.map((day) => {
              const slots = scheduleByDay[day] || [];
              const isToday = day === todayDayName;
              return (
                <div key={day} className={`tt-day-col ${isToday ? 'tt-today' : ''}`}>
                  <div className={`tt-day-header ${isToday ? 'active' : ''}`}>
                    <TranslatableText text={DAY_LABELS[day]} />
                    {isToday && <span className="tt-today-dot" />}
                  </div>
                  <div className="tt-day-body">
                    {groupOverlappingSlots(slots).map((group) => {
                      const { top, height } = getSlotPosition(group[0].startTime, group[0].endTime);
                      return (
                        <div
                          key={group.map((s) => s.id).join('-')}
                          className="tt-slot-group"
                          style={{ top: `${top}%`, height: `${height}%` }}
                        >
                          {group.map((slot) => {
                            const color = getCourseColor(slot.course.id, colorMap.current);
                            const isCompact = group.length > 1;
                            return (
                              <div
                                key={slot.id}
                                className={`tt-slot ${isCompact ? 'tt-slot-compact' : ''}`}
                                style={{
                                  backgroundColor: `${color}25`,
                                  borderLeft: `3px solid ${color}`,
                                }}
                                onClick={() => setSelectedSlot(slot)}
                                title={`${slot.course.code} · ${formatTime(slot.startTime)} - ${formatTime(slot.endTime)} · ${slot.hall.name}${formatTimetableLecturer(slot) !== '-' ? ` · ${formatTimetableLecturer(slot)}` : ''}`}
                              >
                                <span className="tt-slot-code" style={{ color }}>
                                  {formatCourseLabel(slot.course.code, slot.course.name)}
                                </span>
                                {!isCompact && (
                                  <>
                                    <span className="tt-slot-time">{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                                    <span className="tt-slot-meta">
                                      {slot.hall.name}
                                      {slot.hall.building ? ` · ${slot.hall.building}` : ''}
                                      {slot.hall.doorPassword ? ` · Door: ${slot.hall.doorPassword}` : ''}
                                      {formatTimetableLecturer(slot) !== '-' && ` · ${formatTimetableLecturer(slot)}`}
                                    </span>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {isToday && currentTimePos !== null && (
                      <div className="tt-now-line" style={{ top: `${currentTimePos}%` }}>
                        <div className="tt-now-dot" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
          </div>
        </div>

        {/* Legend: below the table, never inside or overlapping */}
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
                  <span>{formatCourseLabel(selectedSlot.course.code, selectedSlot.course.name)}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Day</label>
                  <span>{selectedSlot.dayOfWeek}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Time</label>
                  <span>{formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)}</span>
                </div>
                <div className="tt-detail-row">
                  <label>Lecturer</label>
                  <span>
                    {formatTimetableLecturer(selectedSlot)}
                    {(selectedSlot.lecturer as { designation?: string | null }).designation && (
                      <span className="block text-xs text-slate-500 mt-0.5">{(selectedSlot.lecturer as { designation?: string | null }).designation}</span>
                    )}
                  </span>
                </div>
                <div className="tt-detail-row">
                  <label>Hall</label>
                  <span>{selectedSlot.hall.name} ({selectedSlot.hall.building})</span>
                </div>
                {selectedSlot.hall.doorPassword && (
                  <div className="tt-detail-row">
                    <label>Door password</label>
                    <span>
                      <code className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-sm text-emerald-800">
                        {selectedSlot.hall.doorPassword}
                      </code>
                    </span>
                  </div>
                )}
                <div className="tt-detail-row">
                  <label>Capacity</label>
                  <span>{selectedSlot.hall.capacity} seats</span>
                </div>
                <div className="tt-detail-row">
                  <label>Group</label>
                  <span>{selectedSlot.group.name} (Batch {selectedSlot.group.batchLabel ?? selectedSlot.group.batchYear})</span>
                </div>
                <div className="tt-detail-row">
                  <label>Semester / Year</label>
                  <span>Semester {selectedSlot.semester}, {selectedSlot.year}</span>
                </div>
                {selectedSlot.notes?.trim() && (
                  <div className="tt-detail-row">
                    <label>Notes</label>
                    <span>{selectedSlot.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
