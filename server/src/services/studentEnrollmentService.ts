import prisma from '../config/database';
import {
  PROGRAMS,
  YEARS_WITHOUT_PATHWAYS,
  YEARS_WITH_PATHWAYS,
  buildGroupName,
  type StudyYear,
} from '../config/fct-faculty-config';
import { AppError } from '../middleware/errorHandler';

export type RegisterOptionsProgram = {
  code: string;
  name: string;
  years: StudyYear[];
  pathways: { code: string; name: string }[];
  groups: {
    id: string;
    name: string;
    studyYear: StudyYear;
    pathwayCode?: string;
    batchYearLabel?: string;
  }[];
};

const EXTRA_BATCH_YEARS_BY_GROUP: Record<string, string[]> = {
  'CS-Y1': ['2023', '2024'],
  'CT-Y1': ['2023', '2024'],
  'ET-Y1': ['2023', '2024'],
};

type EnrollmentGroupOption = RegisterOptionsProgram['groups'][number] & {
  sourceName: string;
  isCanonicalSource: boolean;
};

function extraBatchYearsForGroup(groupName: string, parsed: {
  programCode: string;
  studyYear: StudyYear;
  pathwayCode?: string;
}): string[] {
  const canonicalName = buildGroupName(parsed.programCode, parsed.studyYear, parsed.pathwayCode);
  return [
    ...new Set([
      ...(EXTRA_BATCH_YEARS_BY_GROUP[canonicalName] ?? []),
      ...(EXTRA_BATCH_YEARS_BY_GROUP[groupName] ?? []),
    ]),
  ];
}

function isCanonicalEnrollmentGroupName(
  groupName: string,
  parsed: { programCode: string; studyYear: StudyYear; pathwayCode?: string },
): boolean {
  const canonicalName = buildGroupName(parsed.programCode, parsed.studyYear, parsed.pathwayCode);
  return groupName.trim().toUpperCase() === canonicalName.toUpperCase();
}

/** One Y1 option per batch year; prefer canonical groups like CS-Y1 over legacy aliases. */
function dedupeY1BatchEnrollmentGroups(groups: EnrollmentGroupOption[]): RegisterOptionsProgram['groups'] {
  const passthrough: EnrollmentGroupOption[] = [];
  const y1ByBatch = new Map<string, EnrollmentGroupOption>();

  for (const entry of groups) {
    if (entry.studyYear === 'Y1' && !entry.pathwayCode && entry.batchYearLabel) {
      const existing = y1ByBatch.get(entry.batchYearLabel);
      if (!existing) {
        y1ByBatch.set(entry.batchYearLabel, entry);
      } else if (entry.isCanonicalSource && !existing.isCanonicalSource) {
        y1ByBatch.set(entry.batchYearLabel, entry);
      }
      continue;
    }
    passthrough.push(entry);
  }

  return [...passthrough, ...y1ByBatch.values()].map(({ sourceName: _s, isCanonicalSource: _c, ...rest }) => rest);
}

function parseGroupEnrollment(name: string): {
  programCode: string;
  studyYear: StudyYear;
  pathwayCode?: string;
  batchYearLabel?: string;
} | null {
  const trimmed = name.trim();
  const match = trimmed.match(/^(CS|ET|CT|BS)-Y([1-4])(?:-([A-Z0-9]+))?/i);
  if (!match) return null;
  const program = PROGRAMS.find((p) => p.code === match[1].toUpperCase());
  const studyYear = `Y${match[2]}` as StudyYear;
  const suffix = match[3]?.toUpperCase();
  const pathwayCode =
    suffix && YEARS_WITH_PATHWAYS.includes(studyYear) && program?.pathways.some((p) => p.code === suffix)
      ? suffix
      : undefined;
  const batchYearLabel =
    suffix && !pathwayCode && YEARS_WITHOUT_PATHWAYS.includes(studyYear)
      ? normalizeBatchYearLabel(suffix)
      : undefined;
  return { programCode: match[1].toUpperCase(), studyYear, pathwayCode, batchYearLabel };
}

function normalizeBatchYearLabel(value: string | number | null | undefined): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) return undefined;
  const twoDigit = raw.match(/^(\d{2})$/);
  if (twoDigit) return `20${twoDigit[1]}`;
  const fourDigit = raw.match(/^(20\d{2})$/);
  return fourDigit ? fourDigit[1] : undefined;
}

function inferBatchYearFromTableTitle(title: string): string | undefined {
  const compact = title.trim();
  if (!compact) return undefined;
  const fullYear = compact.match(/\b(20\d{2})\b/);
  if (fullYear) return fullYear[1];
  const shortYear = compact.match(/\b(\d{2})\b/);
  return shortYear ? `20${shortYear[1]}` : undefined;
}

function formatEnrollmentGroupName(
  groupName: string,
  parsed: { programCode: string; studyYear: StudyYear; pathwayCode?: string; batchYearLabel?: string },
): string {
  if (parsed.studyYear === 'Y1' && parsed.batchYearLabel) {
    return `${parsed.studyYear}-${parsed.programCode}-${parsed.batchYearLabel.slice(-2)}`;
  }
  return groupName;
}

function parseAnyGroupEnrollment(name: string): {
  programCode: string;
  studyYear: StudyYear;
  pathwayCode?: string;
  batchYearLabel?: string;
} | null {
  const canonical = parseGroupEnrollment(name);
  if (canonical) return canonical;

  const yFirst = name.trim().match(/^Y([1-4])[-\s]+(CS|ET|CT|BS|BST)(?:[-\s]+([A-Z0-9]+))?/i);
  if (!yFirst) return null;
  const studyYear = `Y${yFirst[1]}` as StudyYear;
  const programCode = yFirst[2].toUpperCase() === 'BST' ? 'BS' : yFirst[2].toUpperCase();
  const program = PROGRAMS.find((p) => p.code === programCode);
  const suffix = yFirst[3]?.toUpperCase();
  const pathwayCode =
    suffix && YEARS_WITH_PATHWAYS.includes(studyYear) && program?.pathways.some((p) => p.code === suffix)
      ? suffix
      : undefined;
  const batchYearLabel =
    suffix && !pathwayCode && YEARS_WITHOUT_PATHWAYS.includes(studyYear)
      ? normalizeBatchYearLabel(suffix)
      : undefined;
  return { programCode, studyYear, pathwayCode, batchYearLabel };
}

export async function getRegisterOptions(): Promise<{ programs: RegisterOptionsProgram[] }> {
  const groups = await prisma.studentGroup.findMany({
    select: { id: true, name: true, batchLabel: true, batchYear: true },
    orderBy: { name: 'asc' },
  });
  const timetableTables = await prisma.timetableTableSnapshot.findMany({
    select: { groupName: true, tableTitle: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  const latestBatchYearByGroup = new Map<string, string>();
  for (const table of timetableTables) {
    if (latestBatchYearByGroup.has(table.groupName)) continue;
    const batchYear = inferBatchYearFromTableTitle(table.tableTitle);
    if (batchYear) latestBatchYearByGroup.set(table.groupName, batchYear);
  }

  const groupsByProgram = new Map<string, EnrollmentGroupOption[]>();
  for (const group of groups) {
    const parsed = parseAnyGroupEnrollment(group.name);
    if (!parsed) continue;
    const batchYearLabel =
      parsed.batchYearLabel ??
      normalizeBatchYearLabel(group.batchLabel) ??
      latestBatchYearByGroup.get(group.name) ??
      normalizeBatchYearLabel(group.batchYear);
    const list = groupsByProgram.get(parsed.programCode) ?? [];
    const isCanonicalSource = isCanonicalEnrollmentGroupName(group.name, parsed);
    const toOption = (label: string | undefined): EnrollmentGroupOption => ({
      id: group.id,
      name: formatEnrollmentGroupName(group.name, { ...parsed, batchYearLabel: label }),
      studyYear: parsed.studyYear,
      pathwayCode: parsed.pathwayCode,
      batchYearLabel: label,
      sourceName: group.name,
      isCanonicalSource,
    });
    const groupOptions: EnrollmentGroupOption[] = [toOption(batchYearLabel)];
    for (const extraBatchYear of extraBatchYearsForGroup(group.name, parsed)) {
      if (extraBatchYear === batchYearLabel) continue;
      groupOptions.push(toOption(extraBatchYear));
    }
    list.push(...groupOptions);
    groupsByProgram.set(parsed.programCode, list);
  }

  return {
    programs: PROGRAMS.map((p) => ({
      code: p.code,
      name: p.name,
      years: [...p.years],
      pathways: p.pathways.map((pw) => ({ code: pw.code, name: pw.name })),
      groups: dedupeY1BatchEnrollmentGroups(groupsByProgram.get(p.code) ?? []),
    })),
  };
}

export function validateStudentEnrollmentInput(
  programCode: string,
  studyYear: string,
  pathwayCode?: string | null,
): { programCode: string; studyYear: StudyYear; pathwayCode?: string } {
  const program = PROGRAMS.find((p) => p.code === programCode.toUpperCase());
  if (!program) {
    throw new AppError('Invalid degree program. Choose CS, ET, CT, or BS.', 400);
  }

  const year = studyYear.toUpperCase() as StudyYear;
  if (!program.years.includes(year)) {
    throw new AppError(`${program.name} does not have study year ${year}.`, 400);
  }

  const needsPathway =
    YEARS_WITH_PATHWAYS.includes(year) && program.pathways.length > 0;

  if (needsPathway) {
    if (!pathwayCode?.trim()) {
      throw new AppError('Pathway is required for 3rd and 4th year students.', 400);
    }
    const pw = program.pathways.find((p) => p.code === pathwayCode.toUpperCase());
    if (!pw) {
      throw new AppError('Invalid pathway for the selected program.', 400);
    }
    return { programCode: program.code, studyYear: year, pathwayCode: pw.code };
  }

  if (pathwayCode?.trim()) {
    throw new AppError('Pathway is only required for 3rd and 4th year.', 400);
  }

  return { programCode: program.code, studyYear: year };
}

export async function resolveStudentGroupId(
  programCode: string,
  studyYear: StudyYear,
  pathwayCode?: string,
): Promise<string> {
  const groupName = buildGroupName(programCode, studyYear, pathwayCode);
  const group = await prisma.studentGroup.findFirst({
    where: { name: groupName },
    select: { id: true },
  });

  if (!group) {
    throw new AppError(
      `Student group "${groupName}" is not set up. Ask admin to run faculty seed or create the group.`,
      404,
    );
  }

  return group.id;
}

async function resolveExactStudentGroup(
  groupId: string,
  programCode: string,
  studyYear: StudyYear,
  pathwayCode: string | undefined,
  departmentId: string,
): Promise<{ id: string; name: string; departmentId: string }> {
  const group = await prisma.studentGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
    },
  });
  if (!group) throw new AppError('Selected class batch was not found.', 404);

  const parsed = parseAnyGroupEnrollment(group.name);
  if (!parsed) throw new AppError('Selected class batch is not valid for student enrollment.', 400);
  if (parsed.programCode !== programCode || parsed.studyYear !== studyYear) {
    throw new AppError('Selected class batch does not match the chosen program and study year.', 400);
  }
  if (pathwayCode && parsed.pathwayCode && parsed.pathwayCode !== pathwayCode) {
    throw new AppError('Selected class batch does not match the chosen pathway.', 400);
  }

  return { id: group.id, name: group.name, departmentId };
}

function groupMatchesEnrollment(
  groupName: string,
  programCode: string,
  studyYear: StudyYear,
  pathwayCode?: string,
): boolean {
  const parsed = parseAnyGroupEnrollment(groupName);
  if (!parsed) return false;
  if (parsed.programCode !== programCode || parsed.studyYear !== studyYear) return false;
  if (pathwayCode && parsed.pathwayCode && parsed.pathwayCode !== pathwayCode) return false;
  return true;
}

export async function assignStudentToGroup(
  studentId: string,
  programCode: string,
  studyYear: StudyYear,
  pathwayCode?: string,
  groupId?: string,
  selectedBatchYearLabel?: string | null,
): Promise<{ groupId: string; groupName: string; departmentId: string }> {
  const department = await prisma.department.findFirst({
    where: { code: programCode },
    select: { id: true },
  });
  if (!department) {
    throw new AppError(`Department for program ${programCode} not found. Run db:seed.`, 500);
  }

  let resolvedGroup: { id: string; name: string; departmentId: string };

  if (groupId) {
    const candidate = await prisma.studentGroup.findUnique({
      where: { id: groupId },
      select: { id: true, name: true },
    });
    if (candidate && groupMatchesEnrollment(candidate.name, programCode, studyYear, pathwayCode)) {
      resolvedGroup = await resolveExactStudentGroup(
        groupId,
        programCode,
        studyYear,
        pathwayCode,
        department.id,
      );
    } else {
      resolvedGroup = {
        id: await resolveStudentGroupId(programCode, studyYear, pathwayCode),
        name: buildGroupName(programCode, studyYear, pathwayCode),
        departmentId: department.id,
      };
    }
  } else {
    resolvedGroup = {
      id: await resolveStudentGroupId(programCode, studyYear, pathwayCode),
      name: buildGroupName(programCode, studyYear, pathwayCode),
      departmentId: department.id,
    };
  }

  await prisma.studentGroupMember.deleteMany({ where: { studentId } });
  await prisma.studentGroupMember.create({
    data: {
      studentId,
      groupId: resolvedGroup.id,
      selectedBatchYearLabel: normalizeBatchYearLabel(selectedBatchYearLabel) || null,
    },
  });

  await prisma.user.update({
    where: { id: studentId },
    data: { departmentId: department.id },
  });

  return { groupId: resolvedGroup.id, groupName: resolvedGroup.name, departmentId: department.id };
}
