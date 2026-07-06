/**
 * FCT — Faculty of Computing and Technology (University of Kelaniya)
 * Master reference for programs, study years, pathways, and lecture halls.
 * Timetable PDF import expects group names like: CS-Y3-AINT, CT-Y1, BS-Y1
 */

export const FACULTY = {
  name: 'Faculty of Computing and Technology',
  code: 'FCT',
  description:
    'FCT degree programs: CS, ET, CT, BS. Study years Y1–Y4. Pathways from Y3 (except BS: Y1 only).',
} as const;

/** Study year labels used on timetables */
export const STUDY_YEARS = ['Y1', 'Y2', 'Y3', 'Y4'] as const;
export type StudyYear = (typeof STUDY_YEARS)[number];

/** Ordinal stored in student_groups.batchYear (1 = Y1 … 4 = Y4) */
export const studyYearToOrdinal: Record<StudyYear, number> = {
  Y1: 1,
  Y2: 2,
  Y3: 3,
  Y4: 4,
};

export type ProgramConfig = {
  name: string;
  code: string;
  description: string;
  departmentCode: string;
  departmentName: string;
  /** Study years offered for this program */
  years: StudyYear[];
  /** Pathway code → display name (Y3 & Y4 only; empty for BS) */
  pathways: { code: string; name: string }[];
};

export const PROGRAMS: ProgramConfig[] = [
  {
    name: 'Computer Science',
    code: 'CS',
    description: 'B.Sc. Computer Science',
    departmentCode: 'CS',
    departmentName: 'Computer Science',
    years: ['Y1', 'Y2', 'Y3', 'Y4'],
    pathways: [
      { code: 'AINT', name: 'Artificial Intelligence' },
      { code: 'DSCI', name: 'Data Science' },
      { code: 'CSEC', name: 'Cyber Security' },
      { code: 'SPCS', name: 'Special Pathway' },
    ],
  },
  {
    name: 'Engineering Technology',
    code: 'ET',
    description: 'B.Sc. Engineering Technology',
    departmentCode: 'ET',
    departmentName: 'Engineering Technology',
    years: ['Y1', 'Y2', 'Y3', 'Y4'],
    pathways: [
      { code: 'ETIA', name: 'Automation' },
      { code: 'ETMP', name: 'Manufacturing' },
      { code: 'ETST', name: 'Sustainable' },
    ],
  },
  {
    name: 'Computing Technology',
    code: 'CT',
    description: 'B.Sc. Computing Technology',
    departmentCode: 'CT',
    departmentName: 'Computing Technology',
    years: ['Y1', 'Y2', 'Y3', 'Y4'],
    pathways: [
      { code: 'SWST', name: 'Software Engineer' },
      { code: 'GANI', name: 'Game and Animation' },
      { code: 'CTNT', name: 'Network' },
    ],
  },
  {
    name: 'Biological System',
    code: 'BS',
    description: 'B.Sc. Biological System (new program — Y1 only)',
    departmentCode: 'BS',
    departmentName: 'Biological System',
    years: ['Y1'],
    pathways: [],
  },
];

/** Years that have no pathway split (single group per program) */
export const YEARS_WITHOUT_PATHWAYS: StudyYear[] = ['Y1', 'Y2'];

/** Years that use pathway-specific groups (per program that has pathways) */
export const YEARS_WITH_PATHWAYS: StudyYear[] = ['Y3', 'Y4'];

/**
 * Build student group name for timetable matching.
 * Examples: CS-Y1, ET-Y3-ETIA, BS-Y1
 */
export function buildGroupName(programCode: string, year: StudyYear, pathwayCode?: string): string {
  if (pathwayCode) {
    return `${programCode}-${year}-${pathwayCode}`;
  }
  return `${programCode}-${year}`;
}

/** FET / legacy typos: faculty code FT or pathway FTIA instead of ET / ETIA */
const PATHWAY_TYPO_TO_CODE: Record<string, string> = {
  FTIA: 'ETIA',
  FTMP: 'ETMP',
  FTST: 'ETST',
};

function normalizeProgramCode(code: string): string {
  return code.toUpperCase() === 'FT' ? 'ET' : code.toUpperCase();
}

function normalizePathwayCode(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const u = code.toUpperCase();
  return PATHWAY_TYPO_TO_CODE[u] ?? u;
}

/** Split PDF labels like "Y3 CTNT, Y3 CSEC" into separate parts */
export function splitGroupNameParts(rawName: string): string[] {
  return rawName
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Map PDF / legacy group labels to canonical seed names (CS-Y3-AINT, CT-Y1, …).
 * Returns null when the label cannot be matched.
 */
export function resolveCanonicalGroupName(rawName: string): string | null {
  const trimmed = rawName.trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^(CS|ET|CT|BS|FT)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
  if (direct) {
    return buildGroupName(
      normalizeProgramCode(direct[1]),
      `Y${direct[2]}` as StudyYear,
      normalizePathwayCode(direct[3]),
    );
  }

  const yProg = trimmed.match(/^Y([1-4])\s+(CS|ET|CT|BS|BST)\b/i);
  if (yProg) {
    const code = yProg[2].toUpperCase() === 'BST' ? 'BS' : yProg[2].toUpperCase();
    return buildGroupName(code, `Y${yProg[1]}` as StudyYear);
  }

  const yPath = trimmed.match(/^Y([1-4])\s+([A-Z0-9]{2,6})\b/i);
  if (yPath) {
    const year = `Y${yPath[1]}` as StudyYear;
    const pathway = normalizePathwayCode(yPath[2].toUpperCase()) ?? yPath[2].toUpperCase();
    for (const prog of PROGRAMS) {
      if (prog.pathways.some((p) => p.code === pathway)) {
        return buildGroupName(prog.code, year, pathway);
      }
    }
  }

  /** Legacy FET export labels: Y1-CT-23, Y1-ET-24 (trailing admission-year suffix) */
  const legacyHyphen = trimmed.match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+(?:\d{2}|20\d{2}))?$/i);
  if (legacyHyphen) {
    const code = legacyHyphen[2].toUpperCase() === 'BST' ? 'BS' : legacyHyphen[2].toUpperCase();
    return buildGroupName(code, `Y${legacyHyphen[1]}` as StudyYear);
  }

  return null;
}

/** All canonical names implied by a raw label (handles comma-separated PDF groups) */
export function resolveCanonicalGroupNames(rawName: string): string[] {
  const names = new Set<string>();
  for (const part of splitGroupNameParts(rawName)) {
    const canonical = resolveCanonicalGroupName(part);
    if (canonical) names.add(canonical);
  }
  return [...names];
}

const PROGRAM_SORT_ORDER = ['BS', 'CS', 'CT', 'ET'] as const;

/** Normalize admission batch labels (23 → 2023, 2024 → 2024). */
export function normalizeBatchYearLabel(value: string | number | null | undefined): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const twoDigit = raw.match(/^(\d{2})$/);
  if (twoDigit) return `20${twoDigit[1]}`;
  const fourDigit = raw.match(/^(20\d{2})$/);
  return fourDigit ? fourDigit[1] : undefined;
}

function suffixIsPathwayCode(programCode: string, studyYear: StudyYear, suffix: string): boolean {
  if (!YEARS_WITH_PATHWAYS.includes(studyYear)) return false;
  const program = PROGRAMS.find((p) => p.code === programCode.toUpperCase());
  return Boolean(program?.pathways.some((p) => p.code === suffix.toUpperCase()));
}

/** Read admission year (2023, 2024, …) from stored title or legacy group codes. */
export function extractBatchYearLabel(tableTitle: string, groupName = ''): string | undefined {
  const fromTitle = tableTitle.trim().match(/\b(20\d{2})\b/);
  if (fromTitle) return fromTitle[1];

  const shortInTitle = tableTitle.trim().match(/\b(\d{2})\b/);
  if (shortInTitle) {
    const normalized = normalizeBatchYearLabel(shortInTitle[1]);
    if (normalized) return normalized;
  }

  for (const raw of [groupName, tableTitle]) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const legacy = trimmed.match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+(\d{2}|20\d{2}))?$/i);
    if (legacy?.[3]) {
      const normalized = normalizeBatchYearLabel(legacy[3]);
      if (normalized) return normalized;
    }

    const withSuffix = trimmed.match(/^(CS|ET|CT|BS)-Y([1-4])-([A-Z0-9]+)$/i);
    if (withSuffix) {
      const programCode = withSuffix[1].toUpperCase();
      const studyYear = `Y${withSuffix[2]}` as StudyYear;
      const suffix = withSuffix[3].toUpperCase();
      if (!suffixIsPathwayCode(programCode, studyYear, suffix)) {
        const normalized = normalizeBatchYearLabel(suffix);
        if (normalized) return normalized;
      }
    }
  }

  return undefined;
}

/** Human-readable batch label (BS-Y1 → "Y1 BST Group 2023", CS-Y3-AINT → "Y3 AINT"). */
export function formatBatchTableTitle(
  canonicalGroupName: string,
  batchYearLabel?: string | null,
): string {
  const canonical = resolveCanonicalGroupName(canonicalGroupName) ?? canonicalGroupName.trim();
  const m = canonical.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
  if (!m) return canonicalGroupName.trim() || canonical;

  const prog = m[1].toUpperCase();
  const year = `Y${m[2]}`;
  const suffix = m[3]?.toUpperCase();
  const isPathway =
    suffix && suffixIsPathwayCode(prog, year as StudyYear, suffix) ? suffix : undefined;

  let base: string;
  if (prog === 'BS') base = `${year} BST Group`;
  else if (isPathway) base = `${year} ${isPathway}`;
  else base = `${year} ${prog}`;

  const batch =
    normalizeBatchYearLabel(batchYearLabel) ??
    extractBatchYearLabel('', canonicalGroupName);
  return batch ? `${base} ${batch}` : base;
}

/** Normalize admin batch table title + group code to FCT conventions. */
export function normalizeBatchTableMeta(
  tableTitle: string,
  groupName: string,
): { tableTitle: string; groupName: string } {
  const rawGroup = groupName.trim();
  const rawTitle = tableTitle.trim();
  const batchYearLabel = extractBatchYearLabel(rawTitle, rawGroup);
  const canonical =
    resolveCanonicalGroupName(rawGroup) ??
    resolveCanonicalGroupName(rawTitle) ??
    (rawGroup || null);

  if (canonical) {
    return {
      groupName: canonical,
      tableTitle: formatBatchTableTitle(canonical, batchYearLabel),
    };
  }

  return {
    groupName: rawGroup || rawTitle,
    tableTitle: rawTitle || rawGroup,
  };
}

/** Sort batches: year ascending, then program (BS, CS, CT, ET), then pathway. */
export function compareBatchTableOrder(a: string, b: string): number {
  const parse = (name: string) => {
    const canonical = resolveCanonicalGroupName(name) ?? name;
    const m = canonical.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
    if (!m) return { year: 99, program: 99, pathway: name };
    return {
      year: Number(m[2]),
      program: PROGRAM_SORT_ORDER.indexOf(m[1].toUpperCase() as (typeof PROGRAM_SORT_ORDER)[number]),
      pathway: (m[3] ?? '').toUpperCase(),
    };
  };
  const ka = parse(a);
  const kb = parse(b);
  if (ka.year !== kb.year) return ka.year - kb.year;
  if (ka.program !== kb.program) return ka.program - kb.program;
  return ka.pathway.localeCompare(kb.pathway);
}

/** Raw hall names from faculty (deduplicated; spaces normalized where noted) */
export const LECTURE_HALL_NAMES: string[] = [
  'AB-CMP-02-1',
  'AB-CMP-02-2',
  'AB-CMP-02-3',
  'AB-CMP-02-4',
  'AB-LCH-09-1',
  'AB-LCH-09-2',
  'LB-CMP-01-1',
  'AB-LCH-07-1',
  'AB-LCH-07-2',
  'Language Lab (IoT)',
  'WORKSHOP',
  'LB-ELP-01-1',
  'LB-ELP-02-1',
  'LB-ELEC-01-01',
  'AB-LCH-03-1',
  'AB-LCH-04-2',
  'AB-LCH-04-1',
  'AB-LCH-05-2',
  'AB-LCH-05-1',
  'LB-MECH-G-01',
  'AB-SCALE-08-02',
  'AB-SCALE-08-01',
  'AB-Seminar-04-10',
  'AB-Seminar-04-13',
  'AB-IA-05-1',
  'AB-Seminar-05-12',
  'AB-Seminar-05-06',
  'AB-Seminar-04-14',
  'LB-CMP-10-1',
  'AB-Seminar-04-03',
  'AB-Seminar-04-09',
];

export function parseLectureHall(name: string): {
  name: string;
  building: string;
  floor: number;
  capacity: number;
  equipment: string[];
} {
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();

  if (upper === 'WORKSHOP') {
    return { name: trimmed, building: 'WORKSHOP', floor: 0, capacity: 40, equipment: ['Workshop'] };
  }

  if (trimmed.toLowerCase().includes('language lab')) {
    return {
      name: trimmed,
      building: 'Language Lab',
      floor: 0,
      capacity: 30,
      equipment: ['IoT', 'Language Lab'],
    };
  }

  const parts = trimmed.split('-').filter(Boolean);
  const building = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : parts[0] ?? 'FCT';
  let floor = 0;
  if (parts.length >= 3) {
    const parsed = parseInt(parts[2], 10);
    if (!Number.isNaN(parsed)) floor = parsed;
  }

  const equipment: string[] = ['Projector', 'Whiteboard'];
  if (upper.includes('LAB')) equipment.push('Lab');
  if (upper.includes('SEMINAR')) equipment.push('Seminar');
  if (upper.includes('CMP')) equipment.push('Computer Lab');

  return {
    name: trimmed,
    building,
    floor,
    capacity: upper.includes('SEMINAR') ? 50 : upper.includes('LAB') || upper.includes('CMP') ? 40 : 35,
    equipment,
  };
}
