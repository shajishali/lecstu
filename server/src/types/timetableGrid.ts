/** Faithful FET timetable table — stored and rendered as one unit (not line-by-line edits). */

export interface TimetableGridCell {
  rawText: string;
  lines: string[];
  /** De-duplicated lines for UI (one hall name, clear course + lecturer) */
  displayLines: string[];
  isEmpty: boolean;
  isBreak: boolean;
  isOnline: boolean;
  /** 1 = normal row; >1 = merged vertical span in the source Excel */
  rowSpan: number;
  /** True when this row is covered by a merge starting above (do not render a box) */
  mergeContinue: boolean;
  /** Per-class start/end (HH:MM) when edited independently of the row label */
  slotStart?: string;
  slotEnd?: string;
  /** Admin-only: allow same hall/time as another batch (not shown on student timetable). */
  sharedHall?: boolean;
}

export interface TimetableGridTimeRow {
  label: string;
  start: string;
  end: string;
}

export interface TimetableGridDayColumn {
  day: string;
  label: string;
}

export interface TimetableGridSnapshot {
  tableTitle: string;
  groupName: string;
  programCode: string;
  studyYear: string;
  pathwayCode: string;
  year: number;
  month: number;
  week: number;
  semester: number;
  dayColumns: TimetableGridDayColumn[];
  timeRows: TimetableGridTimeRow[];
  cells: TimetableGridCell[][];
}
