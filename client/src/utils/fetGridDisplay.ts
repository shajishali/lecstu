const HALL_LINE_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/i;
const HALL_LINE_GLOBAL_RE = /\b([A-Z]{2,4}-[A-Z0-9]{2,6}-\d{2}-\d+)\b/gi;
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

function isFetLecturerLabelLine(t: string): boolean {
  if (/^[A-Z]{1,4}(_[A-Za-z]+)?$|^VL_/i.test(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t)) {
    return t.length <= 48;
  }
  if (!t.includes(',')) return false;
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 && parts.every((p) => /^[A-Za-z]{2,8}$/i.test(p) || /^VL_/i.test(p));
}

function isLikelyLecturerText(t: string): boolean {
  const text = t.replace(/^lecturer:\s*/i, '').trim();
  if (!text || text === '—' || text === '-' || /^unassigned$/i.test(text)) return false;
  if (isFetLecturerLabelLine(text)) return true;
  if (/^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(text)) return true;
  if (/^[A-Za-z][A-Za-z\s.'-]{2,60}$/.test(text) && text.includes(' ')) return true;
  return false;
}

function collectHallCodes(lines: string[]): string[] {
  const halls: string[] = [];
  for (const line of lines) {
    const t = stripCommonMarker(line.trim().replace(/^room:\s*/i, ''));
    if (!t || /^tbd$/i.test(t)) continue;
    for (const match of t.matchAll(HALL_LINE_GLOBAL_RE)) {
      const hall = match[1]?.trim();
      if (hall && !halls.some((h) => h.toUpperCase() === hall.toUpperCase())) halls.push(hall);
    }
  }
  return halls;
}

function pickBestLecturerDisplay(candidates: string[]): string | null {
  const cleaned = candidates
    .map((c) => c.replace(/^lecturer:\s*/i, '').trim())
    .filter((c) => c && c !== '—' && c !== '-' && !/^unassigned$/i.test(c) && c !== ',');
  if (!cleaned.length) return null;

  const codeOnly = cleaned.filter((c) => isFetLecturerLabelLine(c));
  const withNames = cleaned.filter((c) => c.includes(' ') && !isFetLecturerLabelLine(c));

  if (codeOnly.length > 0 && withNames.length > 0) {
    return withNames.reduce((a, b) => (a.length >= b.length ? a : b));
  }
  return cleaned.reduce((a, b) => (a.length >= b.length ? a : b));
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
    (isFetLecturerLabelLine(t) || /^(Dr\.|Prof\.|Mr\.|Ms\.)/i.test(t))
  ) {
    return t.startsWith('Lecturer:') ? t : `Lecturer: ${t}`;
  }
  return formatCourseDisplayLine(line);
}

export function fetGridDisplayLines(lines: string[]): string[] {
  const merged = coalesceOrphanActivitySuffixes(lines).filter((line) => {
    const t = stripCommonMarker(line.trim());
    return t && t !== ',' && !/^[,.\s]+$/.test(t);
  });

  const courses: string[] = [];
  const lecturerCandidates: string[] = [];
  const extras: string[] = [];
  let hasLecturerPlaceholder = false;
  let needsTbdRoom = false;

  for (const [index, line] of merged.entries()) {
    const formatted = formatFetGridLine(line, index, merged);
    if (!formatted) continue;

    const lecturer = formatted.match(/^Lecturer:\s*(.+)$/i)?.[1]?.trim();
    if (lecturer !== undefined) {
      if (!lecturer || lecturer === '—' || lecturer === '-' || /^unassigned$/i.test(lecturer)) {
        hasLecturerPlaceholder = true;
      } else if (!isActivitySuffix(lecturer)) {
        lecturerCandidates.push(lecturer);
      }
      continue;
    }

    if (formatted.startsWith('Room:')) {
      const roomText = formatted.replace(/^Room:\s*/i, '').trim();
      if (/^tbd$/i.test(roomText)) needsTbdRoom = true;
      continue;
    }
    if (COURSE_LINE_RE.test(formatted)) {
      courses.push(formatted);
    } else if (isLikelyLecturerText(formatted)) {
      lecturerCandidates.push(formatted.replace(/^lecturer:\s*/i, '').trim());
    } else if (!HALL_LINE_RE.test(formatted)) {
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

  const hallCodes = collectHallCodes(merged);
  const hallLine =
    hallCodes.length > 0
      ? [`Room: ${hallCodes.join(', ')}`]
      : needsTbdRoom
        ? ['Room: TBD']
        : [];

  const bestLecturer = pickBestLecturerDisplay(lecturerCandidates);
  const lecturerLine = bestLecturer
    ? [`Lecturer: ${bestLecturer}`]
    : hasLecturerPlaceholder
      ? ['Lecturer: —']
      : [];

  const chosenLecturerKey = bestLecturer?.toLowerCase() ?? '';
  const filteredExtras = dedupe(extras).filter((line) => {
    const plain = line.replace(/^lecturer:\s*/i, '').trim().toLowerCase();
    if (!plain || plain === chosenLecturerKey) return false;
    if (isLikelyLecturerText(line)) return false;
    return true;
  });

  return [...dedupe(courses), ...lecturerLine, ...filteredExtras, ...hallLine];
}
