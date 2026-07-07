/**

 * Match FET lecturer initials from timetable cells (e.g. ND, MB, VL_HS).

 * Does NOT treat course activity suffixes P/T as lecturers.

 */



export interface LecturerIdentity {

  id: string;

  firstName: string;

  lastName: string;

  timetableCode?: string | null;

}



/** FET activity type letters on course codes - not lecturer identifiers */

const FET_ACTIVITY_SUFFIXES = new Set(['P', 'T', 'PT', 'TP', 'PP', 'TT', 'ONLINE']);



export function isFetActivitySuffix(code: string): boolean {

  return FET_ACTIVITY_SUFFIXES.has(code.trim().toUpperCase());

}



/** @deprecated Course suffix P/T are not lecturers - always returns [] */

export function extractFetLecturerCodesFromCourse(_course: string): string[] {

  return [];

}



/** True for a dedicated lecturer line from the sheet (ND, KVS, VL_HS), not course P/T */

export function isFetLecturerCodeToken(raw: string): boolean {

  const t = raw.trim();

  if (!t || t.length > 12) return false;

  if (isFetActivitySuffix(t)) return false;

  if (/^[A-Za-z]+_[A-Za-z0-9]+$/.test(t)) return true;

  if (/^[A-Za-z](?:\s*\.\s*[A-Za-z]){1,4}\.?$/.test(t)) return true;

  if (t.length >= 2 && /^[A-Za-z]{2,8}$/.test(t)) return true;

  return false;

}

/** Comma-separated FET codes on one sheet line (e.g. PF,RG or RR,Demo). */
export function splitFetLecturerCodeList(raw: string): string[] {
  const t = raw.trim();
  if (!t || !t.includes(',')) return [];
  const parts = t.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [];
  if (!parts.every((p) => isFetLecturerCodeToken(p))) return [];
  return parts;
}

/** Single code or comma-separated list from a dedicated lecturer line. */
export function isFetLecturerLineLabel(raw: string): boolean {
  const t = raw.trim();
  if (!t || t.length > 48) return false;
  if (isFetActivitySuffix(t)) return false;
  if (isFetLecturerCodeToken(t)) return true;
  if (/^VL_/i.test(t)) return true;
  return splitFetLecturerCodeList(t).length >= 2;
}



/**
 * FET short code: first letter of first name + first letter of last name.
 * e.g. Lahiru Kumara → LK, Nimal Perera → NP, Shaji Piraba → SP
 */
export function deriveTimetableCodeFromName(firstName: string, lastName: string): string {
  const firstWord = (firstName || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  const lastWord = (lastName || '').trim().split(/\s+/).filter(Boolean)[0] || '';
  if (!firstWord && !lastWord) return '';
  const a = firstWord.charAt(0);
  const b = lastWord.charAt(0) || (firstWord.length > 1 ? firstWord.charAt(1) : '');
  if (!a) return '';
  return `${a}${b}`.toUpperCase();
}

/** All codes used to match timetable rows (explicit profile code + name initials). */
export function lecturerCodesFromName(
  firstName: string,
  lastName: string,
  timetableCode?: string | null,
): string[] {
  const codes = new Set<string>();
  const explicit = (timetableCode || '').trim().toUpperCase();
  if (explicit) codes.add(explicit);

  const derived = deriveTimetableCodeFromName(firstName, lastName);
  if (derived) codes.add(derived);

  return [...codes].filter((c) => c.length > 0 && !isFetActivitySuffix(c));
}

/** Sheet code on profile, or initials derived from the name. */
export function effectiveTimetableCode(
  firstName: string,
  lastName: string,
  timetableCode?: string | null,
): string | null {
  const explicit = (timetableCode || '').trim().toUpperCase();
  if (explicit) return explicit;
  const derived = deriveTimetableCodeFromName(firstName, lastName);
  return derived || null;
}

export function normalizeInitialsKey(raw: string): string | null {

  const t = raw.trim().replace(/\s+/g, '');

  if (!t || t.length > 8) return null;

  if (isFetActivitySuffix(t)) return null;

  const dotted = t.match(/^([A-Za-z])\.?([A-Za-z])\.?([A-Za-z])?\.?([A-Za-z])?\.?$/);

  if (dotted) {

    return [dotted[1], dotted[2], dotted[3], dotted[4]]

      .filter(Boolean)

      .join('')

      .toLowerCase();

  }

  if (/^[A-Za-z]{2,8}$/.test(t)) return t.toLowerCase();

  return null;

}



function uniqueIndexFromLists(index: Map<string, string[]>): Map<string, string> {

  const unique = new Map<string, string>();

  for (const [key, ids] of index) {

    if (ids.length === 1) unique.set(key, ids[0]);

  }

  return unique;

}



/** Index for optional manual Assign: user.timetableCode only (no guessing from initials). */

export function buildLecturerInitialsIndex(

  lecturers: LecturerIdentity[],

): Map<string, string> {

  const index = new Map<string, string[]>();

  const add = (key: string, id: string) => {

    if (!key) return;

    const k = key.toLowerCase();

    const list = index.get(k) || [];

    if (!list.includes(id)) list.push(id);

    index.set(k, list);

  };

  for (const l of lecturers) {
    for (const code of lecturerCodesFromName(l.firstName, l.lastName, l.timetableCode)) {
      if (!isFetActivitySuffix(code)) add(code, l.id);
    }
  }

  return uniqueIndexFromLists(index);

}



export function matchLecturerByInitials(

  raw: string,

  index: Map<string, string>,

): string | null {

  const key = normalizeInitialsKey(raw);

  if (!key) return null;

  return index.get(key) ?? null;

}



/**

 * Optional DB link when sheet code uniquely matches one lecturer.

 * Never uses course P/T or single-letter guessing.

 */

export function matchLecturerFromSheetCode(

  raw: string | undefined,

  index: Map<string, string>,

): string | null {

  const t = (raw || '').trim();

  if (!t || !isFetLecturerCodeToken(t)) return null;

  const upper = t.toUpperCase();

  return index.get(upper) ?? index.get(upper.toLowerCase()) ?? null;

}


