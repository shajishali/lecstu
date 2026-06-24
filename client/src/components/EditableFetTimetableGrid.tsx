import { useMemo, useRef, useState } from 'react';
import { Pencil, Plus, Trash2, GripHorizontal } from 'lucide-react';
import api from '@services/api';
import type { TimetableGridSnapshot, TimetableGridCell } from '../types/timetableGrid';
import {
  parseCellToEditable,
  updateCellInGrid,
  getCellSpanTimes,
  snapBoundaryFromPointer,
  normalizeTimeInput,
  extractCourseKey,
  checkLocalHallOverlap,
  type EditableCellData,
} from '../utils/fetGridEdit';
import { showToast } from '@components/Toast';

const COURSE_COLORS = [
  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626',
  '#7c3aed', '#db2777', '#0d9488', '#ea580c', '#2563eb',
  '#65a30d', '#9333ea', '#c026d3', '#0284c7', '#ca8a04',
];

function buildCourseColorLookup(grid: TimetableGridSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of grid.cells) {
    for (const cell of row) {
      if (!cell || cell.isEmpty || cell.isBreak) continue;
      const key = extractCourseKey(cell);
      if (key && !map.has(key)) {
        map.set(key, COURSE_COLORS[map.size % COURSE_COLORS.length]);
      }
    }
  }
  return map;
}

const HALL_LINE_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/i;

function stripCommonMarker(text: string): string {
  return text.replace(/\s+COMMON\b/gi, '').trim();
}

function formatLine(line: string, index: number, allLines: string[]): string {
  const t = stripCommonMarker(line.trim());
  if (t === '—' || t === '-' || t.toLowerCase() === 'unassigned') return 'Lecturer: —';
  if (t.toUpperCase() === 'TBD' && !allLines.some((l) => HALL_LINE_RE.test(l))) return 'Room: TBD';
  if (HALL_LINE_RE.test(t)) return t.startsWith('Room:') ? t : `Room: ${t}`;
  if (
    index > 0 &&
    (/^[A-Z]{1,4}(_[A-Za-z]+)?$|^VL_/i.test(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t)) &&
    t.length <= 24
  ) {
    return t.startsWith('Lecturer:') ? t : `Lecturer: ${t}`;
  }
  return line;
}

interface Props {
  grid: TimetableGridSnapshot;
  onChange: (grid: TimetableGridSnapshot) => void;
  tableId?: string;
  className?: string;
}

interface EditTarget {
  ti: number;
  di: number;
  dayLabel: string;
  isNew: boolean;
}

const emptyForm = (start: string, end: string): EditableCellData => ({
  courseCode: '',
  subjectName: '',
  lecturerName: '',
  hallName: 'TBD',
  startTime: start,
  endTime: end,
  isOnline: false,
  sharedHall: false,
});

export default function EditableFetTimetableGrid({ grid, onChange, tableId, className = '' }: Props) {
  const courseColorMap = useMemo(() => buildCourseColorLookup(grid), [grid]);
  const cellColors = (cell: TimetableGridCell): { bg: string; border: string } | undefined => {
    if (cell.isEmpty || cell.isBreak) return undefined;
    const key = extractCourseKey(cell);
    if (!key) return { bg: '#f1f5f9', border: '#94a3b8' };
    const border = courseColorMap.get(key) ?? '#64748b';
    return { bg: `${border}22`, border };
  };

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [form, setForm] = useState<EditableCellData>(emptyForm('08:00', '08:55'));
  const [slotError, setSlotError] = useState('');
  const [checkingSlot, setCheckingSlot] = useState(false);
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const dragRef = useRef<{ rowIndex: number; startY: number } | null>(null);

  const openEdit = (ti: number, di: number, cell: TimetableGridCell, isNew: boolean) => {
    const { startTime, endTime } = getCellSpanTimes(grid, ti, cell);
    setEditTarget({
      ti,
      di,
      dayLabel: grid.dayColumns[di]?.label ?? grid.dayColumns[di]?.day ?? '',
      isNew,
    });
    setForm(isNew ? emptyForm(startTime, endTime) : parseCellToEditable(cell, startTime, endTime));
    setSlotError('');
  };

  const updateForm = (patch: Partial<EditableCellData> | ((f: EditableCellData) => EditableCellData)) => {
    setSlotError('');
    setForm((f) => (typeof patch === 'function' ? patch(f) : { ...f, ...patch }));
  };

  const closeEdit = () => {
    setSlotError('');
    setEditTarget(null);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const start = normalizeTimeInput(form.startTime);
    const end = normalizeTimeInput(form.endTime);
    if (!start || !end) {
      showToast('error', 'Enter times as HH:MM (e.g. 08:00 or 9:30)');
      return;
    }
    if (start >= end) {
      showToast('error', 'End time must be after start time');
      return;
    }
    if (!form.courseCode.trim() && !form.subjectName.trim()) {
      showToast('error', 'Course code or subject name is required');
      return;
    }

    const localConflict = checkLocalHallOverlap(
      grid,
      editTarget.di,
      start,
      end,
      form.hallName,
      form.sharedHall,
      editTarget.ti,
    );
    if (localConflict) {
      setSlotError(localConflict);
      return;
    }

    const dayOfWeek = grid.dayColumns[editTarget.di]?.day;
    if (tableId && dayOfWeek) {
      setCheckingSlot(true);
      try {
        const res = await api.post(`/admin/timetable/tables/${tableId}/validate-slot`, {
          dayOfWeek,
          startTime: start,
          endTime: end,
          hallName: form.hallName.trim() || 'TBD',
          sharedHall: form.sharedHall,
        });
        const conflicts = (res.data?.conflicts ?? []) as { message: string }[];
        if (conflicts.length > 0) {
          setSlotError(conflicts[0].message);
          return;
        }
      } catch (err) {
        const ax = err as { response?: { data?: { message?: string } } };
        setSlotError(ax.response?.data?.message || 'Could not check room availability');
        return;
      } finally {
        setCheckingSlot(false);
      }
    }

    const payload = { ...form, startTime: start, endTime: end };
    const result = updateCellInGrid(grid, editTarget.ti, editTarget.di, payload);
    if (!result.ok) {
      showToast('error', result.error);
      return;
    }
    onChange(result.grid);
    closeEdit();
  };

  const removeCell = () => {
    if (!editTarget) return;
    const result = updateCellInGrid(grid, editTarget.ti, editTarget.di, null);
    if (result.ok) onChange(result.grid);
    closeEdit();
  };

  const onRowDragStart = (rowIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { rowIndex, startY: e.clientY };
    const onMove = (ev: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rowEl = rowRefs.current.get(drag.rowIndex);
      if (!rowEl) return;
      const rect = rowEl.getBoundingClientRect();
      const next = snapBoundaryFromPointer(grid, drag.rowIndex, ev.clientY, rect.top, rect.height);
      if (next) onChange(next);
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const timeOptions = grid.timeRows.flatMap((r) => [r.start, r.end]);
  const uniqueTimes = [...new Set(timeOptions)].sort();

  return (
    <>
      <div className={`fet-grid-root overflow-auto ${className}`}>
        <p className="mb-2 text-xs text-slate-500">
          Standard day starts at 08:00. Each course has its own colour. If a class starts at 09:00, the 08:00 slot
          stays free. Drag row borders to adjust band times.
        </p>
        <div className="fet-grid-title mb-3 text-center text-lg font-bold text-slate-800">
          {grid.tableTitle}
          {grid.pathwayCode && (
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({grid.programCode} {grid.studyYear} {grid.pathwayCode})
            </span>
          )}
        </div>
        <table className="fet-grid-table w-full min-w-[720px] border-collapse text-xs">
          <thead>
            <tr>
              <th className="fet-grid-time-head sticky left-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-700">
                Time
              </th>
              {grid.dayColumns.map((d) => (
                <th
                  key={d.day}
                  className="border border-slate-300 bg-slate-100 px-2 py-2 text-center font-semibold text-slate-700"
                >
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.timeRows.map((time, ti) => (
              <tr
                key={`${time.start}-${ti}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(ti, el);
                  else rowRefs.current.delete(ti);
                }}
                className="fet-grid-row relative"
              >
                <td className="fet-grid-time relative sticky left-0 z-[5] border border-slate-200 bg-white px-2 py-1.5 text-right font-medium text-slate-600 whitespace-nowrap">
                  {time.label}
                  {ti < grid.timeRows.length - 1 && (
                    <button
                      type="button"
                      className="fet-row-resize-handle"
                      title="Drag to adjust time boundary"
                      onMouseDown={(e) => onRowDragStart(ti, e)}
                    >
                      <GripHorizontal size={12} />
                    </button>
                  )}
                </td>
                {grid.dayColumns.map((d, di) => {
                  const cell = grid.cells[ti]?.[di];
                  if (!cell || cell.mergeContinue) return null;
                  const colors = cellColors(cell);
                  const { startTime, endTime } = getCellSpanTimes(grid, ti, cell);
                  return (
                    <td
                      key={d.day}
                      rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                      className="fet-grid-cell relative border border-slate-200 align-top p-0"
                      style={
                        colors
                          ? { backgroundColor: colors.bg, borderLeft: `4px solid ${colors.border}` }
                          : undefined
                      }
                    >
                      {cell.isBreak ? (
                        <div className="px-2 py-2 text-center font-semibold text-slate-400">-X-</div>
                      ) : cell.isEmpty ? (
                        <div className="group relative min-h-[52px] px-2 py-2 text-center text-slate-300">
                          ---
                          <button
                            type="button"
                            className="fet-cell-edit-btn opacity-0 group-hover:opacity-100"
                            title="Add class"
                            onClick={() => openEdit(ti, di, cell, true)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="group relative px-2 py-1.5 leading-snug text-slate-900">
                          <div className="mb-1 text-[10px] font-semibold text-slate-500">
                            {startTime} – {endTime}
                          </div>
                          {(cell.displayLines?.length ? cell.displayLines : cell.lines).map((line, li) => (
                            <div key={li} className={li === 0 ? 'font-semibold' : ''}>
                              {formatLine(line, li, cell.displayLines?.length ? cell.displayLines : cell.lines)}
                            </div>
                          ))}
                          {cell.isOnline && (
                            <div className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-800">
                              Online
                            </div>
                          )}
                          <button
                            type="button"
                            className="fet-cell-edit-btn"
                            title="Edit class"
                            onClick={() => openEdit(ti, di, cell, false)}
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeEdit}>
          <div
            className="flex max-h-[min(88vh,640px)] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="shrink-0 border-b border-slate-100 px-4 py-3 text-base font-semibold text-slate-800">
              {editTarget.isNew ? 'Add class' : 'Edit class'} — {editTarget.dayLabel}
            </h3>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
              <label className="block text-sm font-medium text-slate-700">
                Course code
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  value={form.courseCode}
                  onChange={(e) => updateForm({ courseCode: e.target.value })}
                  placeholder="e.g. BTEC 12062"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Subject / title
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  value={form.subjectName}
                  onChange={(e) => updateForm({ subjectName: e.target.value })}
                  placeholder="Full subject line as shown in table"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Lecturer
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  value={form.lecturerName}
                  onChange={(e) => updateForm({ lecturerName: e.target.value })}
                  placeholder="Lecturer name or code"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Room / hall
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  value={form.hallName}
                  onChange={(e) => updateForm({ hallName: e.target.value })}
                  placeholder="e.g. AB-LCH-09-1 or TBD"
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form.sharedHall}
                  onChange={(e) => updateForm({ sharedHall: e.target.checked })}
                />
                <span>
                  Shared room (admin only)
                  <span className="block text-xs font-normal text-slate-500">
                    Same hall &amp; time as another batch (not shown to students).
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-slate-700">
                  Start time
                  <input
                    type="text"
                    list="fet-start-times"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    value={form.startTime}
                    onChange={(e) => updateForm({ startTime: e.target.value })}
                    placeholder="08:00"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  End time
                  <input
                    type="text"
                    list="fet-end-times"
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                    value={form.endTime}
                    onChange={(e) => updateForm({ endTime: e.target.value })}
                    placeholder="09:55"
                  />
                </label>
              </div>
              <datalist id="fet-start-times">
                {uniqueTimes.map((t) => (
                  <option key={`s-${t}`} value={t} />
                ))}
              </datalist>
              <datalist id="fet-end-times">
                {uniqueTimes.map((t) => (
                  <option key={`e-${t}`} value={t} />
                ))}
              </datalist>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isOnline}
                  onChange={(e) => updateForm({ isOnline: e.target.checked })}
                />
                Online class
              </label>
              {slotError && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-snug text-amber-950">
                  {slotError}
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap justify-between gap-2 border-t border-slate-100 px-4 py-3">
              {!editTarget.isNew && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                  onClick={removeCell}
                >
                  <Trash2 size={14} /> Remove
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={closeEdit}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
                  onClick={() => void saveEdit()}
                  disabled={checkingSlot}
                >
                  {checkingSlot ? 'Checking…' : 'Apply'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
