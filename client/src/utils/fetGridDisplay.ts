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

function isOrphanPunctuation(text: string): boolean {
  return /^[,.\s]+$/.test(text);
}

function isWordLikeName(word: string): boolean {
  return /^[A-Za-z][A-Za-z.'-]*$/i.test(word);
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

function isFetLecturerLabelLine(t: string): boolean {
  if (/^[A-Z]{1,4}(_[A-Za-z]+)?$|^VL_/i.test(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t)) {
    return t.length <= 48;
  }
  if (t.startsWith('Lecturer:')) {
    const name = t.replace(/^Lecturer:\s*/i, '').trim();
    return !!name && name !== '-' && name !== '-' && !/^unassigned$/i.test(name);
  }
  if (!COURSE_LINE_RE.test(t) && !HALL_LINE_RE.test(t) && !/^tbd$/i.test(t)) {
    const words = t.split(/\s+/).filter(Boolean);
    if (
      words.length >= 2 &&
      words.every(isWordLikeName) &&
      words.some((w) => w.length > 2) &&
      t.length <= 64
    ) {
      return true;
    }
  }
  if (!t.includes(',')) return false;
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.every((p) => /^[A-Za-z]{1,8}$/i.test(p) || /^VL_/i.test(p))) return true;
  if (parts.length === 2 && parts[0]!.includes(' ') && /^[A-Za-z]{1,8}$/i.test(parts[1]!)) return true;
  if (parts[0]!.includes(' ') && /^[A-Za-z]{2,12}$/i.test(parts[parts.length - 1]!)) return true;
  if (parts.every((p) => p.includes(' ') && p.split(/\s+/).every(isWordLikeName))) return true;
  return false;
}

function isLecturerPlaceholder(t: string): boolean {
  return t === '-' || t === '-' || /^unassigned$/i.test(t);
}

export function formatFetGridLine(line: string, index: number, allLines: string[]): string | null {
  const t = stripCommonMarker(line.trim());
  if (!t || isActivitySuffix(t) || isOrphanPunctuation(t)) return null;
  if (isLecturerPlaceholder(t)) return null;
  if (t.toUpperCase() === 'TBD' && !allLines.some((l) => HALL_LINE_RE.test(l))) {
    return 'Room: TBD';
  }
  if (HALL_LINE_RE.test(t)) {
    return t.startsWith('Room:') ? t : `Room: ${t}`;
  }
  if (
    index > 0 &&
    (isFetLecturerLabelLine(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t))
  ) {
    return t.startsWith('Lecturer:') ? t : `Lecturer: ${t}`;
  }
  return formatCourseDisplayLine(line);
}

export function fetGridDisplayLines(lines: string[]): string[] {
  const merged = coalesceOrphanActivitySuffixes(lines);
  const courses: string[] = [];
  const halls: string[] = [];
  let extras: string[] = [];
  const lecturers: string[] = [];
  let hasLecturerPlaceholder = false;

  for (const [index, line] of merged.entries()) {
    const t = stripCommonMarker(line.trim());
    if (!t || isActivitySuffix(t) || isOrphanPunctuation(t)) continue;
    if (isLecturerPlaceholder(t)) {
      hasLecturerPlaceholder = true;
      continue;
    }

    const formatted = formatFetGridLine(line, index, merged);
    if (!formatted) continue;

    const lecturer = formatted.match(/^Lecturer:\s*(.+)$/i)?.[1]?.trim();
    if (lecturer !== undefined) {
      if (isLecturerPlaceholder(lecturer)) {
        hasLecturerPlaceholder = true;
      } else if (!isActivitySuffix(lecturer)) {
        lecturers.push(lecturer);
      }
      continue;
    }

    if (formatted.startsWith('Room:')) {
      const roomText = formatted.replace(/^Room:\s*/i, '').trim();
      if (roomText.includes(',')) {
        for (const hall of roomText.split(',').map((h) => h.trim()).filter(Boolean)) {
          halls.push(hall.startsWith('Room:') ? hall : `Room: ${hall}`);
        }
      } else {
        halls.push(formatted);
      }
    } else if (COURSE_LINE_RE.test(formatted)) {
      courses.push(formatted);
    } else {
      extras.push(formatted);
    }
  }

  const promotedExtras: string[] = [];
  for (const line of extras) {
    const bare = line.replace(/^Lecturer:\s*/i, '').trim();
    if (bare && isFetLecturerLabelLine(bare)) {
      lecturers.push(bare);
    } else {
      promotedExtras.push(line);
    }
  }
  extras = promotedExtras;

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
        ? ['Lecturer: -']
        : [];

  return [...dedupe(courses), ...lecturerLine, ...dedupe(extras), ...dedupe(halls)];
}
