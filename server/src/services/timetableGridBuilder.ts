/**
 * Builds faithful FET grid snapshots (table-by-table) from Excel matrix + merges.
 */
import type * as XLSX from 'xlsx';
import type { TimetableGridCell, TimetableGridSnapshot } from '../types/timetableGrid';
import type { ParsedTimetableRow } from './timetableParserService';
import { parseEnrollmentFromGroupName } from './studentGroupResolver';
import {
  resolveLecturerDisplayName,
  type LecturerDisplayIndex,
} from './lecturerDisplayService';
import { isFetActivitySuffix } from './lecturerInitialsMatch';

type Matrix = unknown[][];

/** Non-global patterns for .test() / .match() capture groups */
const HALL_CODE_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/i;
const COURSE_CODE_RE = /\b([A-Z]{2,6})[-\s]+(\d{4,5}[A-Za-z0-9_]*)\b/i;
const HALL_GLOBAL_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/gi;

function excelCellToString(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value > 0 && value < 1) {
    const mins = Math.round(value * 24 * 60);
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }
  return String(value).trim();
}

function parseTimeRange(s: string): { start: string; end: string } | null {
  const t = s?.trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})\b/);
  if (m) {
    const start = `${m[1].padStart(2, '0')}:${m[2]}`;
    const end = `${m[3].padStart(2, '0')}:${m[4]}`;
    if (start < end) return { start, end };
  }
  return null;
}

function timeRangeFromMatrixRow(matrix: Matrix, rowIdx: number): { start: string; end: string } | null {
  for (let c = 0; c < 3; c++) {
    const range = parseTimeRange(excelCellToString(matrix[rowIdx]?.[c] ?? ''));
    if (range) return range;
  }
  return null;
}

function isFetEmptyCell(s: string): boolean {
  const t = (s || '').trim().toLowerCase();
  if (!t) return true;
  return t === '---' || t === '--' || t === '-x-' || t === 'x';
}

function isFetBreakCell(s: string): boolean {
  return /^-x-$/i.test((s || '').trim());
}

function isYearBatchLabel(line: string): boolean {
  return /^Y\d+\s+(CS|ET|CT|BS|BST)/i.test(line.trim()) && !COURSE_CODE_RE.test(line);
}

function isLecturerOrMetaLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 24) return false;
  if (isFetActivitySuffix(t)) return false;
  if (COURSE_CODE_RE.test(t)) return false;
  if (HALL_CODE_RE.test(t)) return false;
  if (/\bonline\b/i.test(t)) return false;
  if (isYearBatchLabel(t)) return false;
  return (
    /^[A-Z]{1,4}(_[A-Za-z]+)?$/.test(t) ||
    /^VL_/i.test(t) ||
    /^[A-Z]\.[A-Z]\.?$/.test(t) ||
    /^(SB|NC|KVS|KP|MB|ND|SL)$/i.test(t)
  );
}

function stripActivitySuffixFromCourseLine(line: string): string {
  if (!COURSE_CODE_RE.test(line)) return line.trim();
  return line.replace(/\s+[TP]\s*$/i, '').trim();
}

function normalizeDisplayLine(line: string): string {
  const withoutLabel = line
    .replace(/^lecturer:\s*/i, '')
    .replace(/^room:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripActivitySuffixFromCourseLine(withoutLabel);
}

/** Excel repeats merged cell text on every row — keep only top-left cell value. */
function mergedCellText(matrix: Matrix, merges: XLSX.Range[], r: number, c: number): string {
  let r0 = r;
  let c0 = c;
  for (const m of merges) {
    if (r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c) {
      r0 = m.s.r;
      c0 = m.s.c;
      break;
    }
  }
  return excelCellToString(matrix[r0]?.[c0] ?? '').trim();
}

function isOrphanMetaLine(line: string): boolean {
  const t = line.trim();
  if (!t || t === ',' || t === '.' || /^[,.\s]+$/.test(t)) return true;
  return false;
}

function normalizeCellLines(raw: string): string[] {
  const split = raw
    .split(/\n|[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l && !isFetEmptyCell(l) && !isOrphanMetaLine(l));

  const seen = new Set<string>();
  const lines: string[] = [];
  const halls: string[] = [];

  for (const line of split) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const hallMatches = [...line.matchAll(HALL_GLOBAL_RE)];
    if (hallMatches.length > 0) {
      let remainder = line;
      for (const m of hallMatches) {
        const h = m[1];
        if (!halls.some((x) => x.toUpperCase() === h.toUpperCase())) halls.push(h);
        remainder = remainder.replace(m[0], ' ').trim();
      }
      if (remainder && !isYearBatchLabel(remainder)) {
        const clean = normalizeDisplayLine(remainder);
        if (clean && !isFetActivitySuffix(clean)) lines.push(clean);
      }
      continue;
    }

    if (!isYearBatchLabel(line)) {
      const clean = normalizeDisplayLine(line);
      if (clean && !isFetActivitySuffix(clean)) lines.push(clean);
    }
  }

  const uniqueHalls = [...new Set(halls.map((h) => h.toUpperCase()))].map(
    (h) => halls.find((x) => x.toUpperCase() === h) || h,
  );

  return [...lines, ...uniqueHalls];
}

function cellFromRaw(raw: string): TimetableGridCell {
  const displayLines = normalizeCellLines(raw);
  const isBreak = isFetBreakCell(raw) || (displayLines.length === 1 && isFetBreakCell(displayLines[0]));
  const isEmpty = (isFetEmptyCell(raw) || displayLines.length === 0) && !isBreak;
  const isOnline = /\bonline\b/i.test(raw);
  return {
    rawText: raw,
    lines: displayLines,
    displayLines,
    isEmpty,
    isBreak,
    isOnline,
    rowSpan: 1,
    mergeContinue: false,
  };
}

function isContinuationOnly(cell: TimetableGridCell): boolean {
  if (cell.isEmpty || cell.isBreak) return false;
  return cell.displayLines.every((l) => isLecturerOrMetaLine(l));
}

/** After lunch break (-X-), lecturer/hall lines continue the same class — merge into block above. */
function stitchPostBreakContinuations(cells: TimetableGridCell[][], timeRowCount: number): void {
  const dayCount = cells[0]?.length ?? 0;
  for (let di = 0; di < dayCount; di++) {
    let blockStart = -1;
    let afterBreak = false;

    for (let ti = 0; ti < timeRowCount; ti++) {
      const cell = cells[ti][di];
      if (cell.isBreak) {
        afterBreak = true;
        continue;
      }
      if (cell.isEmpty || cell.mergeContinue) continue;

      if (afterBreak && blockStart >= 0 && isContinuationOnly(cell)) {
        const block = cells[blockStart][di];
        const merged = normalizeCellLines([...block.displayLines, ...cell.displayLines].join('\n'));
        block.displayLines = merged;
        block.lines = merged;
        block.rawText = merged.join('\n');
        block.rowSpan += cell.rowSpan;
        cell.mergeContinue = true;
        cell.isEmpty = true;
        cell.displayLines = [];
        cell.lines = [];
        continue;
      }

      if (!cell.mergeContinue) {
        blockStart = ti;
        afterBreak = false;
      }
    }
  }
}

const DAY_ALIASES: Record<string, string> = {
  monday: 'MONDAY',
  mon: 'MONDAY',
  tuesday: 'TUESDAY',
  tue: 'TUESDAY',
  wednesday: 'WEDNESDAY',
  wed: 'WEDNESDAY',
  thursday: 'THURSDAY',
  thu: 'THURSDAY',
  friday: 'FRIDAY',
  fri: 'FRIDAY',
  saturday: 'SATURDAY',
  sat: 'SATURDAY',
  sunday: 'SUNDAY',
  sun: 'SUNDAY',
};

const DAY_LABEL: Record<string, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

function parseDay(s: string): string | null {
  const d = s?.trim().toLowerCase();
  if (!d) return null;
  return DAY_ALIASES[d] ?? DAY_ALIASES[d.slice(0, 3)] ?? null;
}

function findFetDayColumnsInRange(
  matrix: Matrix,
  startRow: number,
  endRow: number,
): { headerRow: number; dayCols: { col: number; day: string; label: string }[] } {
  const from = Math.max(0, startRow);
  const to = Math.min(matrix.length - 1, endRow);
  for (let r = from; r <= Math.min(from + 25, to); r++) {
    const row = (matrix[r] ?? []).map((c) => excelCellToString(c));
    const dayCols: { col: number; day: string; label: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const day = parseDay(row[c]);
      if (day) dayCols.push({ col: c, day, label: row[c].trim() || DAY_LABEL[day] });
    }
    if (dayCols.length >= 3) return { headerRow: r, dayCols };
  }
  return { headerRow: -1, dayCols: [] };
}

function tableTitleFromSection(matrix: Matrix, anchorRow: number, fallback: string): string {
  for (let r = Math.max(0, anchorRow - 2); r <= anchorRow + 1; r++) {
    for (let c = 0; c < 8; c++) {
      const s = excelCellToString(matrix[r]?.[c] ?? '').trim();
      if (/^Y\d+\s+/i.test(s) && s.length < 40 && !COURSE_CODE_RE.test(s)) {
        return s;
      }
    }
  }
  return fallback;
}

/** FET multi-hour blocks: merged class cells may start below the first hour label in column A. */
function expandMergeStartRow(matrix: Matrix, mergeStart: number, col: number, headerRow: number): number {
  let r0 = mergeStart;
  while (r0 > headerRow + 1 && !timeRangeFromMatrixRow(matrix, r0)) {
    const prev = r0 - 1;
    const prevTime = timeRangeFromMatrixRow(matrix, prev);
    const prevDay = excelCellToString(matrix[prev]?.[col] ?? '').trim();
    if (prevTime && isFetEmptyCell(prevDay)) {
      r0 = prev;
      continue;
    }
    break;
  }
  return r0;
}

function timeSpanFromMatrixRows(
  matrix: Matrix,
  r0: number,
  r1: number,
): { start: string; end: string } | null {
  let start: string | null = null;
  let end: string | null = null;
  for (let r = r0; r <= r1; r++) {
    const tr = timeRangeFromMatrixRow(matrix, r);
    if (!tr) continue;
    if (start === null || tr.start < start) start = tr.start;
    if (end === null || tr.end > end) end = tr.end;
  }
  if (!start || !end || start >= end) return null;
  return { start, end };
}

function expandMergeEndRow(matrix: Matrix, mergeEnd: number, col: number, endRow: number): number {
  let r1 = mergeEnd;
  while (r1 + 1 <= endRow) {
    const nextDay = excelCellToString(matrix[r1 + 1]?.[col] ?? '').trim();
    const nextTime = timeRangeFromMatrixRow(matrix, r1 + 1);
    if (nextTime && isFetEmptyCell(nextDay)) {
      r1++;
      continue;
    }
    break;
  }
  return r1;
}

function collectMergedCellText(matrix: Matrix, r0: number, r1: number, col: number): string {
  const parts: string[] = [];
  for (let r = r0; r <= r1; r++) {
    const v = excelCellToString(matrix[r]?.[col] ?? '').trim();
    if (!isFetEmptyCell(v)) parts.push(v);
  }
  return parts.join('\n');
}

function timeRowSpanForSlot(
  timeRows: { start: string; end: string }[],
  slotStart: string,
  slotEnd: string,
): { startTi: number; endTi: number } | null {
  let startTi = -1;
  let endTi = -1;
  for (let i = 0; i < timeRows.length; i++) {
    const row = timeRows[i];
    if (row.start === slotStart) startTi = i;
    if (row.end === slotEnd) endTi = i;
    if (row.start >= slotStart && row.end <= slotEnd && row.start < slotEnd) {
      if (startTi < 0) startTi = i;
      endTi = i;
    }
  }
  if (startTi < 0 || endTi < startTi) return null;
  return { startTi, endTi };
}

/** Resolve slot times and row indices from cell metadata (admin editor uses slotStart/slotEnd). */
function slotBoundsFromCell(
  cell: TimetableGridCell,
  timeRows: { start: string; end: string }[],
  ti: number,
): { startTime: string; endTime: string; startTi: number; endTi: number } {
  const slotStart = cell.slotStart?.trim();
  const slotEnd = cell.slotEnd?.trim();
  if (slotStart && slotEnd) {
    const span = timeRowSpanForSlot(timeRows, slotStart, slotEnd);
    if (span) {
      return { startTime: slotStart, endTime: slotEnd, ...span };
    }
  }
  const span = Math.max(1, cell.rowSpan ?? 1);
  const endTi = Math.min(ti + span - 1, timeRows.length - 1);
  return {
    startTime: slotStart ?? timeRows[ti]?.start ?? '08:00',
    endTime: slotEnd ?? timeRows[endTi]?.end ?? '08:55',
    startTi: ti,
    endTi,
  };
}

function dedupeTimeRows(
  timeRowIndices: { row: number; label: string; start: string; end: string }[],
): { row: number; label: string; start: string; end: string }[] {
  const out: typeof timeRowIndices = [];
  for (const t of timeRowIndices) {
    const prev = out[out.length - 1];
    if (prev && prev.start === t.start && prev.end === t.end) continue;
    out.push(t);
  }
  return out;
}

export function buildFetGridSnapshot(
  matrix: Matrix,
  merges: XLSX.Range[],
  startRow: number,
  endRow: number,
  groupName: string,
  period: { year: number; month: number; week: number; semester?: number },
  anchorRow: number,
): TimetableGridSnapshot | null {
  const { headerRow, dayCols } = findFetDayColumnsInRange(matrix, startRow, endRow);
  if (headerRow < 0 || !groupName.trim()) return null;

  const rawTimeRows: { row: number; label: string; start: string; end: string }[] = [];
  for (let r = headerRow + 1; r <= endRow; r++) {
    const tr = timeRangeFromMatrixRow(matrix, r);
    if (!tr) continue;
    const label = excelCellToString(matrix[r]?.[0] ?? '') || `${tr.start} - ${tr.end}`;
    rawTimeRows.push({ row: r, label, start: tr.start, end: tr.end });
  }
  const timeRowIndices = dedupeTimeRows(rawTimeRows);
  if (timeRowIndices.length === 0) return null;

  const enrollment = parseEnrollmentFromGroupName(groupName);
  const cells: TimetableGridCell[][] = timeRowIndices.map(() =>
    dayCols.map(() => cellFromRaw('')),
  );

  const rowIndexByMatrixRow = new Map<number, number>();
  timeRowIndices.forEach((t, i) => rowIndexByMatrixRow.set(t.row, i));

  const filled = new Set<string>();

  for (const m of merges) {
    if (m.e.r < headerRow + 1 || m.s.r > endRow) continue;
    const dayCol = dayCols.find((d) => d.col >= m.s.c && d.col <= m.e.c);
    if (!dayCol) continue;
    const col = dayCol.col;
    const dayIdx = dayCols.indexOf(dayCol);

    const r0 = expandMergeStartRow(matrix, m.s.r, col, headerRow);
    const r1 = m.e.r;
    const raw = collectMergedCellText(matrix, r0, r1, col) || mergedCellText(matrix, merges, m.s.r, col);
    if (!raw || isFetEmptyCell(raw)) continue;

    const timeIndicesInMerge: number[] = [];
    for (const [matrixR, ti] of rowIndexByMatrixRow) {
      if (matrixR >= r0 && matrixR <= r1) timeIndicesInMerge.push(ti);
    }
    if (timeIndicesInMerge.length === 0) continue;

    let firstTi = Math.min(...timeIndicesInMerge);
    let lastTi = Math.max(...timeIndicesInMerge);
    const band = timeSpanFromMatrixRows(matrix, r0, r1);
    if (band) {
      const span = timeRowSpanForSlot(timeRowIndices, band.start, band.end);
      if (span) {
        firstTi = span.startTi;
        lastTi = span.endTi;
      }
    }
    const cell = cellFromRaw(raw);
    cell.rowSpan = lastTi - firstTi + 1;
    cells[firstTi][dayIdx] = cell;
    for (let ti = firstTi + 1; ti <= lastTi; ti++) {
      cells[ti][dayIdx] = { ...cellFromRaw(''), mergeContinue: true, rowSpan: 1 };
    }
    for (let ti = firstTi; ti <= lastTi; ti++) filled.add(`${timeRowIndices[ti].row},${col}`);
  }

  for (let ti = 0; ti < timeRowIndices.length; ti++) {
    for (let di = 0; di < dayCols.length; di++) {
      const key = `${timeRowIndices[ti].row},${dayCols[di].col}`;
      if (filled.has(key)) continue;
      const raw = mergedCellText(matrix, merges, timeRowIndices[ti].row, dayCols[di].col);
      if (raw) cells[ti][di] = cellFromRaw(raw);
    }
  }

  stitchPostBreakContinuations(cells, timeRowIndices.length);

  return {
    tableTitle: tableTitleFromSection(matrix, anchorRow, groupName),
    groupName,
    programCode: enrollment.programCode,
    studyYear: enrollment.studyYear,
    pathwayCode: enrollment.pathwayCode,
    year: period.year,
    month: period.month,
    week: period.week,
    semester: period.semester ?? 1,
    dayColumns: dayCols.map((d) => ({ day: d.day, label: d.label })),
    timeRows: timeRowIndices.map((t) => ({ label: t.label, start: t.start, end: t.end })),
    cells,
  };
}

function extractCourseFromLines(lines: string[]): { code: string; name: string } | null {
  for (const line of lines) {
    const m = line.match(COURSE_CODE_RE);
    if (m) {
      const code = `${m[1]} ${m[2]}`.trim();
      return { code: code.replace(/\s+/g, '-').toUpperCase(), name: line.trim() || code };
    }
  }
  // Manual admin entry: first non-hall, non-lecturer line (e.g. legacy codes)
  for (const line of lines) {
    const t = line.trim();
    if (!t || lineHasHall(t) || lineHasLecturer(t) || isOrphanMetaLine(t)) continue;
    if (/^[A-Z]{2,6}-\d{4,5}/i.test(t)) {
      return { code: t.replace(/\s+/g, '-').toUpperCase(), name: t };
    }
  }
  return null;
}

function extractHallFromLines(lines: string[]): string {
  const halls: string[] = [];
  for (const line of lines) {
    for (const m of line.matchAll(HALL_GLOBAL_RE)) {
      const hall = m[1]?.trim();
      if (hall && !halls.some((h) => h.toUpperCase() === hall.toUpperCase())) {
        halls.push(hall);
      }
    }
  }
  return halls.length > 0 ? halls.join(', ') : 'TBD';
}

function extractLecturerFromLines(lines: string[]): string | undefined {
  for (const line of lines) {
    if (isFetActivitySuffix(line.trim())) continue;
    if (isLecturerOrMetaLine(line)) return line.trim();
  }
  return undefined;
}

function cellLines(cell: TimetableGridCell): string[] {
  const lines = cell.displayLines ?? cell.lines ?? [];
  return Array.isArray(lines) ? lines : [];
}

/** Mark continuation rows under a rowSpan anchor (client JSON may omit mergeContinue). */
function applyRowSpanMerges(cells: TimetableGridCell[][]): void {
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
          ...cells[ti + k][di],
          mergeContinue: true,
          isEmpty: true,
          isBreak: false,
          displayLines: [],
          lines: [],
          rawText: '',
          rowSpan: 1,
        };
      }
    }
  }
}

export type GridSlotRef = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseName: string;
  hallName?: string;
  lecturerName?: string;
  hallIsShared?: boolean;
};

function lineHasHall(line: string): boolean {
  return HALL_CODE_RE.test(line);
}

function lineHasLecturer(line: string): boolean {
  const t = line.trim();
  if (isFetActivitySuffix(t)) return false;
  if (t === '—' || t === '-') return true;
  if (isLecturerOrMetaLine(line) || /^VL_/i.test(t)) return true;
  if (/^[A-Za-z][A-Za-z\s.'-]{2,60}$/.test(t) && t.includes(' ')) return true;
  return false;
}

/** Drop repeated course/hall/lecturer lines from multiple repair passes. */
export function dedupeFetLines(lines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const t = normalizeDisplayLine(line);
    if (!t || isOrphanMetaLine(t)) continue;
    if (isFetActivitySuffix(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Merge FET display lines: slot import data wins for course; add missing hall/lecturer. */
export function mergeFetDisplayLines(
  existing: string[],
  fromSlot: string[],
  lecturerDisplay?: LecturerDisplayIndex,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const add = (line: string) => {
    const t = line.trim();
    if (!t || isOrphanMetaLine(t)) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  existing = dedupeFetLines(existing);
  fromSlot = dedupeFetLines(fromSlot);

  let bestCourse = '';
  for (const line of fromSlot) {
    if (COURSE_CODE_RE.test(line)) bestCourse = line;
  }
  if (!bestCourse) {
    for (const line of existing) {
      if (COURSE_CODE_RE.test(line) && line.length > bestCourse.length) bestCourse = line;
    }
  }
  if (!bestCourse) {
    for (const line of existing) {
      const t = line.trim();
      if (!t || lineHasHall(t) || lineHasLecturer(t) || isOrphanMetaLine(t)) continue;
      bestCourse = t;
      break;
    }
  }
  if (bestCourse) add(bestCourse);

  for (const line of [...existing, ...fromSlot]) {
    if (lineHasHall(line)) add(line);
  }
  for (const line of [...existing, ...fromSlot]) {
    if (lineHasLecturer(line) && !lineHasHall(line) && !COURSE_CODE_RE.test(line)) add(line);
  }
  for (const line of [...existing, ...fromSlot]) {
    if (!COURSE_CODE_RE.test(line) && !lineHasHall(line) && !lineHasLecturer(line)) add(line);
  }

  if (out.length > 0) {
    const hasHall = out.some((l) => lineHasHall(l) || l.toUpperCase() === 'TBD');
    const hasLect = out.some((l) => lineHasLecturer(l));
    if (!hasHall) out.push('TBD');
    if (!hasLect) out.push('—');
  }

  const lectLines = out.filter(
    (l) => lineHasLecturer(l) && !lineHasHall(l) && !COURSE_CODE_RE.test(l) && l !== '—',
  );
  if (lectLines.length > 1) {
    const resolved = lectLines.map(
      (l) => (lecturerDisplay ? resolveLecturerDisplayName(l, lecturerDisplay) : null) ?? l,
    );
    const keep = resolved.reduce((a, b) => (a.length >= b.length ? a : b));
    for (let i = out.length - 1; i >= 0; i--) {
      const l = out[i]!;
      if (lineHasLecturer(l) && !lineHasHall(l) && !COURSE_CODE_RE.test(l) && l !== '—' && l !== keep) {
        out.splice(i, 1);
      }
    }
    if (!out.includes(keep)) {
      const courseIdx = out.findIndex((l) => COURSE_CODE_RE.test(l));
      out.splice(courseIdx >= 0 ? courseIdx + 1 : 0, 0, keep);
    }
  }

  return out.length > 0 ? out : normalizeCellLines([...existing, ...fromSlot].join('\n'));
}

/** Build display lines — always includes a hall line (TBD when unknown) and lecturer when known. */
export function slotToFetDisplayLines(
  slot: GridSlotRef,
  lecturerDisplay?: LecturerDisplayIndex,
): string[] {
  const lines: string[] = [];
  if (slot.courseName?.trim()) lines.push(slot.courseName.trim());
  const lectRaw = slot.lecturerName?.trim();
  const lectClean = lectRaw
    ? lectRaw
        .split(/\s+/)
        .filter((p) => p.toUpperCase() !== 'TBD')
        .join(' ')
        .trim()
    : '';
  if (lectClean && lectClean !== '—') {
    const lect =
      lecturerDisplay != null
        ? resolveLecturerDisplayName(lectClean, lecturerDisplay) ?? lectClean
        : lectClean;
    lines.push(lect);
  }
  lines.push((slot.hallName?.trim() || 'TBD').toUpperCase() === 'TBD' ? 'TBD' : slot.hallName!.trim());
  return lines;
}

function extractLecturerFromCourseLine(line: string): string | undefined {
  const parts = line.trim().split(/\s+/);
  const codes: string[] = [];
  while (parts.length > 2) {
    const last = parts[parts.length - 1]!;
    if (isFetActivitySuffix(last)) {
      parts.pop();
      continue;
    }
    if (isLecturerOrMetaLine(last) || /^VL_/i.test(last)) {
      codes.unshift(last);
      parts.pop();
      continue;
    }
    if (/^[TP]$/i.test(last)) {
      parts.pop();
      continue;
    }
    break;
  }
  return codes.length > 0 ? codes.join(' ') : undefined;
}

/** Parse cell text locally (avoids circular import with timetableParserService). */
export function parseCellLinesToSlotRef(
  lines: string[],
  day: string,
  startTime: string,
  endTime: string,
): GridSlotRef | null {
  const normalized = normalizeCellLines(lines.filter(Boolean).join('\n'));
  if (normalized.length === 0) return null;

  let courseName = '';
  for (const line of normalized) {
    const m = line.match(COURSE_CODE_RE);
    if (m) {
      const candidate = line.trim();
      if (candidate.length > courseName.length) courseName = candidate;
    }
  }
  if (!courseName) {
    for (const line of normalized) {
      const t = line.trim();
      if (!t || lineHasHall(t) || lineHasLecturer(t) || isOrphanMetaLine(t)) continue;
      if (/^[A-Z]{2,6}-\d{4,5}/i.test(t)) {
        courseName = t;
        break;
      }
    }
  }
  if (!courseName) return null;

  const fromCourse = extractLecturerFromCourseLine(
    normalized.find((l) => COURSE_CODE_RE.test(l)) || courseName,
  );
  const lecturerName = extractLecturerFromLines(normalized) || fromCourse;
  const hallName = extractHallFromLines(normalized) || 'TBD';

  return {
    dayOfWeek: day,
    startTime,
    endTime,
    courseName: courseName.replace(/\s+/g, ' ').trim(),
    hallName,
    lecturerName,
  };
}

/** Extract every class slot from a stored FET grid (richest source for hall/lecturer). */
export function extractSlotRefsFromGridSnapshot(grid: TimetableGridSnapshot): GridSlotRef[] {
  const refs: GridSlotRef[] = [];
  const dayCols = grid.dayColumns ?? [];
  const timeRows = grid.timeRows ?? [];

  for (let di = 0; di < dayCols.length; di++) {
    const day = dayCols[di]?.day;
    if (!day) continue;

    for (let ti = 0; ti < timeRows.length; ti++) {
      const cell = grid.cells?.[ti]?.[di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;

      const { startTime, endTime } = slotBoundsFromCell(cell, timeRows, ti);
      if (!startTime || !endTime) continue;

      const lineSources = [
        ...(cell.displayLines ?? []),
        ...(cell.lines ?? []),
        ...(cell.rawText?.trim() ? normalizeCellLines(cell.rawText) : []),
      ];
      const parsed = parseCellLinesToSlotRef(lineSources, day, startTime, endTime);
      if (parsed) {
        refs.push({
          ...parsed,
          hallIsShared: cell.sharedHall === true || parsed.hallIsShared === true,
        });
      }
    }
  }

  return refs;
}

function slotKey(s: GridSlotRef): string {
  return `${s.dayOfWeek}|${s.startTime}|${s.endTime}`;
}

/** Prefer grid lines, then DB slot; fill missing lecturer/hall on each. */
export function mergeSlotRefSources(gridRefs: GridSlotRef[], dbRefs: GridSlotRef[]): GridSlotRef[] {
  const byKey = new Map<string, GridSlotRef>();

  for (const s of dbRefs) {
    byKey.set(slotKey(s), { ...s });
  }
  for (const g of gridRefs) {
    const key = slotKey(g);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, { ...g });
      continue;
    }
    byKey.set(key, {
      ...prev,
      courseName: g.courseName.length > prev.courseName.length ? g.courseName : prev.courseName,
      hallName:
        (prev.hallName === 'TBD' || !prev.hallName) && g.hallName && g.hallName !== 'TBD'
          ? g.hallName
          : prev.hallName || g.hallName,
      lecturerName: prev.lecturerName || g.lecturerName,
      hallIsShared: g.hallIsShared === true || prev.hallIsShared === true,
    });
  }

  return [...byKey.values()];
}

export type EnrichGridOptions = {
  lecturerDisplay?: LecturerDisplayIndex;
};

/** Fill missing hall/lecturer/course text from master slots; preserve Excel lines when richer. */
export function enrichGridFromSlots(
  grid: TimetableGridSnapshot,
  slots: GridSlotRef[],
  opts?: EnrichGridOptions,
): TimetableGridSnapshot {
  const dayCols = grid.dayColumns ?? [];
  const timeRows = grid.timeRows ?? [];
  if (!dayCols.length || !timeRows.length) return grid;

  const mergedSlots = mergeSlotRefSources(extractSlotRefsFromGridSnapshot(grid), slots);
  const slotByKey = new Map(mergedSlots.map((s) => [slotKey(s), s]));

  const cells = (grid.cells ?? []).map((row) => (row ?? []).map((cell) => ({ ...cell })));

  for (let di = 0; di < dayCols.length; di++) {
    const day = dayCols[di]?.day;
    if (!day) continue;

    for (let ti = 0; ti < timeRows.length; ti++) {
      const cell = cells[ti]?.[di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;

      const { startTime, endTime, startTi, endTi } = slotBoundsFromCell(cell, timeRows, ti);
      if (!startTime || !endTime) continue;

      const key = `${day}|${startTime}|${endTime}`;
      const slot = slotByKey.get(key);

      const lineSources = dedupeFetLines([
        ...(cell.displayLines ?? []),
        ...(cell.lines ?? []),
        ...(cell.rawText?.trim() ? normalizeCellLines(cell.rawText) : []),
      ]);
      const fromCell = parseCellLinesToSlotRef(lineSources, day, startTime, endTime);
      const ref: GridSlotRef = slot
        ? {
            ...slot,
            courseName: slot.courseName || fromCell?.courseName || '',
            hallName: slot.hallName && slot.hallName !== 'TBD' ? slot.hallName : fromCell?.hallName || slot.hallName,
            lecturerName: slot.lecturerName || fromCell?.lecturerName,
            hallIsShared: slot.hallIsShared === true || fromCell?.hallIsShared === true,
          }
        : fromCell || {
            dayOfWeek: day,
            startTime,
            endTime,
            courseName: lineSources.join(' '),
            hallName: 'TBD',
          };

      const merged = mergeFetDisplayLines(
        lineSources,
        slotToFetDisplayLines(ref, opts?.lecturerDisplay),
        opts?.lecturerDisplay,
      );
      if (merged.length === 0) continue;

      const updated = cellFromRaw(merged.join('\n'));
      updated.rowSpan = endTi - startTi + 1;
      updated.slotStart = cell.slotStart ?? startTime;
      updated.slotEnd = cell.slotEnd ?? endTime;
      updated.sharedHall =
        cell.sharedHall === true || ref.hallIsShared === true || slot?.hallIsShared === true;
      updated.isEmpty = false;
      cells[startTi][di] = updated;
      for (let k = startTi + 1; k <= endTi; k++) {
        cells[k][di] = {
          ...cellFromRaw(''),
          mergeContinue: true,
          isEmpty: true,
          displayLines: [],
          lines: [],
          rowSpan: 1,
        };
      }
    }
  }

  stitchPostBreakContinuations(cells, timeRows.length);
  return { ...grid, cells };
}

/** Align merged row spans only; does not rewrite cell text. */
export function alignGridRowSpansOnly(
  grid: TimetableGridSnapshot,
  slots: GridSlotRef[],
): TimetableGridSnapshot {
  const dayCols = grid.dayColumns ?? [];
  const timeRows = grid.timeRows ?? [];
  if (!dayCols.length || !timeRows.length) return grid;

  const cells = (grid.cells ?? []).map((row) =>
    (row ?? []).map((cell) => ({
      ...cell,
      mergeContinue: false,
      rowSpan: 1,
    })),
  );

  for (let di = 0; di < dayCols.length; di++) {
    const day = dayCols[di]?.day;
    if (!day) continue;
    for (const slot of slots.filter((s) => s.dayOfWeek === day)) {
      const span = timeRowSpanForSlot(timeRows, slot.startTime, slot.endTime);
      if (!span) continue;
      const { startTi, endTi } = span;
      const existing = cells[startTi][di];
      if (!existing || existing.isEmpty || existing.isBreak) continue;

      existing.rowSpan = endTi - startTi + 1;
      for (let ti = startTi + 1; ti <= endTi; ti++) {
        cells[ti][di] = {
          ...cells[ti][di],
          mergeContinue: true,
          isEmpty: true,
          displayLines: [],
          lines: [],
          rowSpan: 1,
        };
      }
    }
  }

  stitchPostBreakContinuations(cells, timeRows.length);
  return { ...grid, cells };
}

/** Rewrite class cells from slot refs (avoids re-merging bloated displayLines). */
export function rewriteGridCellsFromSlotRefs(
  grid: TimetableGridSnapshot,
  slots: GridSlotRef[],
  opts?: EnrichGridOptions,
): TimetableGridSnapshot {
  const aligned = alignGridRowSpansOnly(grid, slots);
  const dayCols = aligned.dayColumns ?? [];
  const timeRows = aligned.timeRows ?? [];
  const cells = (aligned.cells ?? []).map((row) => (row ?? []).map((cell) => ({ ...cell })));
  const slotByKey = new Map(slots.map((s) => [slotKey(s), s]));

  for (let di = 0; di < dayCols.length; di++) {
    const day = dayCols[di]?.day;
    if (!day) continue;
    for (let ti = 0; ti < timeRows.length; ti++) {
      const cell = cells[ti]?.[di];
      if (!cell || cell.isEmpty || cell.isBreak || cell.mergeContinue) continue;
      const span = Math.max(1, cell.rowSpan ?? 1);
      const endTi = Math.min(ti + span - 1, timeRows.length - 1);
      const startTime = timeRows[ti]?.start;
      const endTime = timeRows[endTi]?.end;
      if (!startTime || !endTime) continue;
      const slot = slotByKey.get(`${day}|${startTime}|${endTime}`);
      if (!slot) continue;
      const lines = mergeFetDisplayLines(
        [],
        slotToFetDisplayLines(slot, opts?.lecturerDisplay),
        opts?.lecturerDisplay,
      );
      const updated = cellFromRaw(lines.join('\n'));
      updated.rowSpan = span;
      updated.isOnline = cell.isOnline;
      updated.slotStart = cell.slotStart;
      updated.slotEnd = cell.slotEnd;
      updated.sharedHall = cell.sharedHall === true || slot.hallIsShared === true;
      cells[ti][di] = updated;
    }
  }

  for (let ti = 0; ti < cells.length; ti++) {
    for (let di = 0; di < (cells[ti]?.length ?? 0); di++) {
      const cell = cells[ti]?.[di];
      if (!cell) continue;
      const rawLen = (cell.rawText ?? '').length;
      const lineCount = (cell.displayLines ?? []).length;
      if (cell.isEmpty || cell.mergeContinue) {
        cells[ti][di] = {
          ...cell,
          rawText: '',
          displayLines: [],
          lines: [],
        };
      } else if (rawLen > 2000 || lineCount > 8) {
        const day = dayCols[di]?.day;
        const startTime = timeRows[ti]?.start;
        const endTi = Math.min(ti + Math.max(1, cell.rowSpan ?? 1) - 1, timeRows.length - 1);
        const endTime = timeRows[endTi]?.end;
        const slot = day && startTime && endTime ? slotByKey.get(`${day}|${startTime}|${endTime}`) : undefined;
        if (slot) {
          const lines = mergeFetDisplayLines(
            [],
            slotToFetDisplayLines(slot, opts?.lecturerDisplay),
            opts?.lecturerDisplay,
          );
          const updated = cellFromRaw(lines.join('\n'));
          updated.rowSpan = cell.rowSpan;
          updated.isOnline = cell.isOnline;
          updated.slotStart = cell.slotStart;
          updated.slotEnd = cell.slotEnd;
          updated.sharedHall = cell.sharedHall === true || slot.hallIsShared === true;
          cells[ti][di] = updated;
        } else {
          cells[ti][di] = {
            ...cellFromRaw(''),
            isEmpty: true,
            mergeContinue: false,
            rowSpan: 1,
          };
        }
      }
    }
  }

  return { ...aligned, cells };
}

/** Align rowSpans and enrich from slots (read-time / small grids only). */
export function alignGridRowSpansToSlots(
  grid: TimetableGridSnapshot,
  slots: GridSlotRef[],
  opts?: EnrichGridOptions,
): TimetableGridSnapshot {
  return enrichGridFromSlots(alignGridRowSpansOnly(grid, slots), slots, opts);
}

function minutesBetween(endTime: string, startTime: string): number {
  const [eh, em] = endTime.split(':').map(Number);
  const [sh, sm] = startTime.split(':').map(Number);
  return sh * 60 + sm - (eh * 60 + em);
}

/** Merge consecutive rows in the same day that repeat the same class text (Excel fill without !merges). */
export function coalesceDuplicateBandCells(grid: TimetableGridSnapshot): TimetableGridSnapshot {
  const cells = grid.cells ?? [];
  const timeRows = grid.timeRows ?? [];
  const rowCount = cells.length;
  const colCount = cells[0]?.length ?? 0;

  for (let di = 0; di < colCount; di++) {
    for (let ti = 0; ti < rowCount; ti++) {
      const cell = cells[ti]?.[di];
      if (!cell || cell.mergeContinue || cell.isEmpty || cell.isBreak) continue;
      const key = (cell.displayLines ?? []).join('\n').trim().toLowerCase();
      if (!key) continue;

      let endTi = ti;
      while (endTi + 1 < rowCount) {
        const next = cells[endTi + 1][di];
        if (!next || next.isBreak) break;
        const nextKey = (next.displayLines ?? []).join('\n').trim().toLowerCase();
        if (nextKey !== key) break;
        const endTime = timeRows[endTi]?.end;
        const nextStart = timeRows[endTi + 1]?.start;
        if (endTime && nextStart && minutesBetween(endTime, nextStart) > 15) break;
        endTi++;
      }
      if (endTi === ti) continue;

      cell.rowSpan = endTi - ti + 1;
      for (let k = ti + 1; k <= endTi; k++) {
        cells[k][di] = {
          ...cellFromRaw(''),
          mergeContinue: true,
          isEmpty: true,
          displayLines: [],
          lines: [],
          rowSpan: 1,
        };
      }
      ti = endTi;
    }
  }

  return { ...grid, cells };
}

/** Ensure tables from the client have required fields before save/import. */
export function normalizeGridSnapshot(table: TimetableGridSnapshot): TimetableGridSnapshot {
  const groupName = (table.groupName || table.tableTitle || 'UNKNOWN').trim();
  const enrollment = parseEnrollmentFromGroupName(groupName);
  const normalized: TimetableGridSnapshot = {
    ...table,
    tableTitle: (table.tableTitle || groupName).trim(),
    groupName,
    programCode: table.programCode || enrollment.programCode,
    studyYear: table.studyYear || enrollment.studyYear,
    pathwayCode: table.pathwayCode ?? enrollment.pathwayCode,
    year: table.year ?? 2026,
    month: table.month ?? 1,
    week: table.week ?? 1,
    semester: table.semester ?? 1,
    dayColumns: table.dayColumns ?? [],
    timeRows: table.timeRows ?? [],
    cells: (table.cells ?? []).map((row) =>
      (row ?? []).map((cell) => {
        const lineSource = [
          ...(cell?.displayLines ?? []),
          ...(cell?.lines ?? []),
        ]
          .map((l) => String(l).trim())
          .filter(Boolean);
        const sourceText = (cell?.rawText?.trim() || lineSource.join('\n') || '').trim();
        const displayLines = sourceText ? normalizeCellLines(sourceText) : [];
        return {
          rawText: cell?.rawText?.trim() || sourceText,
          lines: displayLines,
          displayLines,
          isEmpty: cell?.isEmpty ?? displayLines.length === 0,
          isBreak: cell?.isBreak ?? false,
          isOnline: cell?.isOnline ?? /\bonline\b/i.test(cell?.rawText ?? ''),
          rowSpan: cell?.rowSpan ?? 1,
          mergeContinue: cell?.mergeContinue ?? false,
          slotStart: cell?.slotStart,
          slotEnd: cell?.slotEnd,
          sharedHall: cell?.sharedHall === true,
        };
      }),
    ),
  };
  applyRowSpanMerges(normalized.cells);
  stitchPostBreakContinuations(normalized.cells, normalized.cells.length);
  return normalized;
}

/** Build import rows from stored grids (used when confirm payload is too large for JSON). */
export function gridSnapshotsToParsedRows(tables: TimetableGridSnapshot[]): ParsedTimetableRow[] {
  const rows: ParsedTimetableRow[] = [];
  for (const rawTable of tables) {
    const table = normalizeGridSnapshot(rawTable);
    const groupName = table.groupName;
    for (let di = 0; di < table.dayColumns.length; di++) {
      const day = table.dayColumns[di]?.day;
      if (!day) continue;
      for (let ti = 0; ti < table.timeRows.length; ti++) {
        const cell = table.cells[ti]?.[di];
        if (!cell || cell.mergeContinue || cell.isEmpty || cell.isBreak) continue;
        const lines = cellLines(cell);
        const course = extractCourseFromLines(lines);
        if (!course?.code) continue;
        const { startTime, endTime } = slotBoundsFromCell(cell, table.timeRows, ti);
        if (!startTime || !endTime) continue;
        rows.push({
          year: table.year,
          month: table.month,
          week: table.week,
          dayOfWeek: day,
          startTime,
          endTime,
          courseCode: String(course.code).replace(/\s+/g, '-').toUpperCase().slice(0, 40),
          courseName: course.name || course.code,
          lecturerEmail: '',
          lecturerName: extractLecturerFromLines(lines),
          hallName: extractHallFromLines(lines) || 'TBD',
          groupName,
          semester: table.semester ?? 1,
          sharedHall: cell.sharedHall === true,
        });
      }
    }
  }
  return rows;
}

const DEFAULT_DAY_COLUMNS: { day: string; label: string }[] = [
  { day: 'MONDAY', label: 'Monday' },
  { day: 'TUESDAY', label: 'Tuesday' },
  { day: 'WEDNESDAY', label: 'Wednesday' },
  { day: 'THURSDAY', label: 'Thursday' },
  { day: 'FRIDAY', label: 'Friday' },
  { day: 'SATURDAY', label: 'Saturday' },
  { day: 'SUNDAY', label: 'Sunday' },
];

const DEFAULT_TIME_ROWS: { label: string; start: string; end: string }[] = [
  { label: '08:00 - 08:55', start: '08:00', end: '08:55' },
  { label: '09:00 - 09:55', start: '09:00', end: '09:55' },
  { label: '10:00 - 10:55', start: '10:00', end: '10:55' },
  { label: '11:00 - 11:55', start: '11:00', end: '11:55' },
  { label: '12:00 - 12:55', start: '12:00', end: '12:55' },
  { label: '13:00 - 13:55', start: '13:00', end: '13:55' },
  { label: '14:00 - 14:55', start: '14:00', end: '14:55' },
  { label: '15:00 - 15:55', start: '15:00', end: '15:55' },
  { label: '16:00 - 16:55', start: '16:00', end: '16:55' },
  { label: '17:00 - 17:55', start: '17:00', end: '17:55' },
];

/** Build an empty FET-style grid for a new batch table. */
export function createEmptyBatchGrid(params: {
  tableTitle: string;
  groupName: string;
  year: number;
  month: number;
  week: number;
  semester?: number;
  dayColumns?: { day: string; label: string }[];
  timeRows?: { label: string; start: string; end: string }[];
}): TimetableGridSnapshot {
  const enrollment = parseEnrollmentFromGroupName(params.groupName);
  const dayColumns = params.dayColumns ?? DEFAULT_DAY_COLUMNS;
  const timeRows = params.timeRows ?? DEFAULT_TIME_ROWS;
  const empty = cellFromRaw('');
  const cells = timeRows.map(() => dayColumns.map(() => ({ ...empty })));
  return normalizeGridSnapshot({
    tableTitle: params.tableTitle.trim(),
    groupName: params.groupName.trim(),
    programCode: enrollment.programCode,
    studyYear: enrollment.studyYear,
    pathwayCode: enrollment.pathwayCode,
    year: params.year,
    month: params.month,
    week: params.week,
    semester: params.semester ?? 1,
    dayColumns,
    timeRows,
    cells,
  });
}
