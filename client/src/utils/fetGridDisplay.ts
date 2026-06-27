const HALL_LINE_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/i;
const COURSE_LINE_RE = /\b[A-Z]{2,6}[-\s]+\d{4,5}[A-Za-z0-9_]*\b/i;

function stripCommonMarker(text: string): string {
  return text.replace(/\s+COMMON\b/gi, '').trim();
}

function formatCourseDisplayLine(line: string): string {
  return stripCommonMarker(line.trim());
}

function isActivitySuffix(text: string): boolean {
  return /^[TP]$/i.test(stripCommonMarker(text.trim()));
}

function coalesceOrphanActivitySuffixes(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = stripCommonMarker(line.trim());
    if (!t) continue;
    if (isActivitySuffix(t) && out.length > 0 && COURSE_LINE_RE.test(out[out.length - 1]!)) {
      out[out.length - 1] = `${out[out.length - 1]!.trim()} ${t.toUpperCase()}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

export function formatFetGridLine(line: string, index: number, allLines: string[]): string | null {
  const t = stripCommonMarker(line.trim());
  if (!t || isActivitySuffix(t)) return null;
  if (t === '—' || t === '-' || t.toLowerCase() === 'unassigned') {
    return 'Lecturer: —';
  }
  if (t.toUpperCase() === 'TBD' && !allLines.some((l) => HALL_LINE_RE.test(l))) {
    return 'Room: TBD';
  }
  if (HALL_LINE_RE.test(t)) {
    return t.startsWith('Room:') ? t : `Room: ${t}`;
  }
  if (
    index > 0 &&
    (/^[A-Z]{2,4}(_[A-Za-z]+)?$|^VL_/i.test(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t)) &&
    t.length <= 24
  ) {
    return t.startsWith('Lecturer:') ? t : `Lecturer: ${t}`;
  }
  return formatCourseDisplayLine(line);
}

export function fetGridDisplayLines(lines: string[]): string[] {
  const merged = coalesceOrphanActivitySuffixes(lines);
  const courses: string[] = [];
  const halls: string[] = [];
  const extras: string[] = [];
  const lecturers: string[] = [];
  let hasLecturerPlaceholder = false;

  for (const [index, line] of merged.entries()) {
    const formatted = formatFetGridLine(line, index, merged);
    if (!formatted) continue;

    const lecturer = formatted.match(/^Lecturer:\s*(.+)$/i)?.[1]?.trim();
    if (lecturer !== undefined) {
      if (!lecturer || lecturer === '—' || lecturer === '-' || /^unassigned$/i.test(lecturer)) {
        hasLecturerPlaceholder = true;
      } else if (!isActivitySuffix(lecturer)) {
        lecturers.push(lecturer);
      }
      continue;
    }

    if (formatted.startsWith('Room:')) {
      halls.push(formatted);
    } else if (COURSE_LINE_RE.test(formatted)) {
      courses.push(formatted);
    } else {
      extras.push(formatted);
    }
  }

  const dedupe = (values: string[]) => {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = value.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const uniqueLecturers = dedupe(lecturers);
  const lecturerLine =
    uniqueLecturers.length > 0
      ? [`Lecturer: ${uniqueLecturers.reduce((a, b) => (a.length >= b.length ? a : b))}`]
      : hasLecturerPlaceholder
        ? ['Lecturer: —']
        : [];

  return [...dedupe(courses), ...lecturerLine, ...dedupe(extras), ...dedupe(halls)];
}
