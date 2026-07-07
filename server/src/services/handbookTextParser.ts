/**
 * Parse OCR / handbook text lines into catalog entries.
 */
import type { HandbookCatalogEntry } from '../types/handbookCatalog';
import { inferProgramFromCoursePrefix, normalizeCourseCode } from './handbookCatalogService';

const COURSE_LINE_RE =
  /\b(CS|CT|ET|BS|SWST|AINT|DSCI|CSEC|SPCS|CTEC|CSCI|ETEC|GANI|CTNT)\s*[-]?\s*(\d{4,5})\b/i;

/** C = compulsory, O = optional in handbook tables */
function parseRequirementType(token: string): 'COMPULSORY' | 'OPTIONAL' {
  const t = token.trim().toUpperCase();
  if (t === 'O' || t === 'OPT' || t === 'OPTIONAL') return 'OPTIONAL';
  return 'COMPULSORY';
}

export function parseHandbookTextLines(
  lines: string[],
  context: { programCode?: string; studyYear?: number; pathwayCode?: string | null } = {},
): HandbookCatalogEntry[] {
  const entries: HandbookCatalogEntry[] = [];
  const seen = new Set<string>();

  let programCode = context.programCode;
  let studyYear = context.studyYear;
  let pathwayCode = context.pathwayCode ?? '';

  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;

    const header = line.match(/\b(Y[1-4])\s+(CS|CT|ET|BS)\b/i);
    if (header) {
      studyYear = Number(header[1].replace('Y', ''));
      programCode = header[2].toUpperCase();
      continue;
    }

    const pathwayHeader = line.match(/\b(AINT|DSCI|CSEC|SPCS|SWST|GANI|CTNT|ETIA|ETMP|ETST)\b/i);
    if (pathwayHeader && !COURSE_LINE_RE.test(line)) {
      pathwayCode = pathwayHeader[1].toUpperCase();
      continue;
    }

    const codeMatch = line.match(COURSE_LINE_RE);
    if (!codeMatch) continue;

    const code = normalizeCourseCode(`${codeMatch[1]} ${codeMatch[2]}`);
    if (seen.has(code)) continue;
    seen.add(code);

    const afterCode = line.slice(codeMatch.index! + codeMatch[0].length).trim();
    const parts = afterCode.split(/\s{2,}|\t/).map((p) => p.trim()).filter(Boolean);

    let title = parts[0] ?? code;
    let credits: number | undefined;
    let requirementType: 'COMPULSORY' | 'OPTIONAL' = 'COMPULSORY';
    let lecturerName: string | undefined;

    for (const part of parts.slice(1)) {
      if (/^\d$/.test(part) && Number(part) <= 6) {
        credits = Number(part);
        continue;
      }
      if (/^(C|O|COMPULSORY|OPTIONAL)$/i.test(part)) {
        requirementType = parseRequirementType(part);
        continue;
      }
      if (/^(dr|prof|mr|ms|mrs)\b/i.test(part) || part.includes('.')) {
        lecturerName = part;
      }
    }

  if (title.match(/^(C|O)$/i)) {
      requirementType = parseRequirementType(title);
      title = parts[1] ?? code;
    }

    const prog = programCode ?? inferProgramFromCoursePrefix(code);
    const year = studyYear ?? inferStudyYearFromCourseCode(code);

    entries.push({
      code,
      title,
      programCode: prog,
      studyYear: year,
      pathwayCode,
      requirementType,
      credits,
      lecturers: lecturerName ? [{ name: lecturerName }] : undefined,
    });
  }

  return entries;
}

function inferStudyYearFromCourseCode(code: string): number {
  const num = code.match(/(\d)/)?.[1];
  if (!num) return 3;
  const d = Number(num);
  if (d >= 1 && d <= 4) return d;
  return 3;
}

export function mergeCatalogEntries(entries: HandbookCatalogEntry[]): HandbookCatalogEntry[] {
  const map = new Map<string, HandbookCatalogEntry>();
  for (const e of entries) {
    const key = `${e.programCode}|${e.studyYear}|${e.pathwayCode ?? ''}|${normalizeCourseCode(e.code)}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, e);
      continue;
    }
    map.set(key, {
      ...prev,
      ...e,
      title: e.title.length > prev.title.length ? e.title : prev.title,
      lecturers: [...(prev.lecturers ?? []), ...(e.lecturers ?? [])],
    });
  }
  return [...map.values()];
}
