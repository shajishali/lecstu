/** Course code + handbook title for catalog / module selection UI */
export function formatCatalogCourseLabel(code: string, name?: string | null): string {
  const codeSpaced = code.replace(/-/g, ' ');
  const n = (name || '').trim();
  if (!n || n.toUpperCase() === codeSpaced.toUpperCase()) return codeSpaced;
  if (/^[A-Z]{2,6}(\s+\d{4,5})/i.test(n) && n.length <= 48) return codeSpaced;
  return `${codeSpaced} — ${n}`;
}

/** Short course label for timetable grids (matches FET / import preview style) */
export function formatCourseLabel(code: string, name?: string | null): string {
  const n = (name || '').trim();
  const codeSpaced = code.replace(/-/g, ' ');
  if (!n) return codeSpaced;
  // Prefer full handbook title when the stored name is still a short FET code
  if (/^[A-Z]{2,6}(\s+\d{4,5})+(\s+[A-Za-z][A-Za-z0-9_]*)?$/i.test(n) && n.length <= 48) {
    return codeSpaced;
  }
  if (n.length <= 36) return n;
  return codeSpaced;
}

export function durationMinutes(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

export function formatDuration(startTime: string, endTime: string): string {
  const mins = durationMinutes(startTime, endTime);
  if (mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
