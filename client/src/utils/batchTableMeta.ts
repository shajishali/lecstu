/** Client-side mirror of server batch table labels (FCT group codes). */

const YEARS_WITH_PATHWAYS = ['Y3', 'Y4'] as const;
const PATHWAY_CODES = new Set([
  'AINT', 'DSCI', 'CSEC', 'SPCS', 'ETIA', 'ETMP', 'ETST', 'SWST', 'GANI', 'CTNT',
]);

export function normalizeBatchYearLabel(value: string | number | null | undefined): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const twoDigit = raw.match(/^(\d{2})$/);
  if (twoDigit) return `20${twoDigit[1]}`;
  const fourDigit = raw.match(/^(20\d{2})$/);
  return fourDigit ? fourDigit[1] : undefined;
}

function suffixIsPathwayCode(studyYear: string, suffix: string): boolean {
  if (!YEARS_WITH_PATHWAYS.includes(studyYear as (typeof YEARS_WITH_PATHWAYS)[number])) return false;
  return PATHWAY_CODES.has(suffix.toUpperCase());
}

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
      const studyYear = `Y${withSuffix[2]}`;
      const suffix = withSuffix[3].toUpperCase();
      if (!suffixIsPathwayCode(studyYear, suffix)) {
        const normalized = normalizeBatchYearLabel(suffix);
        if (normalized) return normalized;
      }
    }
  }

  return undefined;
}

export function formatBatchTableTitle(
  canonicalGroupName: string,
  batchYearLabel?: string | null,
): string {
  const trimmed = canonicalGroupName.trim();
  const legacy = trimmed.match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+(?:\d{2}|20\d{2}))?$/i);
  const canonical = legacy
    ? `${legacy[2].toUpperCase() === 'BST' ? 'BS' : legacy[2].toUpperCase()}-Y${legacy[1]}`
    : trimmed;

  const m = canonical.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?$/i);
  if (!m) return trimmed;

  const prog = m[1].toUpperCase();
  const year = `Y${m[2]}`;
  const suffix = m[3]?.toUpperCase();
  const isPathway = suffix && suffixIsPathwayCode(year, suffix) ? suffix : undefined;

  let base: string;
  if (prog === 'BS') base = `${year} BST Group`;
  else if (isPathway) base = `${year} ${isPathway}`;
  else base = `${year} ${prog}`;

  const batch =
    normalizeBatchYearLabel(batchYearLabel) ??
    extractBatchYearLabel('', canonicalGroupName);
  return batch ? `${base} ${batch}` : base;
}

export const ADMISSION_BATCH_YEARS = ['2023', '2024', '2025', '2026', '2027', '2028'] as const;

const Y1_GROUPS_WITH_ADMISSION_YEAR = new Set(['CS-Y1', 'ET-Y1', 'CT-Y1']);

function canonicalY1GroupName(groupName: string): string | null {
  const trimmed = groupName.trim().toUpperCase();
  const legacy = trimmed.match(/^Y1[-\s]+(CS|ET|CT)$/);
  if (legacy) return `${legacy[1]}-Y1`;
  const direct = trimmed.match(/^(CS|ET|CT)-Y1$/);
  return direct ? `${direct[1]}-Y1` : null;
}

function pickMissingY1AdmissionYear(usedYears: Set<string>): string {
  if (!usedYears.has('2024') && usedYears.has('2023')) return '2024';
  if (!usedYears.has('2023') && usedYears.has('2024')) return '2023';
  if (!usedYears.has('2024')) return '2024';
  if (!usedYears.has('2023')) return '2023';
  return '2024';
}

/** Mirror server logic: fill 2023/2024 for Y1 CS, ET, CT when missing. */
export function inferMissingY1AdmissionYear(
  meta: { id: string; tableTitle: string; groupName: string },
  all: { id: string; tableTitle: string; groupName: string }[],
): string | undefined {
  const existing = extractBatchYearLabel(meta.tableTitle, meta.groupName);
  if (existing) return existing;

  const canonical = canonicalY1GroupName(meta.groupName);
  if (!canonical || !Y1_GROUPS_WITH_ADMISSION_YEAR.has(canonical)) return undefined;

  const siblings = all.filter((row) => canonicalY1GroupName(row.groupName) === canonical);
  const usedYears = new Set<string>();
  const missing: typeof siblings = [];

  for (const row of siblings) {
    const year = extractBatchYearLabel(row.tableTitle, row.groupName);
    if (year) usedYears.add(year);
    else missing.push(row);
  }

  missing.sort((a, b) => a.id.localeCompare(b.id));
  const simulated = new Set(usedYears);
  for (const row of missing) {
    const assign = pickMissingY1AdmissionYear(simulated);
    simulated.add(assign);
    if (row.id === meta.id) return assign;
  }

  return undefined;
}

export function formatBatchTableChipLabel(
  meta: { id: string; tableTitle: string; groupName: string },
  all?: { id: string; tableTitle: string; groupName: string }[],
): string {
  const batchYear =
    extractBatchYearLabel(meta.tableTitle, meta.groupName) ??
    (all ? inferMissingY1AdmissionYear(meta, all) : undefined);
  return formatBatchTableTitle(meta.groupName, batchYear);
}

export function suggestBatchTableTitle(
  groupName: string,
  currentTitle = '',
  batchYearLabel?: string | null,
): string {
  const trimmed = groupName.trim();
  if (!trimmed) return currentTitle;
  const suggested = formatBatchTableTitle(trimmed, batchYearLabel);
  const previousAuto = formatBatchTableTitle(
    trimmed,
    extractBatchYearLabel(currentTitle, trimmed),
  );
  if (!currentTitle || currentTitle === previousAuto) {
    return suggested;
  }
  return currentTitle;
}
