const UNASSIGNED_EMAIL = 'unassigned@lecstu.edu';

export function formatTimetableLecturer(entry: {
  lecturerInitials?: string | null;
  lecturer: { firstName: string; lastName: string; email: string };
}): string {
  if (entry.lecturer.email !== UNASSIGNED_EMAIL) {
    const name = `${entry.lecturer.firstName} ${entry.lecturer.lastName}`.trim();
    if (name) return name;
  }
  const code = entry.lecturerInitials?.trim();
  if (code) return code;
  return '-';
}

export function isTimetableLecturerUnassigned(entry: {
  lecturerInitials?: string | null;
  lecturer: { email: string };
}): boolean {
  return entry.lecturer.email === UNASSIGNED_EMAIL && !entry.lecturerInitials?.trim();
}
