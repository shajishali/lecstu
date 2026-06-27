/**
 * Timetable Parser Service
 * Parses CSV, Excel (.xlsx/.xls), and PDF timetable files with flexible column detection.
 * Supports various header formats (dayOfWeek/day/Day, courseCode/course, etc.)
 *
 * TECHNOLOGY NOTE (no ML): PDF parsing uses pdf-parse (PDF.js) — rule-based text/table
 * extraction. No machine learning models are used for timetable import.
 */
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import { PDFParse } from 'pdf-parse';
import * as XLSX from 'xlsx';
import {
  PROGRAMS,
  buildGroupName,
  resolveCanonicalGroupName,
  resolveCanonicalGroupNames,
  type StudyYear,
} from '../config/fct-faculty-config';
import {
  extractFetLecturerCodesFromCourse,
  isFetActivitySuffix,
  isFetLecturerCodeToken,
} from './lecturerInitialsMatch';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import { buildFetGridSnapshot } from './timetableGridBuilder';

const DAY_ALIASES: Record<string, string> = {
  monday: 'MONDAY', mon: 'MONDAY',
  tuesday: 'TUESDAY', tue: 'TUESDAY',
  wednesday: 'WEDNESDAY', wed: 'WEDNESDAY',
  thursday: 'THURSDAY', thu: 'THURSDAY',
  friday: 'FRIDAY', fri: 'FRIDAY',
  saturday: 'SATURDAY', sat: 'SATURDAY',
  sunday: 'SUNDAY', sun: 'SUNDAY',
};
const VALID_DAYS = new Set(Object.values(DAY_ALIASES));
const TIME_RE = /^\d{1,2}:\d{2}$/;

// Regex for single-cell rows: "2026 March Week 1 Tuesday (03/03/2026) 08:30 10:30 Course Lecturer Hall-1 CS-AI-2020"
const SINGLE_CELL_ROW_RE =
  /^(\d{4})\s+(\w+)\s+Week\s+(\d+)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*\([^)]+\)\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})\s+(.+)\s+(Hall-\d+)\s+([A-Za-z]+-[A-Za-z0-9]+-\d{4}(-\d{4})?)$/;

// Column header mappings (case-insensitive)
// Order matters: "day" must come before "week" so "dayOfWeek" maps to day, not week
const COLUMN_MAP: Record<string, string[]> = {
  year: ['year', 'yr'],
  month: ['month', 'mo', 'mnth'],
  day: ['dayofweek', 'day', 'days', 'weekday'],
  week: ['week', 'wk', 'weeknumber', 'week_number'],
  startTime: ['starttime', 'start', 'start_time', 'from', 'begintime'],
  endTime: ['endtime', 'end', 'end_time', 'to', 'finishtime'],
  time: ['time', 'timeslot', 'slot', 'period', 'duration'],
  lecturerName: ['lecturername', 'lecturer_name', 'instructorname', 'teachername'],
  courseCode: ['coursecode', 'course', 'course_code', 'subject', 'module', 'subjectcode'],
  courseName: ['coursename', 'course_name', 'subjectname', 'subject_name', 'modulename', 'module_name'],
  lecturerEmail: ['lectureremail', 'lecturer', 'lecturer_email', 'teacher', 'instructor', 'email'],
  hallName: ['hallname', 'hall', 'hall_name', 'room', 'venue', 'location'],
  groupName: ['groupname', 'group', 'group_name', 'batch', 'class', 'section'],
  semester: ['semester', 'sem'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '');
}

function mapHeaderToField(header: string): string | null {
  const n = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.some((a) => n.includes(a) || a.includes(n))) return field;
  }
  return null;
}

function parseTime(s: string): string | null {
  const t = s?.trim();
  if (!t) return null;
  const ampm = t.match(/^(\d{1,2})[.:](\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    if (ampm[3].toUpperCase() === 'PM' && h < 12) h += 12;
    if (ampm[3].toUpperCase() === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const m = t.match(/^(\d{1,2})[.:](\d{2})(?::\d{2})?$/);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  if (TIME_RE.test(t)) return t;
  return null;
}

/** Parse FET-style time range "08:00 - 08:55" or "09:00 - 09.55" (may have trailing cell text) */
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

const FET_PATHWAY_CODES = [...new Set(PROGRAMS.flatMap((p) => p.pathways.map((pw) => pw.code)))];
const FET_PATHWAY_HEADER_RE = new RegExp(
  `^Y[1-4]\\s+(${FET_PATHWAY_CODES.join('|')})\\b`,
  'i',
);

/** Normalize FET section header to canonical group name when possible (CS-Y3-AINT, …) */
function normalizeFetGroupHeader(line: string): string {
  const trimmed = line.trim();
  const canonical = resolveCanonicalGroupNames(trimmed);
  if (canonical.length === 1) return canonical[0];
  return trimmed;
}

/**
 * One Excel tab / PDF section = one student batch. Keep every row on that batch;
 * do not split cells that mention "Y3 AINT, Y3 SPCS" into separate groups.
 */
function normalizeImportGroupNames(rows: ParsedTimetableRow[]): ParsedTimetableRow[] {
  return rows.map((r) => {
    const groupName = (r.groupName || '').trim();
    if (!groupName) return r;
    const canonical = resolveCanonicalGroupName(groupName);
    return canonical ? { ...r, groupName: canonical } : { ...r, groupName };
  });
}

/** @deprecated Use normalizeImportGroupNames — kept as alias for callers */
function expandMultiGroupRows(rows: ParsedTimetableRow[]): ParsedTimetableRow[] {
  return normalizeImportGroupNames(rows);
}

/** Group for imported slot: sheet/section batch wins (read the table as-is). */
function importGroupName(sectionGroup: string, _cellLines?: string[]): string {
  if (sectionGroup.trim()) return normalizeFetGroupHeader(sectionGroup);
  return '';
}

function extractSemesterFromText(text: string): number | undefined {
  if (/sem(?:ester)?[\s_-]*ii(?:[\s_.-]|$)/i.test(text)) return 2;
  if (/sem(?:ester)?[\s_-]*i(?:[\s_.-]|$)/i.test(text)) return 1;
  return undefined;
}

/** First line of a FET block is often "08:00 - 08:55\tcell..." or "10:00 - 10:55 Y3 CS" */
function contentLinesFromFetBlock(block: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < block.length; i++) {
    const line = block[i];
    if (i === 0) {
      const m = line.match(/^(\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2})\s*(.*)$/);
      if (m) {
        const rest = m[2].trim();
        if (rest) out.push(rest);
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

function parseDay(s: string): string | null {
  const d = s?.trim().toLowerCase();
  if (!d) return null;
  // Exact match or first 3 chars (e.g. "tue" from "tuesday")
  let full = DAY_ALIASES[d] ?? DAY_ALIASES[d.slice(0, 3)];
  // Extract day from "Tuesday (03/03/2026)" or "Tuesday, 3 March" etc.
  if (!full) {
    const dayMatch = d.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
    if (dayMatch) full = DAY_ALIASES[dayMatch[1]];
  }
  return full && VALID_DAYS.has(full) ? full : null;
}

function parseIntSafe(s: string, min: number, max: number, def: number): number {
  const n = parseInt(s?.trim() || '', 10);
  if (isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

const MONTH_NAMES: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

function parseMonth(s: string): number | null {
  const t = (s?.trim() || '').toLowerCase();
  if (!t) return null;
  const n = parseInt(t, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  return MONTH_NAMES[t] ?? null;
}

export interface ParsedTimetableRow {
  year: number;
  month: number;
  week: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  lecturerEmail: string;
  lecturerName?: string; // Used when email unknown (e.g. single-cell PDF parse)
  hallName: string;
  groupName: string;
  semester?: number;
  /** Admin-only: skip hall double-booking across batches */
  sharedHall?: boolean;
}

export interface ParseResult {
  rows: ParsedTimetableRow[];
  tables?: TimetableGridSnapshot[];
  errors: { row: number; message: string }[];
  headersDetected: Record<string, string>;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Short FET-style label for grids and course records (e.g. CSCI 12542 T) */
export function formatShortCourseDisplay(courseName: string, courseCode: string): string {
  const n = courseName.trim();
  const codeSpaced = courseCode.replace(/-/g, ' ');
  if (!n) return codeSpaced;
  if (/^[A-Z]{2,6}(\s+\d{4,5})+(\s+[A-Za-z][A-Za-z0-9_]*)*$/i.test(n) && n.length <= 64) return n;
  if (n.length <= 36) return n;
  return codeSpaced;
}

/** Max gap between FET period bands (e.g. 08:55 → 10:00) to still merge into one lecture */
export const FET_SLOT_GAP_MINUTES = 90;

function normalizeCourseKey(code: string): string {
  return code.replace(/[\s-]+/g, '').toUpperCase();
}

/** FET PDF cells: initials (K.P.) or 1–2 letter lecturer codes (P, T, KP). */
export function isLecturerInitials(name: string | undefined): boolean {
  return isFetLecturerCodeToken(name || '');
}

function slotMergeKey(r: ParsedTimetableRow, ignoreLecturer = false): string {
  const lecturerPart =
    ignoreLecturer || isLecturerInitials(r.lecturerName)
      ? ''
      : (r.lecturerName || r.lecturerEmail || '').toLowerCase();
  const group = (r.groupName || 'UNKNOWN').toUpperCase();
  const hall = (r.hallName || 'TBD').toUpperCase();
  const courseKey = normalizeCourseKey(r.courseCode || '');
  return [
    group,
    r.dayOfWeek || '',
    courseKey,
    lecturerPart,
    hall === 'TBD' ? '' : hall,
    String(r.year),
    String(r.month),
    String(r.semester ?? 1),
  ].join('|');
}

function fetSlotsMergeable(current: ParsedTimetableRow, row: ParsedTimetableRow): boolean {
  const gap = timeToMinutes(row.startTime) - timeToMinutes(current.endTime);
  if (gap < 0 || gap > FET_SLOT_GAP_MINUTES) return false;
  const keyA = slotMergeKey(current, true);
  const keyB = slotMergeKey(row, true);
  return keyA === keyB;
}

function mergeSlotMetadata(current: ParsedTimetableRow, row: ParsedTimetableRow): ParsedTimetableRow {
  const curHall = (current.hallName || 'TBD').toUpperCase();
  const rowHall = (row.hallName || 'TBD').toUpperCase();
  const hall =
    curHall === 'TBD' && rowHall !== 'TBD'
      ? row.hallName || 'TBD'
      : current.hallName || 'TBD';
  const lecturerName =
    isLecturerInitials(current.lecturerName) && row.lecturerName && !isLecturerInitials(row.lecturerName)
      ? row.lecturerName
      : current.lecturerName || row.lecturerName;
  return {
    ...current,
    endTime: row.endTime,
    hallName: hall,
    lecturerName,
    lecturerEmail: current.lecturerEmail || row.lecturerEmail,
    sharedHall: current.sharedHall === true || row.sharedHall === true,
  };
}

/** Merge back-to-back FET slots for the same class into 2h / 3h blocks */
export function mergeConsecutiveSlots(rows: ParsedTimetableRow[]): ParsedTimetableRow[] {
  if (rows.length === 0) return rows;

  const sorted = [...rows].sort((a, b) => {
    const g = a.groupName.localeCompare(b.groupName);
    if (g) return g;
    const d = a.dayOfWeek.localeCompare(b.dayOfWeek);
    if (d) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  const merged: ParsedTimetableRow[] = [];
  let current: ParsedTimetableRow | null = null;

  for (const row of sorted) {
    if (!current) {
      current = { ...row };
      continue;
    }
    const tightGap =
      slotMergeKey(current) === slotMergeKey(row) &&
      timeToMinutes(row.startTime) >= timeToMinutes(current.endTime) &&
      timeToMinutes(row.startTime) - timeToMinutes(current.endTime) <= 15;

    if (tightGap || fetSlotsMergeable(current, row)) {
      current = mergeSlotMetadata(current, row);
    } else {
      merged.push(current);
      current = { ...row };
    }
  }
  if (current) merged.push(current);
  return merged;
}

function dedupeParsedRows(rows: ParsedTimetableRow[]): ParsedTimetableRow[] {
  const seen = new Set<string>();
  const out: ParsedTimetableRow[] = [];
  for (const r of rows) {
    const key = [
      (r.groupName || '').toUpperCase(),
      r.dayOfWeek,
      r.startTime,
      r.endTime,
      normalizeCourseKey(r.courseCode || ''),
      (r.hallName || '').toUpperCase(),
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function finalizeParsedRows(rows: ParsedTimetableRow[]): ParsedTimetableRow[] {
  return mergeConsecutiveSlots(dedupeParsedRows(rows)).map((r) => ({
    ...r,
    courseName: formatShortCourseDisplay(r.courseName, r.courseCode),
  }));
}

function finalizeParseResult(result: ParseResult): ParseResult {
  return {
    ...result,
    rows: finalizeParsedRows(result.rows),
    tables: result.tables ?? [],
  };
}

function combineParseResults(parts: ParseResult[], headersDetected: Record<string, unknown>): ParseResult {
  const rows: ParsedTimetableRow[] = [];
  const tables: TimetableGridSnapshot[] = [];
  const errors: ParseResult['errors'] = [];
  for (const part of parts) {
    rows.push(...part.rows);
    tables.push(...(part.tables ?? []));
    errors.push(...part.errors);
  }
  return finalizeParseResult({
    rows,
    tables,
    errors,
    headersDetected: {
      ...headersDetected,
      format: typeof headersDetected.format === 'string' ? headersDetected.format : 'Excel multi-sheet',
    },
  });
}

/** Use sheet tab name as group when it matches FET batch labels (CS-Y3-AINT, Y3 AINT, …). */
function groupHintFromSheetName(sheetName: string): string {
  const t = sheetName.trim();
  if (!t || /^sheet\d*$/i.test(t)) return '';
  const canonical = resolveCanonicalGroupName(t);
  if (canonical) return canonical;
  const normalized = resolveCanonicalGroupName(t.replace(/[_]+/g, ' '));
  if (normalized) return normalized;
  const progYearPath = t.match(/^(CS|ET|CT|BS|FT)[\s_-]*Y([1-4])[\s_-]+([A-Z0-9]{2,8})$/i);
  if (progYearPath) {
    const hinted = `${progYearPath[1].toUpperCase()}-Y${progYearPath[2]}-${progYearPath[3].toUpperCase()}`;
    const canonical = resolveCanonicalGroupName(hinted);
    if (canonical) return canonical;
  }
  return '';
}

function sheetHasStructuredTemplate(records: Record<string, string>[]): boolean {
  if (records.length === 0) return false;
  const headerMap: Record<string, string> = {};
  for (const h of Object.keys(records[0] || {})) {
    const field = mapHeaderToField(h);
    if (field) headerMap[field] = h;
  }
  return Boolean(
    headerMap.day &&
      headerMap.courseCode &&
      headerMap.hallName &&
      headerMap.groupName &&
      (headerMap.startTime || headerMap.time),
  );
}

function sheetLooksLikeFetGrid(lines: string[]): boolean {
  if (lines.length < 4) return false;
  const hasTime = lines.some((l) => isFetTimeLine(l));
  const hasDays = lines.some((l) => /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/i.test(l.trim()));
  const hasGroup = lines.some((l) => isFetGroupHeader(l.trim()));
  return hasTime && (hasDays || hasGroup);
}

/** Convert Excel cell values (numbers, dates) to display strings for parsing */
function excelCellToString(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    if (value > 0 && value < 1) {
      const mins = Math.round(value * 24 * 60);
      return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    }
    return String(value);
  }
  return String(value).trim();
}

function parseTimeCell(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return parseTime(t) ?? parseTimeRange(t)?.start ?? null;
}

function parseStructuredRows(rows: Record<string, string>[], format: string): ParseResult {
  if (rows.length === 0) {
    return { rows: [], tables: [], errors: [{ row: 1, message: `${format} file has no data rows` }], headersDetected: {} };
  }

  const rawHeaders = Object.keys(rows[0] || {});
  const headerMap: Record<string, string> = {};
  for (const h of rawHeaders) {
    const field = mapHeaderToField(h);
    if (field) headerMap[field] = h;
  }

  const result: ParseResult = {
    rows: [],
    tables: [],
    errors: [],
    headersDetected: { ...headerMap, format },
  };

  const yearCol = headerMap.year;
  const monthCol = headerMap.month;
  const weekCol = headerMap.week;
  const dayCol = headerMap.day;
  const startCol = headerMap.startTime;
  const endCol = headerMap.endTime;
  const timeCol = headerMap.time;
  const courseCol = headerMap.courseCode;
  const courseNameCol = headerMap.courseName;
  const lecturerEmailCol = headerMap.lecturerEmail;
  const lecturerNameCol = headerMap.lecturerName;
  const lecturerCol =
    lecturerEmailCol ||
    (headerMap.lecturer && !lecturerNameCol ? headerMap.lecturer : undefined);
  const hallCol = headerMap.hallName;
  const groupCol = headerMap.groupName;

  const missing: string[] = [];
  if (!dayCol) missing.push('day');
  if (!startCol && !timeCol) missing.push('startTime or time');
  if (!endCol && !timeCol) missing.push('endTime or time');
  if (!courseCol) missing.push('course');
  if (!hallCol) missing.push('hall');
  if (!groupCol) missing.push('group');
  if (missing.length > 0) {
    result.errors.push({
      row: 1,
      message: `Missing columns: ${missing.join(', ')}. Detected: ${rawHeaders.join(', ')}`,
    });
    return result;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;

    if (!Object.values(r).some((v) => (v ?? '').trim())) continue;

    const day = parseDay(r[dayCol] ?? '');
    if (!day) {
      result.errors.push({ row: rowNum, message: `Invalid day "${r[dayCol]}"` });
      continue;
    }

    let startTime = startCol ? parseTimeCell(r[startCol] ?? '') : null;
    let endTime = endCol ? parseTimeCell(r[endCol] ?? '') : null;
    if (timeCol) {
      const range = parseTimeRange(r[timeCol] ?? '');
      if (range) {
        startTime = range.start;
        endTime = range.end;
      }
    }
    if (!startTime) {
      result.errors.push({ row: rowNum, message: `Invalid start time (expected HH:mm)` });
      continue;
    }
    if (!endTime) {
      result.errors.push({ row: rowNum, message: `Invalid end time (expected HH:mm)` });
      continue;
    }
    if (startTime >= endTime) {
      result.errors.push({ row: rowNum, message: 'startTime must be before endTime' });
      continue;
    }

    const courseCode = (r[courseCol] ?? '').trim();
    const courseName = courseNameCol ? (r[courseNameCol] ?? '').trim() : '';
    const hallName = (r[hallCol] ?? '').trim();
    const groupName = (r[groupCol] ?? '').trim();

    if (!courseCode) {
      result.errors.push({ row: rowNum, message: 'Course is required' });
      continue;
    }
    if (!hallName) {
      result.errors.push({ row: rowNum, message: 'Hall is required' });
      continue;
    }
    if (!groupName) {
      result.errors.push({ row: rowNum, message: 'Group is required' });
      continue;
    }

    const lecturerRaw = lecturerCol ? (r[lecturerCol] ?? '').trim() : '';
    const lecturerNameRaw = lecturerNameCol ? (r[lecturerNameCol] ?? '').trim() : '';
    const lecturerEmail = lecturerRaw.includes('@') ? lecturerRaw.toLowerCase() : '';
    const lecturerName =
      lecturerNameRaw || (lecturerRaw && !lecturerEmail ? lecturerRaw : undefined);

    const semesterCol = headerMap.semester ? r[headerMap.semester] : '';
    const yearVal = yearCol ? parseIntSafe(r[yearCol] ?? '', 2000, 2100, 2026) : 2026;
    const monthParsed = monthCol ? parseMonth(r[monthCol] ?? '') : null;
    const monthVal = monthParsed ?? (monthCol ? parseIntSafe(r[monthCol] ?? '', 1, 12, 1) : 1);
    const weekVal = weekCol ? parseIntSafe(r[weekCol] ?? '', 1, 53, 1) : 1;

    result.rows.push({
      year: yearVal,
      month: monthVal,
      week: weekVal,
      dayOfWeek: day,
      startTime,
      endTime,
      courseCode: courseCode.toUpperCase(),
      courseName: courseName || courseCode,
      lecturerEmail,
      lecturerName,
      hallName,
      groupName,
      semester: semesterCol ? parseInt(semesterCol, 10) : 1,
    });
  }

  return finalizeParseResult(result);
}

/** Propagate top-left merged cell values across merge ranges (FET grids span multiple rows). */
function sheetToMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];
  const merges = sheet['!merges'];
  if (!merges?.length) return matrix;

  for (const m of merges) {
    const master = matrix[m.s.r]?.[m.s.c];
    if (master == null || master === '') continue;
    for (let r = m.s.r; r <= m.e.r; r++) {
      if (!matrix[r]) matrix[r] = [];
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r === m.s.r && c === m.s.c) continue;
        const existing = matrix[r][c];
        if (existing == null || existing === '') matrix[r][c] = master;
      }
    }
  }
  return matrix;
}

function sheetToRecords(sheet: XLSX.WorkSheet): Record<string, string>[] {
  const matrix = sheetToMatrix(sheet);

  if (matrix.length === 0) return [];

  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const headers = matrix[i].map((c) => excelCellToString(c));
    const hasDay = headers.some((h) => mapHeaderToField(h) === 'day');
    const hasCourse = headers.some((h) => {
      const f = mapHeaderToField(h);
      return f === 'courseCode' || f === 'courseName';
    });
    if (hasDay && hasCourse) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = matrix[headerRowIdx].map((c) => excelCellToString(c));
  const records: Record<string, string>[] = [];

  for (let ri = headerRowIdx + 1; ri < matrix.length; ri++) {
    const row = matrix[ri];
    const record: Record<string, string> = {};
    let nonEmpty = false;
    headers.forEach((h, ci) => {
      if (!h) return;
      const val = excelCellToString(row[ci]);
      if (val) nonEmpty = true;
      record[h] = val;
    });
    if (nonEmpty) records.push(record);
  }

  return records;
}

function timeRangeFromMatrixRow(matrix: unknown[][], rowIdx: number): { start: string; end: string } | null {
  for (let c = 0; c < 3; c++) {
    const cell = excelCellToString(matrix[rowIdx]?.[c] ?? '');
    const range = parseTimeRange(cell);
    if (range) return range;
  }
  return null;
}

/**
 * FET multi-hour blocks: column A has one label per hour (08:00, 09:00, 10:00…).
 * Merged class cells leave column A empty on continuation rows — use earliest start and latest end.
 */
function timeSpanFromMatrixRows(
  matrix: unknown[][],
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

/**
 * If the merge top row has no time label (Excel puts time on the row above the merged block),
 * include preceding hour rows while that day column is still empty.
 */
function expandMergeStartRow(
  matrix: unknown[][],
  mergeStart: number,
  col: number,
  headerRow: number,
): number {
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

function findFetGroupInMatrix(matrix: unknown[][]): string {
  for (let r = 0; r < matrix.length; r++) {
    for (const cell of matrix[r] ?? []) {
      const s = excelCellToString(cell).trim();
      if (!s) continue;
      if (isFetGroupHeader(s)) return normalizeFetGroupHeader(s);
      const canonical = resolveCanonicalGroupName(s);
      if (canonical) return canonical;
    }
  }
  return '';
}

interface FetSectionAnchor {
  startRow: number;
  group: string;
}

/** Locate each FET batch block (one sheet may contain many stacked timetables). */
function findFetSectionAnchors(matrix: unknown[][], sheetGroupHint: string): FetSectionAnchor[] {
  const anchors: FetSectionAnchor[] = [];
  const seenGroups = new Set<string>();

  for (let r = 0; r < matrix.length; r++) {
    // Data rows have a time range in column A; batch labels inside day cells must not start a new section.
    if (timeRangeFromMatrixRow(matrix, r)) continue;

    const rowCells = matrix[r] ?? [];
    let dayHeaderHits = 0;
    for (const cell of rowCells) {
      if (parseDay(excelCellToString(cell))) dayHeaderHits++;
    }
    if (dayHeaderHits >= 3) continue;

    // Section titles (e.g. "Y4 SWST") sit in the first columns — never in Thu/Fri class cells.
    for (let c = 0; c <= 2; c++) {
      const s = excelCellToString(rowCells[c] ?? '').trim();
      if (!s) continue;

      let group = '';
      if (isFetGroupHeader(s)) {
        group = normalizeFetGroupHeader(s);
      } else {
        const canonical = resolveCanonicalGroupName(s);
        if (canonical && /^(CS|ET|CT|BS)-Y\d/i.test(canonical)) {
          group = canonical;
        } else if (FET_PATHWAY_HEADER_RE.test(s)) {
          group = normalizeFetGroupHeader(s);
        }
      }

      if (!group) continue;
      const key = `${r}|${group}`;
      if (seenGroups.has(key)) continue;
      seenGroups.add(key);
      anchors.push({ startRow: r, group });
      break;
    }
  }

  if (anchors.length === 0 && sheetGroupHint) {
    anchors.push({ startRow: 0, group: sheetGroupHint });
  }

  return anchors;
}

function findFetDayColumns(matrix: unknown[][]): { headerRow: number; dayCols: { col: number; day: string }[] } {
  return findFetDayColumnsInRange(matrix, 0, matrix.length - 1);
}

function findFetDayColumnsInRange(
  matrix: unknown[][],
  startRow: number,
  endRow: number,
): { headerRow: number; dayCols: { col: number; day: string }[] } {
  const from = Math.max(0, startRow);
  const to = Math.min(matrix.length - 1, endRow);
  for (let r = from; r <= Math.min(from + 25, to); r++) {
    const row = (matrix[r] ?? []).map((c) => excelCellToString(c));
    const dayCols: { col: number; day: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const day = parseDay(row[c]);
      if (day) dayCols.push({ col: c, day });
    }
    if (dayCols.length >= 3) return { headerRow: r, dayCols };
  }
  return { headerRow: -1, dayCols: [] };
}

/** Flat rows for one FET grid section (supports merged cells for 2h/3h/4h spans). */
function parseFetMatrixSection(
  matrix: unknown[][],
  merges: XLSX.Range[],
  startRow: number,
  endRow: number,
  group: string,
  period: { year: number; month: number; week: number; semester?: number },
): ParsedTimetableRow[] {
  const { headerRow, dayCols } = findFetDayColumnsInRange(matrix, startRow, endRow);
  if (headerRow < 0 || !group.trim()) return [];

  const consumed = new Set<string>();
  const out: ParsedTimetableRow[] = [];

  const emitSlot = (r0: number, r1: number, col: number, day: string, cellText: string): boolean => {
    const span = timeSpanFromMatrixRows(matrix, r0, r1);
    if (!span) return false;

    const courses = extractAllFetCourses(cellText);
    if (courses.length === 0) return false;

    const lines = cellText.split(/\n|[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    const parsed = parseFetCellContent(lines.length ? lines : [cellText]);
    const hallName = parsed?.hallName ?? 'TBD';
    const lecturerName = parsed?.lecturerName;

    for (const course of courses) {
      out.push({
        year: period.year,
        month: period.month,
        week: period.week,
        dayOfWeek: day,
        startTime: span.start,
        endTime: span.end,
        courseCode: course.replace(/\s+/g, '-').toUpperCase().slice(0, 40),
        courseName: course,
        lecturerEmail: '',
        lecturerName,
        hallName,
        groupName: group,
        semester: period.semester ?? 1,
      });
    }
    return true;
  };

  for (const m of merges) {
    if (m.e.r < startRow || m.s.r > endRow) continue;
    const dayCol = dayCols.find((d) => d.col >= m.s.c && d.col <= m.e.c);
    if (!dayCol) continue;
    if (m.s.r <= headerRow) continue;

    const col = dayCol.col;
    const parts: string[] = [];
    for (let r = m.s.r; r <= m.e.r; r++) {
      const v = excelCellToString(matrix[r]?.[col] ?? '').trim();
      if (!isFetEmptyCell(v)) parts.push(v);
    }
    if (!parts.length) continue;

    const r0 = expandMergeStartRow(matrix, m.s.r, col, headerRow);
    if (!emitSlot(r0, m.e.r, col, dayCol.day, parts.join('\n'))) continue;
    for (let r = r0; r <= m.e.r; r++) consumed.add(`${r},${col}`);
  }

  for (let r = headerRow + 1; r <= endRow; r++) {
    const timeRange = timeRangeFromMatrixRow(matrix, r);
    if (!timeRange) continue;

    for (const dc of dayCols) {
      const key = `${r},${dc.col}`;
      if (consumed.has(key)) continue;
      const v = excelCellToString(matrix[r]?.[dc.col] ?? '').trim();
      if (isFetEmptyCell(v)) continue;

      if (emitSlot(r, r, dc.col, dc.day, v)) consumed.add(key);
    }
  }

  return out;
}

/**
 * Parse FET Excel grids using merged cells for true 2h/3h/4h spans (column A = times).
 * One sheet may contain multiple stacked batch tables — each is parsed with its own group.
 */
function parseExcelFetGridSheet(sheet: XLSX.WorkSheet, sheetName: string, fileHint: string): ParseResult {
  const matrix = sheetToMatrix(sheet);
  const textLines = matrix
    .map((row) => (row ?? []).map((c) => excelCellToString(c)).join('\t'))
    .filter((l) => l.trim());
  const period = extractFetGenerationPeriod(textLines, fileHint);
  const sheetGroupHint = groupHintFromSheetName(sheetName);
  const anchors = findFetSectionAnchors(matrix, sheetGroupHint);
  const merges = sheet['!merges'] ?? [];
  const out: ParsedTimetableRow[] = [];
  const tables: TimetableGridSnapshot[] = [];
  const groupsParsed: string[] = [];

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i]!;
    const endRow = i + 1 < anchors.length ? anchors[i + 1]!.startRow - 1 : matrix.length - 1;
    const sectionRows = parseFetMatrixSection(
      matrix,
      merges,
      anchor.startRow,
      endRow,
      anchor.group,
      period,
    );
    const grid = buildFetGridSnapshot(
      matrix,
      merges,
      anchor.startRow,
      endRow,
      anchor.group,
      period,
      anchor.startRow,
    );
    if (grid) tables.push(grid);
    if (sectionRows.length > 0) {
      out.push(...sectionRows);
      groupsParsed.push(anchor.group);
    }
  }

  return {
    rows: out,
    tables,
    errors: [],
    headersDetected: {
      format: 'Excel FET merge grid',
      sheet: sheetName,
      sections: String(anchors.length),
      groups: groupsParsed.join(', '),
    },
  };
}

/** Collect slots from every sheet/section, merge into one flat table, then normalize. */
function mergeWorkbookFetTables(
  workbook: XLSX.WorkBook,
  fileName: string,
): {
  rows: ParsedTimetableRow[];
  tables: TimetableGridSnapshot[];
  sheetStats: { name: string; rows: number; sections: number }[];
  skippedSheets: number;
} {
  const mergedRows: ParsedTimetableRow[] = [];
  const mergedTables: TimetableGridSnapshot[] = [];
  const sheetStats: { name: string; rows: number; sections: number }[] = [];
  let skippedSheets = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      skippedSheets++;
      continue;
    }

    const records = sheetToRecords(sheet);
    if (sheetHasStructuredTemplate(records)) {
      const structured = parseStructuredRows(records, `Excel:${sheetName}`);
      if (structured.rows.length > 0) {
        mergedRows.push(...structured.rows);
        sheetStats.push({ name: sheetName, rows: structured.rows.length, sections: 1 });
        continue;
      }
    }

    const grid = parseExcelFetGridSheet(sheet, sheetName, `${fileName}#${sheetName}`);
    if (grid.rows.length > 0 || (grid.tables?.length ?? 0) > 0) {
      mergedRows.push(...grid.rows);
      mergedTables.push(...(grid.tables ?? []));
      const sections = parseInt(grid.headersDetected.sections || '1', 10) || 1;
      sheetStats.push({ name: sheetName, rows: grid.rows.length, sections });
      continue;
    }

    const lines = excelSheetToFetLines(sheet);
    if (!sheetLooksLikeFetGrid(lines)) {
      skippedSheets++;
      continue;
    }

    const groupHint = groupHintFromSheetName(sheetName);
    const fet = parsePdfFetLineLayout(lines, `${fileName}#${sheetName}`, {
      initialGroup: groupHint || undefined,
    });

    if (fet.rows.length > 0) {
      mergedRows.push(...fet.rows);
      sheetStats.push({ name: sheetName, rows: fet.rows.length, sections: 1 });
    } else {
      skippedSheets++;
    }
  }

  return { rows: mergedRows, tables: mergedTables, sheetStats, skippedSheets };
}

/** Turn an Excel sheet into tab-separated lines (FET grid layout, like PDF text export). */
function excelSheetToFetLines(sheet: XLSX.WorkSheet): string[] {
  const matrix = sheetToMatrix(sheet);

  const lines: string[] = [];
  for (const row of matrix) {
    let parts = row.map((c) => {
      const s = excelCellToString(c);
      if (/^-{1,3}$/i.test(s) || s.toLowerCase() === 'x') return '';
      return s;
    });
    while (parts.length > 0 && !parts[0].trim()) parts = parts.slice(1);
    if (!parts.some((p) => p.trim())) continue;
    let line = parts.join('\t');
    if (line.includes('---')) {
      line = line
        .split(/\s*---\s*/)
        .map((p) => p.trim())
        .join('\t');
    }
    lines.push(line);
  }
  return lines;
}

export function buildTimetableImportTemplate(): Buffer {
  const headers = [
    'Year',
    'Month',
    'Week',
    'Day',
    'Start Time',
    'End Time',
    'Course Code',
    'Course Name',
    'Lecturer',
    'Hall',
    'Group',
    'Semester',
  ];
  const example = [
    2026,
    'January',
    1,
    'Monday',
    '08:00',
    '08:55',
    'CSCI 12542 T',
    'Intro to Programming',
    'Dr. Silva',
    'AB-LCH-09-1',
    'CS-Y3-AINT',
    2,
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 14 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

export async function parseExcel(buffer: Buffer, fileName = ''): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames.length) {
    return { rows: [], tables: [], errors: [{ row: 1, message: 'Excel workbook has no sheets' }], headersDetected: {} };
  }

  // Step 1: merge all batch tables (29 sheets and/or stacked blocks on one tab) into one flat dataset
  const { rows: mergedRows, tables: mergedTables, sheetStats, skippedSheets } =
    mergeWorkbookFetTables(workbook, fileName);
  const tablesMerged = sheetStats.reduce((n, s) => n + s.sections, 0);

  if (mergedRows.length > 0 || mergedTables.length > 0) {
    return finalizeParseResult({
      rows: normalizeImportGroupNames(mergedRows),
      tables: mergedTables,
      errors: [],
      headersDetected: {
        format: 'Excel merged timetables',
        fileName,
        tablesMerged: String(tablesMerged),
        sheetsProcessed: String(sheetStats.length),
        sheetsSkipped: String(skippedSheets),
        totalSlots: String(mergedRows.length),
        totalTables: String(mergedTables.length),
        sheetStats: JSON.stringify(sheetStats),
      },
    });
  }

  return {
    rows: [],
    tables: [],
    errors: [
      {
        row: 1,
        message:
          `No timetable data found in ${workbook.SheetNames.length} sheet(s). Each tab should be one batch FET grid (time in column A, Mon–Sat across), or use the Download Excel template with one row per class.`,
      },
    ],
    headersDetected: {
      sheetsTotal: String(workbook.SheetNames.length),
      sheetsSkipped: String(skippedSheets),
    },
  };
}

export async function parseCsv(buffer: Buffer): Promise<ParseResult> {
  const rows: Record<string, string>[] = [];
  const stream = Readable.from(buffer.toString());

  await new Promise<void>((resolve, reject) => {
    stream
      .pipe(csvParser({ mapHeaders: ({ header }: { header: string }) => header.trim() }))
      .on('data', (row: Record<string, string>) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  if (rows.length === 0) {
    return { rows: [], tables: [], errors: [{ row: 1, message: 'CSV file is empty' }], headersDetected: {} };
  }

  return parseStructuredRows(rows, 'CSV');
}

/** Route upload by extension / mime */
export async function parseTimetableFile(buffer: Buffer, fileName = ''): Promise<ParseResult> {
  const name = fileName.toLowerCase();
  if (name.endsWith('.pdf')) return parsePdf(buffer, fileName);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return parseExcel(buffer, fileName);
  return parseCsv(buffer);
}

/** Time slot patterns from "Day 8-10 AM 10-12 PM 1-3 PM 3-5 PM" style headers */
const GRID_TIME_SLOTS = [
  { re: /8-10\s*AM?/i, start: '08:00', end: '10:00' },
  { re: /10-12\s*(AM|PM)?/i, start: '10:00', end: '12:00' },
  { re: /1-3\s*PM?/i, start: '13:00', end: '15:00' },
  { re: /3-5\s*PM?/i, start: '15:00', end: '17:00' },
  { re: /9-11\s*AM?/i, start: '09:00', end: '11:00' },
  { re: /11-1\s*PM?/i, start: '11:00', end: '13:00' },
  { re: /2-4\s*PM?/i, start: '14:00', end: '16:00' },
];

const FET_DAY_COLUMNS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const DEFAULT_FET_PERIOD = { year: 2026, month: 1, week: 1, semester: 1 as number | undefined };

/** Read year/month from FET footer e.g. "Timetable generated with FET ... on 5/1/26" (D/M/Y). */
function extractFetGenerationPeriod(
  rawLines: string[],
  fileHint = '',
): { year: number; month: number; week: number; semester: number | undefined } {
  const hintSemester = extractSemesterFromText(fileHint);
  for (const line of rawLines) {
    const m = line.match(
      /(?:Timetable generated with FET[\s\S]*?)?\bon\s+(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i
    );
    if (!m) continue;

    const first = parseInt(m[1], 10);
    const second = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;

    let month: number;
    if (first > 12) {
      month = second;
    } else if (second > 12) {
      month = first;
    } else {
      month = second; // D/M/Y (e.g. 5/1/26 → January)
    }

    return {
      year,
      month: Math.max(1, Math.min(12, month)),
      week: 1,
      semester: extractSemesterFromText(line) ?? hintSemester ?? 1,
    };
  }
  return { ...DEFAULT_FET_PERIOD, semester: hintSemester ?? 1 };
}

/** Skip cell content that indicates empty slot */
function isFetEmptyCell(s: string): boolean {
  const t = (s || '').trim().toLowerCase();
  if (!t) return true;
  if (t === '---' || t === '--' || t === '-x-' || t === '-X-' || t === 'x') return true;
  return false;
}

/** Year/batch label inside a cell (e.g. "Y1 CS", "Y1 ET, Y1 CT") — not a course */
function isFetYearLabel(s: string): boolean {
  const t = (s || '').trim();
  if (!t) return false;
  // Lines that contain a course code (e.g. "Y3 AINT, Y3 SPCS CSCI 32073 VR_LAB MB") are
  // mixed group-label+course lines, not pure year labels — never filter them out.
  if (/[A-Z]{2,6}\s*\d{4,5}/.test(t)) return false;
  if (/^Y\d+\s*,\s*Y\d+/i.test(t)) return true;
  if (/^Y\d+(\s*,\s*Y\d+\s+\w+)+$/i.test(t)) return true;
  if (/^Y\d+\s+(CS|ET|CT|BST|BS|GANI|SWST|CTNT|CSEC|SPCS)(\s+Group)?$/i.test(t)) return true;
  if (/^Y\d+\s+\w+,\s*Y\d+/i.test(t)) return true;
  return /^Y\d+\s+\w+$/i.test(t);
}

const FET_COURSE_LAB_SUFFIX_RE = /^(VR_LAB|NETWORK_LAB|[A-Z]{2,6}_LAB)$/i;

const FET_COURSE_CHUNK_RE =
  /[A-Z]{2,6}\s*\d{4,5}(?:\s*[TtPp](?:\s*[TtPp])?)?(?:\s+(?:VR_LAB|NETWORK_LAB|[A-Z]{2,6}_LAB))?/gi;

function trimFetCourseChunk(chunk: string): string {
  const parts = chunk.trim().split(/\s+/);
  while (parts.length > 1) {
    const last = parts[parts.length - 1]!;
    if (FET_COURSE_LAB_SUFFIX_RE.test(last)) break;
    if (isFetLecturerCodeToken(last)) {
      parts.pop();
      continue;
    }
    break;
  }
  return parts.join(' ');
}

/** Extract course code from FET cell (e.g. "CTEC 12223 P", "AINT 32012 T", combined modules) */
function extractFetCourse(s: string): string | null {
  const all = extractAllFetCourses(s);
  return all[0] ?? null;
}

/** All modules in a cell (handles "DSCI 32012 + SWST 32033 P" or "DSCI 32012+SWST 32033 P"). */
function extractAllFetCourses(s: string): string[] {
  if (!s) return [];
  // Normalize: replace line-breaks with spaces, and "+" joining two course codes with " + "
  // so "GANI 32024+CSCI 32062" becomes "GANI 32024 + CSCI 32062" and both match the regex.
  const t = s
    .trim()
    .replace(/[\r\n]+/g, ' ')
    .replace(/([A-Z]{2,6}\s*\d{4,5}[^\s]*)\+([A-Z]{2,6})/gi, '$1 + $2')
    .replace(/\s+/g, ' ');

  if (!t || isFetEmptyCell(t) || isFetYearLabel(t)) return [];

  const found: string[] = [];
  for (const m of t.matchAll(FET_COURSE_CHUNK_RE)) {
    const chunk = trimFetCourseChunk(m[0].replace(/\s+/g, ' ').trim());
    if (chunk && !found.includes(chunk)) found.push(chunk);
  }
  return found;
}

/** Extract room/hall from FET cell - pattern like AB-LCH-07-1, LB-CMP-01-1, AB-SCALE-08-01 */
function extractFetRoom(s: string): string | null {
  const t = (s || '').trim();
  if (!t || isFetEmptyCell(t)) return null;
  const m = t.match(/\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+|[A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2})\b/);
  if (m) return m[1];
  if (/language\s+lab/i.test(t)) return t;
  if (/^LB-/i.test(t)) return t.split(',')[0].trim();
  return null;
}

const FET_TIME_IN_LINE_RE = /^\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}/;

function fetLineTimePart(line: string): string {
  const parts = line.split('\t').map((p) => p.trim());
  for (const p of parts) {
    if (FET_TIME_IN_LINE_RE.test(p)) return p;
  }
  return parts[0] || line.trim();
}

function isFetTimeLine(line: string): boolean {
  const t = line.trim();
  if (FET_TIME_IN_LINE_RE.test(t)) return true;
  return line.split('\t').some((p) => FET_TIME_IN_LINE_RE.test(p.trim()));
}

function isFetGroupHeader(line: string): boolean {
  const t = line.trim();
  // A line that also contains a course code is a data cell, not a section header.
  // e.g. "Y3 AINT, Y3 SPCS CSCI 32073 VR_LAB MB" must NOT switch currentGroup.
  if (/[A-Z]{2,6}\s*\d{4,5}/.test(t)) return false;
  if (/^Y\d+\s+.+Group$/i.test(t)) return true;
  if (/^Y\d+\s+.+,\s*Y\d+/i.test(t)) return true;
  if (FET_PATHWAY_HEADER_RE.test(t)) return true;
  if (/^Y\d+\s+(CS|ET|CT|BST|BS)\s*$/i.test(t)) return true;
  return false;
}

function isFetBlockEnd(line: string): boolean {
  return (
    isFetTimeLine(line) ||
    isFetGroupHeader(line) ||
    /^Timetable generated with FET/i.test(line) ||
    /^Faculty of Computing/i.test(line) ||
    /^--\s*\d+\s+of\s+\d+\s*--/i.test(line)
  );
}

function isFetCellComplete(cellLines: string[]): boolean {
  const useful = cellLines.filter((l) => !isFetYearLabel(l) && !isFetEmptyCell(l));
  const joined = useful.join(' ');
  return !!extractFetCourse(joined) && !!extractFetRoom(joined);
}

/** Pull lecturer initials from the end of a course line (e.g. "ETIA 44423 T SB" → SB). */
function extractTrailingLecturerCodes(courseLine: string): string[] {
  const codes: string[] = [];
  const parts = courseLine.trim().split(/\s+/);
  while (parts.length > 2) {
    const last = parts[parts.length - 1]!;
    if (isFetLecturerCodeToken(last)) {
      codes.unshift(last);
      parts.pop();
      continue;
    }
    break;
  }
  return codes;
}

/** FET course title as shown in Excel (keeps AUTOMATION_LAB, SCALE_UP, T/P suffix). */
function fetCourseTitleLine(rawLine: string): string {
  let t = rawLine.trim();
  t = t.replace(/^Y\d+\s+(?:ET|CT|CS|BS)(?:\s*,\s*Y\d+\s+(?:ET|CT|CS|BS))*\s*,?\s*/gi, '').trim();
  const codes = extractTrailingLecturerCodes(t);
  for (const c of codes) {
    const re = new RegExp(`\\s+${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');
    t = t.replace(re, '').trim();
  }
  while (/\s+\S+\s*$/i.test(t)) {
    const last = t.split(/\s+/).pop() ?? '';
    if (!isFetActivitySuffix(last)) break;
    t = t.replace(/\s+\S+\s*$/i, '').trim();
  }
  return t || extractFetCourse(rawLine) || rawLine.trim();
}

/** Parse one FET timetable cell into course, lecturer code(s), and hall. */
export function parseFetCellContent(cellLines: string[]): {
  courseCode: string;
  courseName: string;
  lecturerName?: string;
  hallName: string;
} | null {
  const useful = cellLines.filter((l) => !isFetYearLabel(l) && !isFetEmptyCell(l));
  if (useful.length === 0) return null;

  const courseLine =
    useful.find((l) => /[A-Z]{2,6}\s*\d{4,5}/.test(l) && !extractFetRoom(l)) || '';
  let course = courseLine ? fetCourseTitleLine(courseLine) : null;
  if (!course) {
    const courseText = useful
      .filter((l) => !extractFetRoom(l) && !isFetYearLabel(l))
      .join(' ')
      .replace(/\s+/g, ' ');
    course = extractFetCourse(courseText);
  }
  if (!course) {
    for (const l of useful) {
      if (/[A-Z]{2,6}\s*\d{4,5}/.test(l)) {
        course = fetCourseTitleLine(l) || extractFetCourse(l);
        if (course) break;
      }
    }
  }
  if (!course) return null;

  let hall: string | null = null;
  for (const l of useful) {
    hall = extractFetRoom(l);
    if (hall) break;
  }

  const lecturerCodes: string[] = [];
  if (courseLine) lecturerCodes.push(...extractTrailingLecturerCodes(courseLine));
  for (const l of useful) {
    const t = l.trim();
    if (extractFetCourse(t) || extractFetRoom(t) || isFetYearLabel(t)) continue;
    if (/online$/i.test(t)) continue;
    if (isFetLecturerCodeToken(t)) lecturerCodes.push(t);
    else if (/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i.test(t)) lecturerCodes.push(t);
    else if (/^[A-Za-z][A-Za-z+,.&\s]{1,24}$/.test(t) && !/\d/.test(t)) lecturerCodes.push(t);
  }
  const uniqueLect = [...new Set(lecturerCodes.map((c) => c.trim()).filter(Boolean))];
  const lecturerName = uniqueLect.length > 0 ? uniqueLect.join(' ') : undefined;

  return {
    courseCode: course.replace(/\s+/g, '-').toUpperCase().slice(0, 40),
    courseName: course,
    lecturerName,
    hallName: hall || 'TBD',
  };
}

function parseFetTimeBlock(
  timeRange: { start: string; end: string },
  block: string[],
  currentGroup: string,
  period: { year: number; month: number; week: number; semester?: number },
  out: ParsedTimetableRow[]
): void {
  let dayIdx = 0;
  let cellLines: string[] = [];

  const emitCell = () => {
    if (dayIdx >= FET_DAY_COLUMNS.length) {
      cellLines = [];
      return;
    }
    if (cellLines.length > 0) {
      const parsed = parseFetCellContent(cellLines);
      if (parsed) {
        const groupName = importGroupName(currentGroup, cellLines);
        if (!groupName) return;
        out.push({
          year: period.year,
          month: period.month,
          week: period.week,
          dayOfWeek: FET_DAY_COLUMNS[dayIdx],
          startTime: timeRange.start,
          endTime: timeRange.end,
          courseCode: parsed.courseCode,
          courseName: parsed.courseName,
          lecturerEmail: '',
          lecturerName: parsed.lecturerName,
          hallName: parsed.hallName,
          groupName,
          semester: period.semester ?? 1,
        });
      }
    }
    cellLines = [];
    dayIdx++;
  };

  const processTabParts = (parts: string[]) => {
    for (const part of parts) {
      if (dayIdx >= FET_DAY_COLUMNS.length) break;
      if (isFetEmptyCell(part)) {
        if (cellLines.length > 0) emitCell();
        else dayIdx++;
        continue;
      }
      if (cellLines.length > 0) emitCell();
      cellLines = [part];
      if (isFetCellComplete(cellLines)) emitCell();
    }
  };

  const contentLines = contentLinesFromFetBlock(block);
  const firstParts = contentLines[0]?.split('\t').map((p) => p.trim()) ?? [];
  processTabParts(firstParts.length > 1 ? firstParts.slice(1) : firstParts);

  for (let bi = 1; bi < contentLines.length; bi++) {
    const parts = contentLines[bi].split('\t').map((p) => p.trim());
    if (parts.length === 1) {
      const text = parts[0];
      if (isFetEmptyCell(text)) continue;
      if (cellLines.length === 0) cellLines = [text];
      else cellLines.push(text);
      if (isFetCellComplete(cellLines)) emitCell();
    } else {
      processTabParts(parts);
    }
  }

  if (cellLines.length > 0) emitCell();
}

/**
 * Parse FET PDFs where getText() yields tab-separated day columns and multi-line cells.
 * Each activity spans several lines: optional year label, course, lecturer initials, room.
 */
function parsePdfFetLineLayout(
  rawLines: string[],
  fileHint = '',
  options?: { initialGroup?: string },
): ParseResult {
  const result: ParseResult = { rows: [], tables: [], errors: [], headersDetected: { format: 'FET line' } };
  const period = extractFetGenerationPeriod(rawLines, fileHint);
  let currentGroup = options?.initialGroup
    ? normalizeFetGroupHeader(options.initialGroup)
    : '';
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i].trim();

    if (/^Faculty of Computing/i.test(line)) {
      i++;
      continue;
    }

    if (isFetGroupHeader(line)) {
      currentGroup = normalizeFetGroupHeader(line);
      i++;
      continue;
    }

    if (!currentGroup || !isFetTimeLine(line)) {
      i++;
      continue;
    }

    const timePart = fetLineTimePart(line);
    const timeRange = parseTimeRange(timePart);
    if (!timeRange) {
      i++;
      continue;
    }

    const block: string[] = [line];
    i++;
    while (i < rawLines.length && !isFetBlockEnd(rawLines[i])) {
      block.push(rawLines[i]);
      i++;
    }

    parseFetTimeBlock(timeRange, block, currentGroup, period, result.rows);
  }

  result.rows = finalizeParsedRows(expandMultiGroupRows(result.rows));
  return result;
}

/** Parse FET-style grid PDF: first column = time, columns 1-6 = Mon-Sat. May have 3 rows per slot (course, lecturer, room). */
function parsePdfFetLayout(rows: string[][], period = DEFAULT_FET_PERIOD): ParseResult {
  const result: ParseResult = { rows: [], tables: [], errors: [], headersDetected: { format: 'FET grid' } };
  let currentGroup = '';

  for (let i = 0; i < rows.length; i++) {
    // Skip header rows (Mon, Tue, etc.)
    const firstCell = (rows[i]?.[0] || '').trim().toLowerCase();
    if (i === 0 && /^(mon|tue|wed|thu|fri|sat|sun|day)/.test(firstCell)) continue;
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const first = (r[0] || '').trim();

    if (isFetGroupHeader(first)) {
      currentGroup = normalizeFetGroupHeader(first);
      continue;
    }

    if (r.length < 2) continue;

    const timeRange = parseTimeRange(first);
    if (!timeRange) continue;

    if (!currentGroup) continue;

    // Collect course, lecturer, room from this row and optionally next 2 rows (for 3-row layout)
    const nextRow = rows[i + 1];
    const nextNextRow = rows[i + 2];

    for (let col = 1; col <= Math.min(6, r.length); col++) {
      const day = FET_DAY_COLUMNS[col - 1];
      let cell = (r[col] || '').trim();
      if (isFetEmptyCell(cell)) continue;

      // If next rows have same column count, they may be lecturer/room for this slot
      let lecturerCell = '';
      let roomCell = '';
      if (nextRow && nextRow.length >= col && !parseTimeRange((nextRow[0] || '').trim())) {
        lecturerCell = (nextRow[col] || '').trim();
      }
      if (nextNextRow && nextNextRow.length >= col && !parseTimeRange((nextNextRow[0] || '').trim())) {
        roomCell = (nextNextRow[col] || '').trim();
      }

      const parts = cell.split(/\s*\|\s*|\n/).map((p) => p.trim()).filter(Boolean);
      let courseCode = extractFetCourse(parts[0] || cell);
      let hallName = extractFetRoom(roomCell || parts[2] || parts[1] || cell) || extractFetRoom(cell);

      if (!courseCode) courseCode = extractFetCourse(cell);
      if (!courseCode) continue;

      if (!hallName) hallName = extractFetRoom(roomCell) || extractFetRoom(lecturerCell);
      for (const p of parts) {
        if (!hallName) hallName = extractFetRoom(p);
        if (hallName) break;
      }
      if (!hallName) hallName = 'TBD';

      const cellLines = [cell, lecturerCell, roomCell].filter((x) => x.trim());
      const groupName = importGroupName(currentGroup, cellLines);
      if (!groupName) continue;

      const lecturerName =
        lecturerCell && isFetLecturerCodeToken(lecturerCell) ? lecturerCell.trim() : undefined;

      result.rows.push({
        year: period.year,
        month: period.month,
        week: period.week,
        dayOfWeek: day,
        startTime: timeRange.start,
        endTime: timeRange.end,
        courseCode: courseCode.replace(/\s+/g, '-').toUpperCase().slice(0, 40),
        courseName: courseCode,
        lecturerEmail: '',
        lecturerName,
        hallName,
        groupName,
        semester: period.semester ?? 1,
      });
    }
  }

  result.rows = finalizeParsedRows(normalizeImportGroupNames(result.rows));
  return result;
}

function parseGridTimeSlots(dayHeader: string): { start: string; end: string }[] {
  const slots: { start: string; end: string }[] = [];
  for (const { re, start, end } of GRID_TIME_SLOTS) {
    if (re.test(dayHeader)) slots.push({ start, end });
  }
  if (slots.length === 0) {
    slots.push({ start: '08:00', end: '10:00' }, { start: '10:00', end: '12:00' }, { start: '13:00', end: '15:00' }, { start: '15:00', end: '17:00' });
  }
  return slots;
}

function isLecturerLine(s: string): boolean {
  return /^(?:Dr\.|Prof\.|Snr\.\s*Prof\.|Mr\.|Ms\.)\s+.+$/i.test(s.trim());
}

function isHallLine(s: string): boolean {
  const t = s.trim().toLowerCase();
  return /^(room|auditorium|lab|hall)\s+\w+/i.test(t) || /^(room|aud)\s*\d+/i.test(t) || /^lab\s*\d$/i.test(t);
}

/**
 * Parse grid-style PDF: Batch header, Day header with time slots, then for each day:
 * day name, then 4× (course, lecturer, room) per time slot.
 */
function parsePdfGridLayout(lines: string[]): ParsedTimetableRow[] {
  const out: ParsedTimetableRow[] = [];
  const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  let i = 0;
  let currentGroup = '';
  let timeSlots: { start: string; end: string }[] = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^Batch:\s*(.+)$/i.test(trimmed)) {
      currentGroup = trimmed.replace(/^Batch:\s*/i, '').trim();
      i++;
      continue;
    }

    if (/^Day\s+.+$/i.test(trimmed) && /\d+\s*-\s*\d+/i.test(trimmed)) {
      timeSlots = parseGridTimeSlots(trimmed);
      i++;
      continue;
    }

    const day = parseDay(trimmed);
    if (day && DAYS.includes(day) && currentGroup && timeSlots.length > 0) {
      i++;
      for (let slotIdx = 0; slotIdx < timeSlots.length; slotIdx++) {
        const courseLine = lines[i];
        const lecturerLine = lines[i + 1];
        const hallLine = lines[i + 2];
        i += 3;

        if (!courseLine || !lecturerLine || !hallLine) break;

        const course = courseLine.trim();
        const lecturer = lecturerLine.trim();
        const hall = hallLine.trim();

        if (!course || course === '--' || course.startsWith('--')) continue;
        if (parseDay(course)) continue;
        if (!isLecturerLine(lecturerLine)) continue;
        if (!hall || hall === '--') continue;

        const slot = timeSlots[slotIdx];
        if (!slot) continue;

        const code = course.replace(/\s+/g, '-').toUpperCase().slice(0, 30);
        out.push({
          year: 2026,
          month: 1,
          week: 1,
          dayOfWeek: day,
          startTime: slot.start,
          endTime: slot.end,
          courseCode: code || 'UNKNOWN',
          courseName: course || 'Unknown',
          lecturerEmail: '',
          lecturerName: lecturer || undefined,
          hallName: hall,
          groupName: currentGroup,
          semester: 1,
        });
      }
      continue;
    }

    i++;
  }

  return out;
}

/**
 * Extract text/tables from PDF and parse as timetable.
 * Uses pdf-parse: getTable() for structured tables, getText() as fallback.
 * Supports grid-style "Batch: X / Day 8-10 AM ... / Monday / course / lecturer / room" layout.
 */
export async function parsePdf(buffer: Buffer, fileName = ''): Promise<ParseResult> {
  const builtIn = await parsePdfBuiltIn(buffer, fileName);

  const { parsePdfWithExtractService } = await import('./timetableExtractClient');
  const advanced = await parsePdfWithExtractService(buffer, fileName);
  if (
    advanced &&
    (advanced.rows.length >= Math.max(15, Math.floor(builtIn.rows.length * 0.7)) ||
      (builtIn.rows.length === 0 && advanced.rows.length > 0))
  ) {
    return advanced;
  }
  return builtIn;
}

export async function parsePdfBuiltIn(buffer: Buffer, fileName = ''): Promise<ParseResult> {
  const parser = new PDFParse({ data: buffer });
  let rows: string[][] = [];
  let rawLines: string[] = [];

  try {
    // 1. Try getTable() first — best for PDFs with clear table structure
    const tableResult = await parser.getTable();
    if (tableResult?.mergedTables?.length) {
      for (const table of tableResult.mergedTables) {
        if (Array.isArray(table) && table.length > 0) {
          rows.push(...table.map((row) => (Array.isArray(row) ? row.map(String) : [String(row)])));
        }
      }
    }

    // 2. Fallback: getText() for grid-style or table-like layout
    const textResult = await parser.getText({
      cellSeparator: '\t',
      cellThreshold: 5,
    });
    const text = (textResult as { text?: string })?.text || '';
    rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    if (rows.length < 2) {
      rows = rawLines.map((line) =>
        line.split(/\t|  +|\s*\|\s*/).map((c) => c.trim()).filter(Boolean)
      );
    }
  } finally {
    await parser.destroy();
  }

  // 3. Try grid-style parser first (Batch: X, Day 8-10 AM..., Monday, course, lecturer, room)
  if (rawLines.some((l) => /^Batch:\s+/i.test(l)) && rawLines.some((l) => /^Day\s+.+\d+\s*-\s*\d+/i.test(l))) {
    const gridRows = parsePdfGridLayout(rawLines);
    if (gridRows.length > 0) {
      return finalizeParseResult({
        rows: gridRows,
        tables: [],
        errors: [],
        headersDetected: { grid: 'Batch/Day/Course/Lecturer/Room' },
      });
    }
  }

  // 4. Try FET-style grid parser (Timetable generated with FET, Y1 CT Group, 08:00 - 08:55)
  const isFetFormat =
    rawLines.some((l) => /Timetable generated with FET/i.test(l)) ||
    (rawLines.some((l) => /Faculty of Computing/i.test(l)) &&
     rawLines.some((l) => /^Y\d+\s+\w+/.test(l)) &&
     rawLines.some((l) => /^\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}/.test(l)));
  if (isFetFormat) {
    const fetPeriod = extractFetGenerationPeriod(rawLines, fileName);
    const lineResult = parsePdfFetLineLayout(rawLines, fileName);
    if (lineResult.rows.length > 0) {
      const finalized = finalizeParseResult(lineResult);
      finalized.headersDetected.semester = String(finalized.rows[0]?.semester ?? fetPeriod.semester ?? 1);
      return finalized;
    }
    let fetResult = parsePdfFetLayout(rows, fetPeriod);
    if (fetResult.rows.length === 0 && rawLines.length > 0) {
      const altRows = rawLines.map((line) =>
        line.split(/\t|\s{2,}|\s*\|\s*/).map((c) => c.trim()).filter(Boolean)
      );
      fetResult = parsePdfFetLayout(altRows, fetPeriod);
    }
    if (fetResult.rows.length > 0) {
      return finalizeParseResult(fetResult);
    }
  }

  if (rows.length < 2) {
    return { rows: [], tables: [], errors: [{ row: 1, message: 'PDF has no parseable table content' }], headersDetected: {} };
  }

  // Find header row (contains day-like, time-like, course-like words)
  let headerIdx = 0;
  const firstRow = rows[0] || [];
  const hasDay = firstRow.some((c) => /mon|tue|wed|thu|fri|day/i.test(c));
  const hasTime = firstRow.some((c) => /\d{1,2}:\d{2}/.test(c) || /^\d{1,2}\.\d{2}$/.test(c));
  if (!hasDay && !hasTime && rows.length > 1) {
    headerIdx = 0;
  }

  const dataRows = rows.slice(headerIdx + 1);
  const headers = rows[headerIdx] || [];
  const colCount = Math.max(...rows.map((r) => r.length), 6);

  // Build column mapping by position
  const posMap: Record<number, string> = {};
  headers.forEach((h, i) => {
    const f = mapHeaderToField(h);
    if (f) posMap[i] = f;
  });

  if (Object.keys(posMap).length < 4) {
    const defaults = ['year', 'month', 'week', 'day', 'startTime', 'endTime', 'courseCode', 'courseName', 'lecturerEmail', 'hallName', 'groupName'];
    for (let i = 0; i < Math.min(colCount, defaults.length); i++) {
      if (!Object.values(posMap).includes(defaults[i])) posMap[i] = defaults[i];
    }
  }

  const result: ParseResult = {
    rows: [],
    tables: [],
    errors: [],
    headersDetected: posMap as unknown as Record<string, string>,
  };

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rowNum = i + headerIdx + 2;

    if (r.length === 1 && typeof r[0] === 'string') {
      const singleMatch = r[0].match(SINGLE_CELL_ROW_RE);
      if (singleMatch) {
        const [, yearStr, monthStr, weekStr, dayStr, startStr, endStr, middleStr, hallStr, groupStr] = singleMatch;
        const day = parseDay(dayStr);
        if (!day) {
          result.errors.push({ row: rowNum, message: `Invalid day in row: ${r[0]}` });
          continue;
        }
        const startTime = parseTime(startStr);
        const endTime = parseTime(endStr);
        if (!startTime || !endTime || startTime >= endTime) {
          result.errors.push({ row: rowNum, message: `Invalid time in row` });
          continue;
        }
        const lecturerMatch = middleStr.match(/((?:Dr\.|Prof\.|Snr\.\s*Prof\.|Mr\.|Ms\.)\s+[\s\S]+)$/);
        const courseName = lecturerMatch ? middleStr.slice(0, lecturerMatch.index).trim() : middleStr.trim();
        const lecturerName = lecturerMatch ? lecturerMatch[1].trim() : '';
        result.rows.push({
          year: parseIntSafe(yearStr, 2000, 2100, 2026),
          month: parseMonth(monthStr) ?? 1,
          week: parseIntSafe(weekStr, 1, 53, 1),
          dayOfWeek: day,
          startTime,
          endTime,
          courseCode: (courseName || 'UNKNOWN').replace(/\s+/g, '-').toUpperCase().slice(0, 20),
          courseName: courseName || 'Unknown',
          lecturerEmail: '',
          lecturerName: lecturerName || undefined,
          hallName: hallStr.trim(),
          groupName: groupStr.trim(),
          semester: 1,
        });
        continue;
      }
    }

    const get = (field: string): string => {
      const idx = Object.entries(posMap).find(([, v]) => v === field)?.[0];
      return idx !== undefined ? (r[parseInt(idx, 10)] ?? '') : '';
    };

    const yearVal = parseIntSafe(get('year') || r[0] || '', 2000, 2100, 2026);
    const monthParsed = parseMonth(get('month') || r[1] || '');
    const monthVal = monthParsed ?? parseIntSafe(get('month') || r[1] || '', 1, 12, 1);
    const weekVal = parseIntSafe(get('week') || r[2] || '', 1, 53, 1);
    const day = parseDay(get('day') || get('dayOfWeek') || r[3] || '');
    if (!day) {
      result.errors.push({ row: rowNum, message: `Invalid day in row: ${r.join(' | ')}` });
      continue;
    }

    const startTime = parseTime(get('startTime') || get('start') || r[4] || '');
    if (!startTime) {
      result.errors.push({ row: rowNum, message: `Invalid startTime in row` });
      continue;
    }

    const endTime = parseTime(get('endTime') || get('end') || r[5] || '');
    if (!endTime) {
      result.errors.push({ row: rowNum, message: `Invalid endTime in row` });
      continue;
    }

    if (startTime >= endTime) {
      result.errors.push({ row: rowNum, message: 'startTime must be before endTime' });
      continue;
    }

    const courseCode = (get('courseCode') || get('course') || r[6] || '').trim();
    const courseName = (get('courseName') || r[7] || '').trim();
    const lecturerEmail = (get('lecturerEmail') || get('lecturer') || r[8] || '').trim().toLowerCase();
    const hallName = (get('hallName') || get('hall') || r[9] || '').trim();
    const groupName = (get('groupName') || get('group') || r[10] || '').trim();

    if (!courseCode || !hallName || !groupName) {
      result.errors.push({ row: rowNum, message: 'Course, hall, and group are required' });
      continue;
    }

    result.rows.push({
      year: yearVal,
      month: monthVal,
      week: weekVal,
      dayOfWeek: day,
      startTime,
      endTime,
      courseCode: courseCode.toUpperCase(),
      courseName: courseName || courseCode,
      lecturerEmail,
      hallName,
      groupName,
      semester: 1,
    });
  }

  return finalizeParseResult(result);
}
