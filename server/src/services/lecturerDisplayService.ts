import prisma from '../config/database';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import {
  buildLecturerInitialsIndex,
  isFetLecturerCodeToken,
  lecturerCodesFromName,
  matchLecturerByInitials,
  splitFetLecturerCodeList,
  type LecturerIdentity,
} from './lecturerInitialsMatch';

export type LecturerDisplayIndex = {
  idByCode: Map<string, string>;
  nameByCode: Map<string, string>;
};

let cached: LecturerDisplayIndex | null = null;

export async function getLecturerDisplayIndex(force = false): Promise<LecturerDisplayIndex> {
  if (cached && !force) return cached;

  const lecturers = await prisma.user.findMany({
    where: {
      role: 'LECTURER',
      isActive: true,
      NOT: { email: UNASSIGNED_LECTURER_EMAIL },
    },
    select: { id: true, firstName: true, lastName: true, timetableCode: true },
  });

  const idByCode = buildLecturerInitialsIndex(lecturers as LecturerIdentity[]);
  const nameByCode = new Map<string, string>();
  for (const lec of lecturers) {
    const name = `${lec.firstName} ${lec.lastName}`.trim();
    for (const code of lecturerCodesFromName(lec.firstName, lec.lastName, lec.timetableCode)) {
      nameByCode.set(code.toLowerCase(), name);
    }
  }

  cached = { idByCode, nameByCode };
  return cached;
}

export function invalidateLecturerDisplayIndex(): void {
  cached = null;
}

function resolveSingleLecturerDisplayName(
  raw: string,
  index: LecturerDisplayIndex,
): string | undefined {
  const t = raw.trim();
  if (!t || t === '—' || t === '-') return undefined;
  if (t.includes(' ') && !isFetLecturerCodeToken(t.split(/\s+/)[0] ?? '')) return t;

  const token = t.split(/\s+/).find((p) => isFetLecturerCodeToken(p)) ?? t;
  const key = token.replace(/\s+/g, '').toLowerCase();
  const fromName = index.nameByCode.get(key);
  if (fromName) return fromName;

  const id = matchLecturerByInitials(token, index.idByCode);
  if (id) {
    for (const [code, name] of index.nameByCode) {
      if (index.idByCode.get(code) === id) return name;
    }
  }
  return t;
}

/** Resolve FET code (SB, VL_Amila, PF,RG) to faculty full name when uniquely known. */
export function resolveLecturerDisplayName(
  raw: string | undefined,
  index: LecturerDisplayIndex,
): string | undefined {
  const t = raw?.trim();
  if (!t || t === '—' || t === '-') return undefined;

  const multi = splitFetLecturerCodeList(t);
  if (multi.length >= 2) {
    return multi.map((code) => resolveSingleLecturerDisplayName(code, index) ?? code).join(', ');
  }

  return resolveSingleLecturerDisplayName(t, index);
}

/** Link unassigned master slots to faculty when sheet initials match one lecturer. */
export async function linkLecturersFromSheetInitials(): Promise<{ linked: number }> {
  const unassigned = await prisma.user.findFirst({
    where: { email: UNASSIGNED_LECTURER_EMAIL, role: 'LECTURER' },
    select: { id: true },
  });
  if (!unassigned) return { linked: 0 };

  const index = await getLecturerDisplayIndex(true);
  const slots = await prisma.masterTimetable.findMany({
    where: {
      isActive: true,
      lecturerInitials: { not: null },
      lecturerId: unassigned.id,
    },
    select: { id: true, lecturerInitials: true },
  });

  let linked = 0;
  for (const slot of slots) {
    const code = slot.lecturerInitials?.trim();
    if (!code) continue;
    const lecturerId = matchLecturerByInitials(code, index.idByCode);
    if (!lecturerId) continue;
    await prisma.masterTimetable.update({
      where: { id: slot.id },
      data: { lecturerId },
    });
    linked++;
  }
  return { linked };
}
