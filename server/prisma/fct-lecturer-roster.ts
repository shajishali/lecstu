/**
 * FCT lecturer directory — manual source of truth.
 *
 * Edit: server/prisma/fct-lecturers-user-provided.ts
 *   • USER_PROVIDED_LECTURERS — names/codes you gave (LK, NP, SP, lecturer@kln.ac.lk)
 *   • DAC_APPLIED_COMPUTING_STAFF — full DAC list you pasted (emails @kln.ac.lk)
 *   • DSE_SOFTWARE_ENGINEERING_STAFF — Department of Software Engineering
 *   • DCSE_COMPUTER_SYSTEMS_STAFF — Department of Computer Systems Engineering
 *   • FET_TIMETABLE_CODE_LECTURERS — codes on imported timetables (KVS, MB, KP, SB)
 *
 * Seed: npm run db:seed-lecturers
 */

export type FctDepartment = 'DAC' | 'DSE' | 'DCSE';

export type FctLecturerRosterEntry = {
  firstName: string;
  lastName: string;
  email: string;
  designation?: string;
  phone?: string;
  departmentCode: string;
  fctDepartment: FctDepartment;
  sourceUrl?: string;
  timetableCode?: string;
  office?: { roomNumber: string; building: string; floor?: number };
};

import {
  USER_PROVIDED_LECTURERS,
  DAC_APPLIED_COMPUTING_STAFF,
  DSE_SOFTWARE_ENGINEERING_STAFF,
  DCSE_COMPUTER_SYSTEMS_STAFF,
  FET_TIMETABLE_CODE_LECTURERS,
} from './fct-lecturers-user-provided';

function mergeRoster(entries: FctLecturerRosterEntry[]): FctLecturerRosterEntry[] {
  const byEmail = new Map<string, FctLecturerRosterEntry>();
  for (const e of entries) {
    const key = e.email.toLowerCase();
    const prev = byEmail.get(key);
    if (!prev) {
      byEmail.set(key, e);
      continue;
    }
    byEmail.set(key, {
      ...prev,
      ...e,
      phone: e.phone ?? prev.phone,
      designation: e.designation ?? prev.designation,
      timetableCode: e.timetableCode ?? prev.timetableCode,
      office: e.office ?? prev.office,
      sourceUrl: e.sourceUrl ?? prev.sourceUrl,
    });
  }
  return [...byEmail.values()];
}

/** Full roster seeded into the database */
export const FCT_LECTURER_ROSTER: FctLecturerRosterEntry[] = mergeRoster([
  ...USER_PROVIDED_LECTURERS,
  ...DAC_APPLIED_COMPUTING_STAFF,
  ...DSE_SOFTWARE_ENGINEERING_STAFF,
  ...DCSE_COMPUTER_SYSTEMS_STAFF,
  ...FET_TIMETABLE_CODE_LECTURERS,
]);
