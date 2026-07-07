import prisma from '../config/database';
import { formatBatchTableTitle, extractBatchYearLabel, normalizeBatchYearLabel } from '../config/fct-faculty-config';
import { resolveGroupIdsForStudent, parseEnrollmentFromGroupName } from './studentGroupResolver';
import { getPublishedGridForGroup } from './timetableTableService';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import {
  getCatalogForEnrollment,
  getCatalogForProgramYear,
  normalizeCourseCode,
  isValidFacultyCourseCode,
  looksLikePersonName,
  resolveCourseDisplayTitle,
  inferProgramFromCoursePrefix,
  baseCourseCode,
} from './handbookCatalogService';
import { CourseRequirementType } from '../generated/prisma/client';
import {
  filterGridByVisibleCourseCodes,
  mergeElectiveCellsFromGrids,
} from './timetableGridFilter';
import {
  fetchMasterEntriesForLecturer,
  getLecturerCodes,
  syncTeachingScheduleFromMaster,
} from './lecturerTimetableService';

const SLOT_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  semester: true,
  year: true,
  month: true,
  week: true,
  lecturerInitials: true,
  notes: true,
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true, doorPassword: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
};

export interface TimetableSlot {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  semester: number;
  year: number;
  month: number;
  week: number;
  lecturerInitials: string | null;
  notes: string | null;
  course: { id: string; name: string; code: string };
  lecturer: { id: string; firstName: string; lastName: string; designation: string | null; email: string };
  hall: { id: string; name: string; building: string; capacity: number; doorPassword?: string | null };
  group: { id: string; name: string; batchYear: number; batchLabel: string | null };
}

export type WeeklyTimetable = Record<string, TimetableSlot[]>;

const DAY_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

function organizeByDay(entries: TimetableSlot[]): WeeklyTimetable {
  const weekly: WeeklyTimetable = {};
  for (const day of DAY_ORDER) {
    weekly[day] = [];
  }
  for (const entry of entries) {
    if (!weekly[entry.dayOfWeek]) weekly[entry.dayOfWeek] = [];
    weekly[entry.dayOfWeek].push(entry);
  }
  for (const day of Object.keys(weekly)) {
    weekly[day].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }
  return weekly;
}

function deduplicateEntries(entries: TimetableSlot[]): TimetableSlot[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

function slotIdentity(s: TimetableSlot): string {
  return `${s.course.id}|${s.dayOfWeek}|${s.startTime}|${s.endTime}`;
}

async function fetchElectiveSlotsForProgramYear(
  programCode: string,
  studyYear: number,
  courseIds: string[],
  courseCodes: string[],
  period?: { year: number; month: number; week: number },
  allowPeriodFallback = false,
): Promise<TimetableSlot[]> {
  if (courseIds.length === 0 && courseCodes.length === 0) return [];

  const baseCodes = new Set(courseCodes.map((c) => baseCourseCode(c)));
  const candidateCourses = await prisma.course.findMany({
    where: {
      OR: [
        ...(courseIds.length > 0 ? [{ id: { in: courseIds } }] : []),
        ...[...baseCodes].flatMap((bc) => {
          const [prefix, num] = bc.split('-');
          return [
            { code: { contains: num, mode: 'insensitive' as const } },
            { code: { contains: `${prefix}${num}`, mode: 'insensitive' as const } },
            { code: { contains: `${prefix}-${num}`, mode: 'insensitive' as const } },
            { code: { contains: `${prefix} ${num}`, mode: 'insensitive' as const } },
          ];
        }),
      ],
    },
    select: { id: true, code: true },
  });
  const resolvedIds = [
    ...new Set(
      candidateCourses
        .filter((c) => baseCodes.has(baseCourseCode(c.code)) || courseIds.includes(c.id))
        .map((c) => c.id),
    ),
  ];
  if (resolvedIds.length === 0) return [];

  const prefix = `${programCode}-Y${studyYear}`;
  const groups = await prisma.studentGroup.findMany({
    where: { name: { startsWith: prefix, mode: 'insensitive' } },
    select: { id: true },
  });
  if (groups.length === 0) return [];

  const querySlots = (usePeriod?: { year: number; month: number; week: number }) =>
    prisma.masterTimetable.findMany({
      where: {
        groupId: { in: groups.map((g) => g.id) },
        courseId: { in: resolvedIds },
        isActive: true,
        ...(usePeriod ? { year: usePeriod.year, month: usePeriod.month, week: usePeriod.week } : {}),
      },
      select: SLOT_SELECT,
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }) as Promise<TimetableSlot[]>;

  if (period) {
    const periodSlots = await querySlots(period);
    if (periodSlots.length > 0 || !allowPeriodFallback) return periodSlots;
  }
  return querySlots();
}

function dedupePathwayCatalogRows<T extends { course: { code: string }; handbookTitle: string | null }>(
  rows: T[],
): T[] {
  const byCode = new Map<string, T>();
  for (const row of rows) {
    const key = normalizeCourseCode(row.course.code);
    const prev = byCode.get(key);
    if (!prev || (row.handbookTitle?.trim() && !prev.handbookTitle?.trim())) {
      byCode.set(key, row);
    }
  }
  return [...byCode.values()];
}

function buildVisibleCourseCodes(
  catalog: Array<{ courseId: string; code: string; requirementType: CourseRequirementType }>,
  _compulsoryIds: Set<string>,
  selected: Set<string>,
): Set<string> {
  const visible = new Set<string>();
  for (const item of catalog) {
    if (item.requirementType === CourseRequirementType.COMPULSORY) {
      visible.add(item.code);
      continue;
    }
    if (selected.has(item.courseId)) {
      visible.add(item.code);
    }
  }
  return visible;
}

/** CT/CS/ET shared prefixes that may appear under a program via handbook sync. */
const CT_PROGRAM_PREFIXES = new Set([
  'GTEC', 'CTEC', 'CTNT', 'SWST', 'GANI', 'DELT', 'ENPR', 'LNPR', 'GCPR', 'MGMT',
]);
const CS_PROGRAM_PREFIXES = new Set([
  'CSCI', 'AINT', 'DSCI', 'CSEC', 'SPCS', 'SCOM', 'DELT', 'ENPR', 'LNPR', 'GCPR', 'MGMT',
]);
const ET_PROGRAM_PREFIXES = new Set(['ETEC', 'ETIA', 'ETMP', 'ETST', 'GTEC', 'DELT', 'ENPR', 'GCPR', 'LNPR']);

function courseBelongsToProgram(code: string, programCode: string): boolean {
  const prefix = normalizeCourseCode(code).split('-')[0] ?? '';
  const prog = programCode.toUpperCase();
  const inferred = inferProgramFromCoursePrefix(normalizeCourseCode(code));
  if (inferred === prog) return true;
  if (prog === 'CT' && CT_PROGRAM_PREFIXES.has(prefix)) return true;
  if (prog === 'CS' && CS_PROGRAM_PREFIXES.has(prefix)) return true;
  if (prog === 'ET' && ET_PROGRAM_PREFIXES.has(prefix)) return true;
  return false;
}

type ModuleCatalogItem = {
  courseId: string;
  code: string;
  name: string;
  requirementType: CourseRequirementType;
  credits: number | null;
};

export type StudentModuleCatalog = {
  catalog: ModuleCatalogItem[];
  electiveCourseIds: string[];
  compulsoryIds: Set<string>;
  compulsoryCourseCodes: Set<string>;
};

export async function buildStudentModuleCatalog(
  programCode: string,
  studyYear: number,
  pathwayCode: string | null,
): Promise<StudentModuleCatalog> {
  const prog = programCode.toUpperCase();
  const studentPathway = pathwayCode?.trim().toUpperCase() ?? '';
  const [pathwayCatalogRows, allYearCatalogRows] = await Promise.all([
    getCatalogForEnrollment(prog, studyYear, pathwayCode),
    getCatalogForProgramYear(prog, studyYear),
  ]);

  const pathwayRows = dedupePathwayCatalogRows(pathwayCatalogRows);

  const compulsoryCourseCodes = new Set(
    pathwayRows
      .filter((r) => r.requirementType === CourseRequirementType.COMPULSORY)
      .map((r) => normalizeCourseCode(r.course.code)),
  );

  const compulsoryIds = new Set(
    pathwayRows
      .filter((r) => r.requirementType === CourseRequirementType.COMPULSORY)
      .map((r) => r.courseId),
  );

  const catalogMap = new Map<string, ModuleCatalogItem>();

  const addCatalogRow = (
    courseId: string,
    code: string,
    name: string,
    requirementType: CourseRequirementType,
    credits: number | null,
    handbookTitle?: string | null,
  ) => {
    if (!isValidFacultyCourseCode(code)) return;
    if (!courseBelongsToProgram(code, prog)) return;
    const normalized = normalizeCourseCode(code);
    const displayName = resolveCourseDisplayTitle(code, name, handbookTitle);
    if (looksLikePersonName(displayName) || looksLikePersonName(name)) return;

    const existing = catalogMap.get(normalized);
    if (!existing) {
      catalogMap.set(normalized, {
        courseId,
        code: normalized,
        name: displayName,
        requirementType,
        credits,
      });
      return;
    }
    if (requirementType === CourseRequirementType.COMPULSORY) {
      catalogMap.set(normalized, {
        ...existing,
        courseId,
        requirementType,
        name: displayName || existing.name,
      });
      return;
    }
    if (existing.requirementType === CourseRequirementType.COMPULSORY) return;
    catalogMap.set(normalized, {
      ...existing,
      name: displayName || existing.name,
    });
  };

  for (const row of pathwayRows) {
    addCatalogRow(
      row.courseId,
      row.course.code,
      row.course.name,
      row.requirementType,
      row.credits,
      row.handbookTitle,
    );
  }

  for (const row of allYearCatalogRows) {
    if (row.requirementType !== CourseRequirementType.OPTIONAL) continue;
    const code = normalizeCourseCode(row.course.code);
    if (compulsoryCourseCodes.has(code)) continue;
    addCatalogRow(
      row.courseId,
      row.course.code,
      row.course.name,
      CourseRequirementType.OPTIONAL,
      row.credits,
      row.handbookTitle,
    );
  }

  for (const row of allYearCatalogRows) {
    if (row.requirementType !== CourseRequirementType.COMPULSORY) continue;
    const rowPathway = (row.pathwayCode ?? '').toUpperCase();
    if (rowPathway === studentPathway) continue;
    const code = normalizeCourseCode(row.course.code);
    if (compulsoryCourseCodes.has(code)) continue;
    addCatalogRow(
      row.courseId,
      row.course.code,
      row.course.name,
      CourseRequirementType.OPTIONAL,
      row.credits,
      row.handbookTitle,
    );
  }

  const catalog = [...catalogMap.values()].sort((a, b) => {
    if (a.requirementType !== b.requirementType) {
      return a.requirementType === CourseRequirementType.COMPULSORY ? -1 : 1;
    }
    return a.code.localeCompare(b.code);
  });

  const electiveCourseIds = catalog
    .filter((c) => c.requirementType === CourseRequirementType.OPTIONAL)
    .map((c) => c.courseId);

  return { catalog, electiveCourseIds, compulsoryIds, compulsoryCourseCodes };
}

export async function getAllowedElectiveCourseIdsForStudent(studentId: string): Promise<string[]> {
  const membership = await prisma.studentGroupMember.findFirst({
    where: { studentId },
    include: { group: { select: { name: true } } },
  });
  const enrollment = membership?.group
    ? parseEnrollmentFromGroupName(membership.group.name)
    : undefined;
  if (!enrollment || Number(enrollment.studyYear.replace('Y', '')) < 3) return [];

  const { electiveCourseIds } = await buildStudentModuleCatalog(
    enrollment.programCode,
    Number(enrollment.studyYear.replace('Y', '')),
    enrollment.pathwayCode ?? null,
  );
  return electiveCourseIds;
}

async function getEntriesLastUpdated(
  where: Parameters<typeof prisma.masterTimetable.aggregate>[0]['where'],
): Promise<string | null> {
  const result = await prisma.masterTimetable.aggregate({
    where: { ...where, isActive: true },
    _max: { updatedAt: true },
  });
  return result._max.updatedAt?.toISOString() ?? null;
}

async function fetchSiblingGridsForProgramYear(
  programCode: string,
  studyYear: number,
  primaryGroupName: string,
  period: { year: number; month: number; week: number },
  preferredBatchYear?: string | null,
): Promise<TimetableGridSnapshot[]> {
  const prefix = `${programCode}-Y${studyYear}`;
  const groups = await prisma.studentGroup.findMany({
    where: { name: { startsWith: prefix, mode: 'insensitive' } },
    select: { name: true },
  });

  const grids: TimetableGridSnapshot[] = [];
  for (const group of groups) {
    if (group.name.toUpperCase() === primaryGroupName.toUpperCase()) continue;
    const sibling = await getPublishedGridForGroup(group.name, period, preferredBatchYear);
    if (sibling) grids.push(sibling);
  }
  return grids;
}

export type StudentTimetableResult = {
  weekly: WeeklyTimetable;
  flat: TimetableSlot[];
  lastUpdated: string | null;
  enrollment?: { programCode: string; studyYear: string; pathwayCode: string; groupName: string; selectedBatchYearLabel?: string | null };
  /** Faithful FET grid for the student's batch (preferred for My Timetable UI) */
  grid?: TimetableGridSnapshot | null;
  personalization?: {
    supportsModuleSelection: boolean;
    modulesConfigured: boolean;
    selectedCourseIds: string[];
    electiveCourseIds: string[];
    catalog: Array<{
      courseId: string;
      code: string;
      name: string;
      requirementType: CourseRequirementType;
      credits: number | null;
    }>;
  };
};

export async function getStudentTimetable(studentId: string): Promise<StudentTimetableResult> {
  const memberships = await prisma.studentGroupMember.findMany({
    where: { studentId },
    select: { selectedBatchYearLabel: true, group: { select: { id: true, name: true } } },
  });

  const primaryMembership = memberships[0];
  const primaryGroup = primaryMembership?.group;
  const parsedEnrollment = primaryGroup ? parseEnrollmentFromGroupName(primaryGroup.name) : undefined;
  const displayGroupName =
    parsedEnrollment?.studyYear === 'Y1' && parsedEnrollment.programCode && primaryMembership?.selectedBatchYearLabel
      ? `Y1-${parsedEnrollment.programCode}-${primaryMembership.selectedBatchYearLabel.slice(-2)}`
      : primaryGroup?.name;
  const enrollment = primaryGroup
    ? {
        ...parsedEnrollment!,
        groupName: displayGroupName ?? primaryGroup.name,
        selectedBatchYearLabel: primaryMembership?.selectedBatchYearLabel ?? null,
      }
    : undefined;

  const groupIds = await resolveGroupIdsForStudent(studentId);

  if (groupIds.length === 0) {
    return { weekly: organizeByDay([]), flat: [], lastUpdated: null, enrollment };
  }

  const entries = await prisma.masterTimetable.findMany({
    where: { groupId: { in: groupIds }, isActive: true },
    select: SLOT_SELECT,
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  }) as TimetableSlot[];

  let grid: TimetableGridSnapshot | null = null;
  const preferredBatchYear =
    normalizeBatchYearLabel(primaryMembership?.selectedBatchYearLabel) ?? null;
  if (primaryGroup?.name) {
    grid = await getPublishedGridForGroup(primaryGroup.name, undefined, preferredBatchYear);
    if (grid) {
      const friendlyTitle = formatBatchTableTitle(
        primaryGroup.name,
        preferredBatchYear ?? extractBatchYearLabel(grid.tableTitle, primaryGroup.name),
      );
      grid = {
        ...grid,
        tableTitle: friendlyTitle,
        groupName: primaryGroup.name,
      };
    }
  }

  const periodFiltered =
    grid != null
      ? entries.filter(
          (e) => e.year === grid!.year && e.month === grid!.month && e.week === grid!.week,
        )
      : entries;

  const flatMapped = deduplicateEntries(periodFiltered).map((entry) =>
    primaryGroup && displayGroupName && entry.group.name === primaryGroup.name
      ? { ...entry, group: { ...entry.group, name: displayGroupName, batchLabel: primaryMembership?.selectedBatchYearLabel ?? entry.group.batchLabel } }
      : entry,
  );

  let personalization: StudentTimetableResult['personalization'];
  let flat = flatMapped;

  if (parsedEnrollment && Number(parsedEnrollment.studyYear.replace('Y', '')) >= 3) {
    const studyYear = Number(parsedEnrollment.studyYear.replace('Y', ''));
    const programCode = parsedEnrollment.programCode.toUpperCase();
    const [moduleCatalog, moduleConfig] = await Promise.all([
      buildStudentModuleCatalog(programCode, studyYear, parsedEnrollment.pathwayCode ?? null),
      prisma.studentTimetableModuleConfig.findUnique({ where: { studentId } }),
    ]);

    const selections = await prisma.studentCourseSelection.findMany({
      where: { studentId },
      select: { courseId: true },
    });
    const selectedCourseIds = selections.map((s) => s.courseId);
    const modulesConfigured = moduleConfig != null;

    const { catalog, electiveCourseIds, compulsoryIds, compulsoryCourseCodes } = moduleCatalog;

    personalization = {
      supportsModuleSelection: true,
      modulesConfigured,
      selectedCourseIds,
      electiveCourseIds,
      catalog,
    };

    if (modulesConfigured) {
      const selected = new Set(selectedCourseIds);
      const electiveIds = new Set(electiveCourseIds);
      const electiveCodes = new Set(
        catalog
          .filter((c) => c.requirementType === CourseRequirementType.OPTIONAL)
          .map((c) => c.code),
      );
      const selectedElectiveCodes = new Set(
        catalog
          .filter(
            (c) =>
              c.requirementType === CourseRequirementType.OPTIONAL && selected.has(c.courseId),
          )
          .map((c) => c.code),
      );

      flat = flatMapped.filter((slot) => {
        const slotCode = baseCourseCode(slot.course.code);
        if (compulsoryIds.has(slot.course.id) || compulsoryCourseCodes.has(slotCode)) return true;
        if (selectedElectiveCodes.has(slotCode)) return true;
        if (electiveIds.has(slot.course.id)) return selected.has(slot.course.id);
        return false;
      });

      const selectedElectiveIds = catalog
        .filter(
          (c) =>
            c.requirementType === CourseRequirementType.OPTIONAL && selected.has(c.courseId),
        )
        .map((c) => c.courseId);
      const period =
        grid != null
          ? { year: grid.year, month: grid.month, week: grid.week }
          : undefined;
      const supplemental = await fetchElectiveSlotsForProgramYear(
        programCode,
        studyYear,
        selectedElectiveIds,
        [...selectedElectiveCodes],
        period,
      );
      const seen = new Set(flat.map(slotIdentity));
      for (const slot of supplemental) {
        if (seen.has(slotIdentity(slot))) continue;
        seen.add(slotIdentity(slot));
        flat.push(slot);
      }

      if (grid) {
        const visibleCodes = buildVisibleCourseCodes(catalog, compulsoryIds, selected);
        for (const slot of flat) {
          visibleCodes.add(normalizeCourseCode(slot.course.code));
        }
        grid = filterGridByVisibleCourseCodes(grid, visibleCodes);

        const electiveCodesForGrid = new Set(
          catalog
            .filter(
              (c) =>
                c.requirementType === CourseRequirementType.OPTIONAL && selected.has(c.courseId),
            )
            .map((c) => c.code),
        );
        if (electiveCodesForGrid.size > 0 && primaryGroup?.name) {
          const siblings = await fetchSiblingGridsForProgramYear(
            programCode,
            studyYear,
            primaryGroup.name,
            { year: grid.year, month: grid.month, week: grid.week },
            preferredBatchYear,
          );
          grid = mergeElectiveCellsFromGrids(grid, siblings, electiveCodesForGrid);
        }
      }
    }
  }

  const lastUpdated = await getEntriesLastUpdated(
    grid != null
      ? {
          groupId: { in: groupIds },
          year: grid.year,
          month: grid.month,
          week: grid.week,
        }
      : { groupId: { in: groupIds } },
  );

  return { weekly: organizeByDay(flat), flat, lastUpdated, enrollment, grid, personalization };
}

/** Lecturer teaching timetable from admin import (matched by lecturerId + FET initials). */
export async function getLecturerTimetable(lecturerId: string): Promise<{
  weekly: WeeklyTimetable;
  flat: TimetableSlot[];
  lastUpdated: string | null;
  timetableCodes: string[];
  scheduleSlots: {
    id: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    slotType: string;
    label: string | null;
    location: string | null;
  }[];
}> {
  const [flat, timetableCodes, personalSlots] = await Promise.all([
    fetchMasterEntriesForLecturer(lecturerId),
    getLecturerCodes(lecturerId),
    prisma.lecturerScheduleSlot.findMany({
      where: { lecturerId, slotType: { in: ['BUSY', 'OFFICE_HOUR'] } },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
  ]);

  const deduped = deduplicateEntries(flat);

  const orConditions: Array<{ lecturerId: string } | { lecturerInitials: { in: string[] } }> = [
    { lecturerId },
  ];
  if (timetableCodes.length > 0) {
    orConditions.push({ lecturerInitials: { in: timetableCodes } });
  }
  const lastUpdated = await getEntriesLastUpdated({ OR: orConditions });

  // Keep appointment availability in sync with assigned teaching slots.
  await syncTeachingScheduleFromMaster(lecturerId);

  return {
    weekly: organizeByDay(deduped),
    flat: deduped,
    lastUpdated,
    timetableCodes,
    scheduleSlots: personalSlots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      slotType: s.slotType,
      label: s.label,
      location: s.location,
    })),
  };
}
