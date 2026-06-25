import type { TimetableGridCell, TimetableGridSnapshot } from '../types/timetableGrid';

const COURSE_RE = /\b([A-Z]{2,6})[-\s]+(\d{4,5}[A-Za-z0-9_]*)\b/i;
const HALL_GLOBAL_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/gi;

export interface EditableCellData {
  courseCode: string;
  subjectName: string;
  lecturerName: string;
  hallName: string;
  startTime: string;
  endTime: string;
  isOnline: boolean;
  sharedHall: boolean;
}

function stripCommonMarker(text: string): string {
  return text.replace(/\s+COMMON\b/gi, '').trim();
}

function lineHasCommonMarker(text: string): boolean {
  return /\bCOMMON\b/i.test(text);
}

export function cloneGrid(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  return JSON.parse(JSON.stringify(grid)) as TimetableGridSnapshot;
}

export function formatTimeLabel(start: string, end: string): string {
  return `${start} - ${end}`;
}

function cellLines(cell: TimetableGridCell): string[] {
  if (cell.displayLines?.length) return cell.displayLines;
  return cell.lines ?? [];
}

function parseHallFromLine(line: string): string | null {
  const trimmed = stripCommonMarker(line.trim().replace(/^room:\s*/i, '').trim());
  if (!trimmed || /^tbd$/i.test(trimmed)) return 'TBD';
  const halls = [...trimmed.matchAll(HALL_GLOBAL_RE)]
    .map((m) => m[1]?.trim())
    .filter((hall): hall is string => !!hall);
  if (halls.length > 0) return halls.join(', ');
  return null;
}

function courseCodeFromLine(line: string): string {
  const trimmed = line.trim();
  const cm = trimmed.match(COURSE_RE);
  if (cm) return `${cm[1]} ${cm[2]}`.trim();
  if (/^[A-Z]{2,6}-\d{4,5}/i.test(trimmed)) return trimmed;
  return trimmed;
}

export function parseCellToEditable(
  cell: TimetableGridCell,
  startTime: string,
  endTime: string,
): EditableCellData {
  const lines = cellLines(cell).map((l) => l.trim()).filter(Boolean);

  let hallName = 'TBD';
  const contentLines: string[] = [];

  for (const line of lines) {
    const hall = parseHallFromLine(line);
    if (hall) {
      hallName = hall;
      continue;
    }
    const text = line.replace(/^lecturer:\s*/i, '').trim();
    if (text && text !== '—' && text !== '-') {
      contentLines.push(text);
    }
  }

  let courseCode = '';
  let subjectName = '';
  let lecturerName = '';

  if (contentLines[0]) {
    subjectName = contentLines[0];
    courseCode = courseCodeFromLine(contentLines[0]);
  }
  if (contentLines[1]) {
    lecturerName = contentLines[1];
  }

  const sharedHall =
    cell.sharedHall === true || lines.some((l) => lineHasCommonMarker(l));

  return {
    courseCode,
    subjectName,
    lecturerName,
    hallName: stripCommonMarker(hallName),
    startTime,
    endTime,
    isOnline: cell.isOnline ?? false,
    sharedHall,
  };
}

export function buildCellFromEditable(data: EditableCellData): TimetableGridCell {
  const lines: string[] = [];
  const courseLine = (data.subjectName || data.courseCode).trim();
  if (courseLine) lines.push(courseLine);
  if (data.lecturerName.trim()) lines.push(data.lecturerName.trim());
  const hall = stripCommonMarker(data.hallName.trim() || 'TBD');
  lines.push(/^tbd$/i.test(hall) ? 'TBD' : hall);

  const rawText = lines.join('\n');
  return {
    rawText,
    lines,
    displayLines: lines,
    isEmpty: lines.length === 0,
    isBreak: false,
    isOnline: data.isOnline,
    rowSpan: 1,
    mergeContinue: false,
    slotStart: data.startTime,
    slotEnd: data.endTime,
    sharedHall: data.sharedHall === true,
  };
}

export function extractCourseKey(cell: TimetableGridCell): string | null {
  for (const line of cellLines(cell)) {
    const m = line.match(COURSE_RE);
    if (m) return `${m[1]} ${m[2]}`.trim().toUpperCase();
  }
  return null;
}

function splitLinesIntoCourseGroups(lines: string[]): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const isCourse = COURSE_RE.test(line);
    if (isCourse && current.some((l) => COURSE_RE.test(l))) {
      groups.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) groups.push(current);
  return groups.filter((g) => g.some((l) => COURSE_RE.test(l)));
}

function cellFromLineGroup(lines: string[], slotStart: string, slotEnd: string): TimetableGridCell {
  const rawText = lines.join('\n');
  return {
    rawText,
    lines,
    displayLines: lines,
    isEmpty: false,
    isBreak: false,
    isOnline: /\bonline\b/i.test(rawText),
    rowSpan: 1,
    mergeContinue: false,
    slotStart,
    slotEnd,
  };
}

const emptyCell = (): TimetableGridCell => ({
  rawText: '',
  lines: [],
  displayLines: [],
  isEmpty: true,
  isBreak: false,
  isOnline: false,
  rowSpan: 1,
  mergeContinue: false,
});

/** Split cells that contain multiple course codes into separate time rows */
function splitMultiCourseCells(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  const next = cloneGrid(grid);
  const cells = next.cells.map((row) => row.map((c) => ({ ...c })));

  for (let di = 0; di < (cells[0]?.length ?? 0); di++) {
    for (let ti = 0; ti < cells.length; ti++) {
      const cell = cells[ti][di];
      if (!cell || cell.mergeContinue || cell.isEmpty || cell.isBreak) continue;

      const lines = cellLines(cell);
      const groups = splitLinesIntoCourseGroups(lines);
      if (groups.length <= 1) continue;

      for (let g = 0; g < groups.length; g++) {
        const targetTi = ti + g;
        if (targetTi >= cells.length) break;
        const row = next.timeRows[targetTi];
        if (!row) break;
        cells[targetTi][di] = cellFromLineGroup(groups[g], row.start, row.end);
      }
    }
  }

  applyRowSpanMerges(cells);
  return { ...next, cells };
}

function ensureSlotTimesOnCells(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  const next = cloneGrid(grid);
  const cells = next.cells.map((row) => row.map((c) => ({ ...c })));

  for (let ti = 0; ti < cells.length; ti++) {
    for (let di = 0; di < (cells[ti]?.length ?? 0); di++) {
      const cell = cells[ti][di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;
      if (!cell.slotStart || !cell.slotEnd) {
        const span = Math.max(1, cell.rowSpan ?? 1);
        const endTi = Math.min(ti + span - 1, next.timeRows.length - 1);
        cell.slotStart = next.timeRows[ti]?.start ?? '08:00';
        cell.slotEnd = next.timeRows[endTi]?.end ?? next.timeRows[ti]?.end ?? '08:55';
      }
      const { startTi, endTi } = rowsForSlot(next.timeRows, cell.slotStart, cell.slotEnd);
      cell.rowSpan = Math.max(1, endTi - startTi + 1);
    }
  }

  return { ...next, cells };
}

/** Move each class to the row that matches its slotStart/slotEnd */
function repositionCellsToSlots(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  const next = cloneGrid(grid);
  const cells = next.cells.map((row) => row.map((c) => ({ ...c })));
  const rowCount = cells.length;
  const colCount = cells[0]?.length ?? 0;

  type Placement = { cell: TimetableGridCell; startTi: number; di: number };
  const placements: Placement[] = [];

  for (let di = 0; di < colCount; di++) {
    for (let ti = 0; ti < rowCount; ti++) {
      const cell = cells[ti][di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;
      const slotStart = cell.slotStart ?? next.timeRows[ti]?.start ?? '08:00';
      const slotEnd = cell.slotEnd ?? next.timeRows[ti]?.end ?? '08:55';
      const { startTi, endTi } = rowsForSlot(next.timeRows, slotStart, slotEnd);
      placements.push({
        di,
        startTi,
        cell: {
          ...cell,
          slotStart,
          slotEnd,
          rowSpan: Math.max(1, endTi - startTi + 1),
          mergeContinue: false,
        },
      });
    }
  }

  for (let ti = 0; ti < rowCount; ti++) {
    for (let di = 0; di < colCount; di++) {
      if (cells[ti][di]?.isBreak) continue;
      cells[ti][di] = emptyCell();
    }
  }

  for (const { cell, startTi, di } of placements) {
    const slot = cells[startTi]?.[di];
    if (slot && !slot.isEmpty && !slot.isBreak) continue;
    cells[startTi][di] = cell;
  }

  applyRowSpanMerges(cells);
  return { ...next, cells };
}

/** Normalize grid for the visual editor: split merged lectures, attach slot times */
export function prepareGridForEditing(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  return repositionCellsToSlots(ensureSlotTimesOnCells(splitMultiCourseCells(grid)));
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Parse manual time input (08:00, 8:00, 8.30) to HH:MM */
export function normalizeTimeInput(value: string): string | null {
  const t = value.trim();
  const m = t.match(/^(\d{1,2})[.:](\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function findRowIndexForStart(
  timeRows: TimetableGridSnapshot['timeRows'],
  startTime: string,
): number {
  const target = timeToMinutes(startTime);
  for (let i = 0; i < timeRows.length; i++) {
    if (timeRows[i].start === startTime) return i;
  }
  for (let i = 0; i < timeRows.length; i++) {
    const rowStart = timeToMinutes(timeRows[i].start);
    const rowEnd = timeToMinutes(timeRows[i].end);
    if (target >= rowStart && target < rowEnd) return i;
  }
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < timeRows.length; i++) {
    const diff = Math.abs(target - timeToMinutes(timeRows[i].start));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

function rowsForSlot(
  timeRows: TimetableGridSnapshot['timeRows'],
  startTime: string,
  endTime: string,
): { startTi: number; endTi: number } {
  const startM = timeToMinutes(startTime);
  const endM = timeToMinutes(endTime);
  let startTi = findRowIndexForStart(timeRows, startTime);
  let endTi = startTi;

  for (let i = 0; i < timeRows.length; i++) {
    const rs = timeToMinutes(timeRows[i].start);
    const re = timeToMinutes(timeRows[i].end);
    if (startM >= rs && startM < re) startTi = i;
    if (endM > rs && endM <= re) endTi = i;
  }
  if (endTi < startTi) endTi = startTi;
  return { startTi, endTi };
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, mins));
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
}

export function applyRowSpanMerges(cells: TimetableGridCell[][]): void {
  const rowCount = cells.length;
  const colCount = cells[0]?.length ?? 0;
  for (let di = 0; di < colCount; di++) {
    for (let ti = 0; ti < rowCount; ti++) {
      const cell = cells[ti][di];
      if (!cell || cell.mergeContinue || cell.isEmpty || cell.isBreak) continue;
      const span = Math.max(1, cell.rowSpan ?? 1);
      cell.rowSpan = span;
      for (let k = 1; k < span && ti + k < rowCount; k++) {
        cells[ti + k][di] = {
          rawText: '',
          lines: [],
          displayLines: [],
          isEmpty: true,
          isBreak: false,
          isOnline: false,
          rowSpan: 1,
          mergeContinue: true,
        };
      }
    }
  }
}

export function getCellSpanTimes(grid: TimetableGridSnapshot, ti: number, cell: TimetableGridCell) {
  if (cell.slotStart && cell.slotEnd) {
    return { startTime: cell.slotStart, endTime: cell.slotEnd };
  }
  const span = Math.max(1, cell.rowSpan ?? 1);
  const endTi = Math.min(ti + span - 1, grid.timeRows.length - 1);
  return {
    startTime: grid.timeRows[ti]?.start ?? '08:00',
    endTime: grid.timeRows[endTi]?.end ?? grid.timeRows[ti]?.end ?? '08:55',
  };
}

function hallsFromText(text: string): string[] {
  return [...stripCommonMarker(text).matchAll(HALL_GLOBAL_RE)]
    .map((m) => m[1]?.trim().toUpperCase())
    .filter((hall): hall is string => !!hall);
}

function hallsFromCellLines(cell: TimetableGridCell): string[] {
  const lines = cell.displayLines?.length ? cell.displayLines : cell.lines ?? [];
  const halls: string[] = [];
  for (const line of lines) {
    for (const hall of hallsFromText(line)) {
      if (!halls.includes(hall)) halls.push(hall);
    }
  }
  return halls;
}

function slotTimesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return s1 < e2 && s2 < e1;
}

/** Block double-booking the same hall twice in one batch grid before save. */
export function checkLocalHallOverlap(
  grid: TimetableGridSnapshot,
  di: number,
  startTime: string,
  endTime: string,
  hallName: string,
  sharedHall: boolean,
  excludeAnchorTi: number,
): string | null {
  const halls = hallsFromText(hallName);
  if (sharedHall || halls.length === 0) return null;

  for (let ti = 0; ti < grid.cells.length; ti++) {
    const cell = grid.cells[ti]?.[di];
    if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;
    if (ti === excludeAnchorTi) continue;

    const otherHalls = hallsFromCellLines(cell);
    const overlap = halls.find((hall) => otherHalls.includes(hall));
    if (!overlap) continue;
    if (cell.sharedHall === true) continue;

    const { startTime: oStart, endTime: oEnd } = getCellSpanTimes(grid, ti, cell);
    if (!slotTimesOverlap(startTime, endTime, oStart, oEnd)) continue;

    return `This batch already uses ${overlap} on ${grid.dayColumns[di]?.label ?? 'that day'} ${oStart}–${oEnd}. Change the time or room.`;
  }
  return null;
}

export type GridUpdateResult =
  | { ok: true; grid: TimetableGridSnapshot }
  | { ok: false; error: string };

export function updateCellInGrid(
  grid: TimetableGridSnapshot,
  ti: number,
  di: number,
  data: EditableCellData | null,
): GridUpdateResult {
  const next = cloneGrid(grid);
  const cells = next.cells.map((row) => row.map((c) => ({ ...c })));

  const clearAt = (row: number) => {
    cells[row][di] = emptyCell();
  };

  const clearAnchorSpan = (anchorTi: number) => {
    const anchor = cells[anchorTi]?.[di];
    const span = Math.max(1, anchor?.rowSpan ?? 1);
    for (let k = 0; k < span && anchorTi + k < cells.length; k++) {
      clearAt(anchorTi + k);
    }
  };

  if (!data || (!data.courseCode.trim() && !data.subjectName.trim())) {
    clearAnchorSpan(ti);
    applyRowSpanMerges(cells);
    return { ok: true, grid: { ...next, cells } };
  }

  const startTime = normalizeTimeInput(data.startTime) ?? data.startTime;
  const endTime = normalizeTimeInput(data.endTime) ?? data.endTime;
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return { ok: false, error: 'End time must be after start time' };
  }

  const { startTi, endTi } = rowsForSlot(next.timeRows, startTime, endTime);
  const occupied = cells[startTi][di];
  if (
    startTi !== ti &&
    occupied &&
    !occupied.isEmpty &&
    !occupied.isBreak &&
    !occupied.mergeContinue
  ) {
    return { ok: false, error: 'That time slot already has a class on this day' };
  }

  clearAnchorSpan(ti);

  const built = buildCellFromEditable({ ...data, startTime, endTime });
  built.rowSpan = Math.max(1, endTi - startTi + 1);
  built.slotStart = startTime;
  built.slotEnd = endTime;
  cells[startTi][di] = built;
  applyRowSpanMerges(cells);
  return { ok: true, grid: { ...next, cells } };
}

export function adjustRowBoundary(
  grid: TimetableGridSnapshot,
  rowIndex: number,
  deltaMinutes: number,
): TimetableGridSnapshot | null {
  if (rowIndex < 0 || rowIndex >= grid.timeRows.length - 1) return null;
  const next = cloneGrid(grid);
  const upper = next.timeRows[rowIndex];
  const lower = next.timeRows[rowIndex + 1];
  const upperEnd = timeToMinutes(upper.end);
  const lowerStart = timeToMinutes(lower.start);
  const boundary = Math.round((upperEnd + lowerStart) / 2);
  const newBoundary = boundary + deltaMinutes;
  const minBoundary = timeToMinutes(upper.start) + 15;
  const maxBoundary = timeToMinutes(lower.end) - 15;
  if (newBoundary < minBoundary || newBoundary > maxBoundary) return null;

  const newEnd = minutesToTime(newBoundary);
  const newStart = minutesToTime(newBoundary);
  next.timeRows[rowIndex] = {
    ...upper,
    end: newEnd,
    label: formatTimeLabel(upper.start, newEnd),
  };
  next.timeRows[rowIndex + 1] = {
    ...lower,
    start: newStart,
    label: formatTimeLabel(newStart, lower.end),
  };
  return next;
}

export function snapBoundaryFromPointer(
  grid: TimetableGridSnapshot,
  rowIndex: number,
  clientY: number,
  rowTop: number,
  rowHeight: number,
): TimetableGridSnapshot | null {
  if (rowIndex < 0 || rowIndex >= grid.timeRows.length - 1 || rowHeight <= 0) return null;
  const upper = grid.timeRows[rowIndex];
  const lower = grid.timeRows[rowIndex + 1];
  const upperStart = timeToMinutes(upper.start);
  const lowerEnd = timeToMinutes(lower.end);
  const ratio = Math.max(0, Math.min(1, (clientY - rowTop) / rowHeight));
  const total = lowerEnd - upperStart;
  let boundary = upperStart + Math.round(total * ratio);
  boundary = Math.round(boundary / 5) * 5;
  const minBoundary = upperStart + 15;
  const maxBoundary = lowerEnd - 15;
  boundary = Math.max(minBoundary, Math.min(maxBoundary, boundary));
  const delta = boundary - Math.round((timeToMinutes(upper.end) + timeToMinutes(lower.start)) / 2);
  if (Math.abs(delta) < 1) return null;
  return adjustRowBoundary(grid, rowIndex, delta);
}

