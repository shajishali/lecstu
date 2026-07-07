export interface TimetableGridCell {
  rawText: string;
  lines: string[];
  displayLines?: string[];
  isEmpty: boolean;
  isBreak: boolean;
  isOnline: boolean;
  rowSpan: number;
  mergeContinue: boolean;
  /** Per-class start/end (HH:MM) - does not change the global time row for other days */
  slotStart?: string;
  slotEnd?: string;
  /** Admin-only: allow same hall/time as another batch (not shown on student timetable). */
  sharedHall?: boolean;
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
  dayColumns: { day: string; label: string }[];
  timeRows: { label: string; start: string; end: string }[];
  cells: TimetableGridCell[][];
}
