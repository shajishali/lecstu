import type { TimetableGridSnapshot, TimetableGridCell } from '../types/timetableGrid';
import { normalizeCourseCode, isValidFacultyCourseCode, baseCourseCode } from './handbookCatalogService';

const COURSE_CODE_RE =
  /\b(GTEC|CTEC|CSCI|CTNT|SWST|GANI|ETEC|ETIA|ETMP|ETST|AINT|DSCI|CSEC|SPCS|SCOM|ENPR|DELT|LNPR|GCPR|MGMT)[\s-]+(\d{4,5})/i;

export function courseCodeFromGridText(text: string): string | null {
  const m = text.match(COURSE_CODE_RE);
  if (!m) return null;
  const code = `${m[1].toUpperCase()}-${m[2]}`;
  return isValidFacultyCourseCode(code) ? normalizeCourseCode(code) : null;
}

export function courseCodeFromGridCell(cell: TimetableGridCell | null | undefined): string | null {
  if (!cell || cell.isEmpty || cell.isBreak) return null;
  const lines = cell.displayLines?.length ? cell.displayLines : cell.lines;
  for (const line of lines) {
    const code = courseCodeFromGridText(line);
    if (code) return code;
  }
  return null;
}

/** Hide grid cells whose course code is not in the visible set (break/lunch rows kept). */
export function filterGridByVisibleCourseCodes(
  grid: TimetableGridSnapshot,
  visibleCodes: Set<string>,
): TimetableGridSnapshot {
  if (visibleCodes.size === 0) return grid;

  const cells = grid.cells.map((row) =>
    row.map((cell) => {
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) return cell;
      const code = courseCodeFromGridCell(cell);
      if (!code || visibleCodes.has(code)) return cell;
      return {
        ...cell,
        isEmpty: true,
        isOnline: false,
        lines: [],
        displayLines: [],
        rawText: '',
        rowSpan: 1,
      };
    }),
  );

  return { ...grid, cells };
}

function cellIsRenderable(cell: TimetableGridCell | null | undefined): boolean {
  return Boolean(cell && !cell.isEmpty && !cell.isBreak && !cell.mergeContinue);
}

function scheduleKey(day: string, start: string, end: string): string {
  return `${day}|${start}|${end}`;
}

function formatTimeLabel(start: string, end: string): string {
  return `${start} - ${end.replace(':', '.')}`;
}

function createEmptyGridCell(): TimetableGridCell {
  return {
    rawText: '',
    lines: [],
    displayLines: [],
    isEmpty: true,
    isBreak: false,
    isOnline: false,
    rowSpan: 1,
    mergeContinue: false,
  };
}

function cloneGrid(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  return {
    ...grid,
    timeRows: [...grid.timeRows],
    dayColumns: [...grid.dayColumns],
    cells: grid.cells.map((row) => row.map((cell) => (cell ? { ...cell } : cell))),
  };
}

function ensureTimeRow(grid: TimetableGridSnapshot, start: string, end: string): TimetableGridSnapshot {
  const existing = grid.timeRows.findIndex((t) => t.start === start && t.end === end);
  if (existing >= 0) return grid;

  const newRow = { label: formatTimeLabel(start, end), start, end };
  let insertAt = grid.timeRows.length;
  for (let i = 0; i < grid.timeRows.length; i++) {
    if (grid.timeRows[i]!.start > start) {
      insertAt = i;
      break;
    }
  }

  const timeRows = [...grid.timeRows];
  timeRows.splice(insertAt, 0, newRow);

  const emptyRow = grid.dayColumns.map(() => createEmptyGridCell());
  const cells = grid.cells.map((row) => [...row]);
  cells.splice(insertAt, 0, emptyRow);

  return { ...grid, timeRows, cells };
}

function placeCellAtSchedule(
  grid: TimetableGridSnapshot,
  day: string,
  start: string,
  end: string,
  cell: TimetableGridCell,
): TimetableGridSnapshot {
  let next = ensureTimeRow(grid, start, end);
  const rowIdx = next.timeRows.findIndex((t) => t.start === start && t.end === end);
  const colIdx = next.dayColumns.findIndex((d) => d.day === day);
  if (rowIdx < 0 || colIdx < 0) return next;

  const existing = next.cells[rowIdx]?.[colIdx];
  if (cellIsRenderable(existing)) {
    const existingCode = courseCodeFromGridCell(existing);
    const newCode = courseCodeFromGridCell(cell);
    if (existingCode && newCode && existingCode === newCode) return next;
    return next;
  }

  const cells = next.cells.map((row, ri) =>
    row.map((c, ci) => (ri === rowIdx && ci === colIdx ? { ...cell } : c)),
  );
  return { ...next, cells };
}

function electiveCodeMatches(cellCode: string | null, electiveCodes: Set<string>): boolean {
  if (!cellCode) return false;
  if (electiveCodes.has(cellCode)) return true;
  return electiveCodes.has(baseCourseCode(cellCode));
}

/** Copy elective cells from sibling pathway grids, matched by day + time (not row index). */
export function mergeElectiveCellsFromGrids(
  base: TimetableGridSnapshot,
  sources: TimetableGridSnapshot[],
  electiveCodes: Set<string>,
): TimetableGridSnapshot {
  if (electiveCodes.size === 0 || sources.length === 0) return base;

  let grid = cloneGrid(base);

  for (const source of sources) {
    for (let r = 0; r < source.cells.length; r++) {
      for (let c = 0; c < (source.cells[r]?.length ?? 0); c++) {
        const srcCell = source.cells[r]?.[c];
        if (!cellIsRenderable(srcCell)) continue;

        const code = courseCodeFromGridCell(srcCell);
        if (!electiveCodeMatches(code, electiveCodes)) continue;

        const day = source.dayColumns[c]?.day;
        const time = source.timeRows[r];
        if (!day || !time) continue;

        grid = placeCellAtSchedule(grid, day, time.start, time.end, { ...srcCell! });
      }
    }
  }

  return grid;
}

export interface ElectiveGridSlot {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  hallName?: string | null;
  lecturerLabel?: string | null;
}

function buildCellFromElectiveSlot(slot: ElectiveGridSlot): TimetableGridCell {
  const code = baseCourseCode(slot.courseCode);
  const title = slot.courseName?.trim() && !slot.courseName.includes(code.replace('-', ' '))
    ? `${code.replace(/-/g, ' ')} — ${slot.courseName}`
    : code.replace(/-/g, ' ');
  const hall = slot.hallName?.trim() || 'TBD';
  const lines = [title, hall];
  if (slot.lecturerLabel?.trim()) lines.push(slot.lecturerLabel.trim());

  return {
    rawText: lines.join('\n'),
    lines,
    displayLines: lines,
    isEmpty: false,
    isBreak: false,
    isOnline: /online/i.test(slot.courseCode) || /online/i.test(slot.courseName),
    rowSpan: 1,
    mergeContinue: false,
    slotStart: slot.startTime,
    slotEnd: slot.endTime,
  };
}

/** Add personalized elective slots into the grid (extends late time bands when needed). */
export function injectElectiveSlotsIntoGrid(
  base: TimetableGridSnapshot,
  slots: ElectiveGridSlot[],
  electiveCodes: Set<string>,
): TimetableGridSnapshot {
  if (slots.length === 0 || electiveCodes.size === 0) return base;

  let grid = cloneGrid(base);
  for (const slot of slots) {
    const code = baseCourseCode(slot.courseCode);
    if (!electiveCodes.has(code)) continue;
    grid = placeCellAtSchedule(
      grid,
      slot.dayOfWeek,
      slot.startTime,
      slot.endTime,
      buildCellFromElectiveSlot(slot),
    );
  }
  return grid;
}
