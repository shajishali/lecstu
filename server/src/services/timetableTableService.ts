import prisma from '../config/database';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import { invalidateAll as invalidateTimetableCache } from './timetableCache';
import {
  createEmptyBatchGrid,
  enrichGridFromSlots,
  gridSnapshotsToParsedRows,
  normalizeGridSnapshot,
  type GridSlotRef,
} from './timetableGridBuilder';
import { parseEnrollmentFromGroupName } from './studentGroupResolver';
import { backfillSlotRefsForGroup } from './timetableRepairService';
import { getLecturerDisplayIndex } from './lecturerDisplayService';
import {
  detectConflicts,
  type ConflictInfo,
  PLACEHOLDER_HALL_NAME,
  splitHallDisplayNames,
  UNASSIGNED_LECTURER_EMAIL,
} from './conflictDetector';
import { getOrCreateUnassignedLecturer } from './timetableImportService';
import { finalizeParsedRows } from './timetableParserService';
import { resolveAndImport, formatTimetableConflictSummary } from './timetableImportService';
import { filterStaleCrossBatchHallConflicts } from './timetableSlotVisibility';
import { AppError } from '../middleware/errorHandler';
import { notifyTimetableChange } from './notificationService';

export async function saveTableSnapshots(
  tables: TimetableGridSnapshot[],
  sourceFile: string,
  replacePeriod: boolean,
): Promise<{ saved: number; tableIds: string[] }> {
  const tableIds: string[] = [];
  let saved = 0;

  for (const raw of tables) {
    const table = normalizeGridSnapshot(raw);
    if (replacePeriod) {
      await prisma.timetableTableSnapshot.deleteMany({
        where: {
          groupName: table.groupName,
          year: table.year,
          month: table.month,
        },
      });
    }

    const row = await prisma.timetableTableSnapshot.upsert({
      where: {
        groupName_year_month_week: {
          groupName: table.groupName,
          year: table.year,
          month: table.month,
          week: table.week,
        },
      },
      create: {
        tableTitle: table.tableTitle,
        groupName: table.groupName,
        year: table.year,
        month: table.month,
        week: table.week,
        semester: table.semester,
        gridData: table as object,
        sourceFile,
        slotCount: 0,
        isPublished: true,
      },
      update: {
        tableTitle: table.tableTitle,
        gridData: table as object,
        sourceFile,
        isPublished: true,
        importedAt: new Date(),
      },
    });
    tableIds.push(row.id);
    saved++;
  }

  invalidateTimetableCache();
  return { saved, tableIds };
}

export async function listTableSnapshots(filters?: {
  year?: number;
  month?: number;
  week?: number;
}): Promise<
  {
    id: string;
    tableTitle: string;
    groupName: string;
    year: number;
    month: number;
    week: number;
    slotCount: number;
    importedAt: Date;
    sourceFile: string | null;
  }[]
> {
  const where: { year?: number; month?: number; week?: number } = {};
  if (filters?.year) where.year = filters.year;
  if (filters?.month) where.month = filters.month;
  if (filters?.week) where.week = filters.week;

  return prisma.timetableTableSnapshot.findMany({
    where,
    orderBy: [{ tableTitle: 'asc' }, { groupName: 'asc' }],
    select: {
      id: true,
      tableTitle: true,
      groupName: true,
      year: true,
      month: true,
      week: true,
      slotCount: true,
      importedAt: true,
      sourceFile: true,
    },
  });
}

async function enrichSnapshotGrid(
  grid: TimetableGridSnapshot,
  groupName: string,
): Promise<TimetableGridSnapshot> {
  const slots = await prisma.masterTimetable.findMany({
    where: {
      isActive: true,
      group: { name: { equals: groupName, mode: 'insensitive' } },
    },
    include: {
      course: { select: { name: true } },
      hall: { select: { name: true } },
      lecturer: { select: { firstName: true, lastName: true, email: true } },
    },
  });
  if (slots.length === 0) return grid;
  const lecturerDisplay = await getLecturerDisplayIndex();
  const refs = backfillSlotRefsForGroup(
    groupName,
    slots.map((s) => {
      let lecturerName = s.lecturerInitials?.trim() || undefined;
      if (!lecturerName && s.lecturer.email !== UNASSIGNED_LECTURER_EMAIL) {
        lecturerName = `${s.lecturer.firstName} ${s.lecturer.lastName}`.trim() || undefined;
      }
      return {
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
        courseName: s.course.name,
        hallName: s.hall.name,
        lecturerName,
        hallIsShared: s.hallIsShared === true,
      };
    }),
  );
  return enrichGridFromSlots(normalizeGridSnapshot(grid), refs, { lecturerDisplay });
}

export async function getTableSnapshotById(id: string): Promise<TimetableGridSnapshot | null> {
  const row = await prisma.timetableTableSnapshot.findUnique({ where: { id } });
  if (!row) return null;
  const grid = row.gridData as unknown as TimetableGridSnapshot;
  return enrichSnapshotGrid(grid, row.groupName);
}

export async function getPublishedGridForGroup(
  groupName: string,
  period?: { year?: number; month?: number; week?: number },
): Promise<TimetableGridSnapshot | null> {
  const where: {
    groupName: { equals: string; mode: 'insensitive' };
    isPublished: boolean;
    year?: number;
    month?: number;
    week?: number;
  } = {
    groupName: { equals: groupName, mode: 'insensitive' },
    isPublished: true,
  };
  if (period?.year) where.year = period.year;
  if (period?.month) where.month = period.month;
  if (period?.week) where.week = period.week;

  const row = await prisma.timetableTableSnapshot.findFirst({
    where,
    orderBy: [{ year: 'desc' }, { month: 'desc' }, { week: 'desc' }],
  });
  if (!row) return null;
  const grid = row.gridData as unknown as TimetableGridSnapshot;
  return enrichSnapshotGrid(grid, row.groupName);
}

export async function updateSnapshotSlotCount(groupName: string, year: number, month: number, week: number, count: number) {
  await prisma.timetableTableSnapshot.updateMany({
    where: { groupName, year, month, week },
    data: { slotCount: count },
  });
}

export async function updateTableSnapshotGrid(
  id: string,
  rawGrid: TimetableGridSnapshot,
): Promise<{ grid: TimetableGridSnapshot; imported: number }> {
  const row = await prisma.timetableTableSnapshot.findUnique({ where: { id } });
  if (!row) throw new AppError('Timetable table not found', 404);

  const grid = normalizeGridSnapshot({
    ...rawGrid,
    tableTitle: rawGrid.tableTitle || row.tableTitle,
    groupName: row.groupName,
    year: row.year,
    month: row.month,
    week: row.week,
    semester: rawGrid.semester ?? row.semester,
  });

  const groups = await prisma.studentGroup.findMany({
    where: { name: { equals: row.groupName, mode: 'insensitive' } },
    select: { id: true },
  });
  if (groups.length === 0) {
    throw new AppError(
      `No student group "${row.groupName}" found. Create the group first or fix the batch group code.`,
      400,
    );
  }
  const group = groups[0];
  const groupIds = groups.map((g) => g.id);

  const rows = finalizeParsedRows(gridSnapshotsToParsedRows([grid]));

  const importOpts = { forcedGroupId: group.id, replacingGroupName: row.groupName };

  const validation = await resolveAndImport(rows, undefined, false, group.id, {
    validateOnly: true,
    ...importOpts,
  });
  if (validation.conflicts.length > 0) {
    const { summary, flat } = formatTimetableConflictSummary(validation.conflicts);
    throw new AppError(summary, 409, [{ row: 0, conflicts: flat }]);
  }

  await prisma.masterTimetable.deleteMany({
    where: {
      groupId: { in: groupIds },
      year: row.year,
      month: row.month,
      week: row.week,
    },
  });

  let importResult;
  try {
    importResult = await resolveAndImport(rows, undefined, false, group.id, importOpts);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to sync timetable slots';
    throw new AppError(message, 400);
  }

  if (importResult.conflicts.length > 0) {
    const { summary, flat } = formatTimetableConflictSummary(importResult.conflicts);
    throw new AppError(summary, 409, [{ row: 0, conflicts: flat }]);
  }

  await prisma.timetableTableSnapshot.update({
    where: { id },
    data: {
      gridData: grid as object,
      tableTitle: grid.tableTitle,
      updatedAt: new Date(),
    },
  });

  await updateSnapshotSlotCount(row.groupName, row.year, row.month, row.week, importResult.created);
  invalidateTimetableCache();

  if (importResult.groupIds?.length) {
    try {
      await notifyTimetableChange(importResult.groupIds);
    } catch (err) {
      console.error('Timetable saved but notification failed:', err);
    }
  }

  // Return the stored grid as-is for the editor (enrich on read can shift slot times).
  return { grid, imported: importResult.created };
}

export async function validateTableSlot(
  tableId: string,
  slot: {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    hallName: string;
    sharedHall?: boolean;
  },
): Promise<ConflictInfo[]> {
  const row = await prisma.timetableTableSnapshot.findUnique({ where: { id: tableId } });
  if (!row) throw new AppError('Timetable table not found', 404);

  const group = await prisma.studentGroup.findFirst({
    where: { name: { equals: row.groupName, mode: 'insensitive' } },
    select: { id: true, departmentId: true },
  });
  if (!group) {
    throw new AppError(`No student group "${row.groupName}" found`, 400);
  }

  const rawHall = (slot.hallName || 'TBD').trim();
  const hallIsShared = slot.sharedHall === true;
  if (hallIsShared || !rawHall || rawHall.toUpperCase() === PLACEHOLDER_HALL_NAME) {
    return [];
  }

  const unassignedLecturerId = await getOrCreateUnassignedLecturer(group.departmentId);
  const hallNames = splitHallDisplayNames(rawHall);
  const conflicts: ConflictInfo[] = [];

  for (const hallName of hallNames) {
    if (hallName.toUpperCase() === PLACEHOLDER_HALL_NAME) continue;
    const hall = await prisma.lectureHall.findFirst({
      where: { name: { equals: hallName, mode: 'insensitive' }, isActive: true },
      select: { id: true, name: true },
    });
    if (!hall) continue;

    conflicts.push(
      ...(await detectConflicts({
        year: row.year,
        month: row.month,
        week: row.week,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        hallId: hall.id,
        lecturerId: unassignedLecturerId,
        groupId: group.id,
        hallName: hall.name,
        hallIsShared: hallIsShared,
        replacingGroupId: group.id,
        replacingGroupName: row.groupName,
        unassignedLecturerId,
      })),
    );
  }

  const hallConflicts = conflicts.filter((c) => c.type === 'HALL');
  return filterStaleCrossBatchHallConflicts(
    hallConflicts,
    { year: row.year, month: row.month, week: row.week },
    row.groupName,
  );
}

function studyYearToBatchYear(studyYear: string): number {
  const m = studyYear.match(/^Y([1-4])$/i);
  return m ? parseInt(m[1], 10) : 1;
}

async function getGridTemplateStructure(period?: { year: number; month: number; week: number }) {
  const existing = await prisma.timetableTableSnapshot.findFirst({
    where: period ? { year: period.year, month: period.month, week: period.week } : undefined,
    orderBy: { importedAt: 'desc' },
    select: { gridData: true },
  });
  if (existing) {
    const grid = existing.gridData as unknown as TimetableGridSnapshot;
    if (grid.dayColumns?.length && grid.timeRows?.length) {
      return { dayColumns: grid.dayColumns, timeRows: grid.timeRows };
    }
  }
  return undefined;
}

async function ensureStudentGroup(
  groupName: string,
  departmentId?: string,
): Promise<{ id: string; name: string }> {
  const existing = await prisma.studentGroup.findFirst({
    where: { name: { equals: groupName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  const enrollment = parseEnrollmentFromGroupName(groupName);
  const deptId =
    departmentId ??
    (await prisma.department.findFirst({ select: { id: true } }))?.id;
  if (!deptId) throw new AppError('departmentId is required to create a new student group', 400);

  const created = await prisma.studentGroup.create({
    data: {
      name: groupName,
      batchYear: studyYearToBatchYear(enrollment.studyYear),
      batchLabel: enrollment.studyYear || null,
      departmentId: deptId,
    },
    select: { id: true, name: true },
  });
  return created;
}

export async function createTableSnapshot(input: {
  tableTitle: string;
  groupName: string;
  year: number;
  month: number;
  week: number;
  semester?: number;
  departmentId?: string;
}): Promise<{ id: string; meta: Awaited<ReturnType<typeof listTableSnapshots>>[number] }> {
  const groupName = input.groupName.trim();
  const tableTitle = (input.tableTitle || groupName).trim();
  if (!groupName) throw new AppError('groupName is required', 400);

  const duplicate = await prisma.timetableTableSnapshot.findUnique({
    where: {
      groupName_year_month_week: {
        groupName,
        year: input.year,
        month: input.month,
        week: input.week,
      },
    },
  });
  if (duplicate) {
    throw new AppError('A batch table already exists for this group and period', 409);
  }

  await ensureStudentGroup(groupName, input.departmentId);
  const template = await getGridTemplateStructure({
    year: input.year,
    month: input.month,
    week: input.week,
  });
  const grid = createEmptyBatchGrid({
    tableTitle,
    groupName,
    year: input.year,
    month: input.month,
    week: input.week,
    semester: input.semester,
    dayColumns: template?.dayColumns,
    timeRows: template?.timeRows,
  });

  const row = await prisma.timetableTableSnapshot.create({
    data: {
      tableTitle,
      groupName,
      year: input.year,
      month: input.month,
      week: input.week,
      semester: input.semester ?? 1,
      gridData: grid as object,
      sourceFile: 'admin-manual',
      slotCount: 0,
      isPublished: true,
    },
  });

  invalidateTimetableCache();
  return {
    id: row.id,
    meta: {
      id: row.id,
      tableTitle: row.tableTitle,
      groupName: row.groupName,
      year: row.year,
      month: row.month,
      week: row.week,
      slotCount: row.slotCount,
      importedAt: row.importedAt,
      sourceFile: row.sourceFile,
    },
  };
}

export async function updateTableSnapshotMeta(
  id: string,
  input: {
    tableTitle?: string;
    groupName?: string;
    year?: number;
    month?: number;
    week?: number;
    semester?: number;
    departmentId?: string;
  },
): Promise<{ id: string; meta: Awaited<ReturnType<typeof listTableSnapshots>>[number] }> {
  const row = await prisma.timetableTableSnapshot.findUnique({ where: { id } });
  if (!row) throw new AppError('Timetable table not found', 404);

  const nextGroupName = (input.groupName ?? row.groupName).trim();
  const nextTitle = (input.tableTitle ?? row.tableTitle).trim();
  const nextYear = input.year ?? row.year;
  const nextMonth = input.month ?? row.month;
  const nextWeek = input.week ?? row.week;
  const nextSemester = input.semester ?? row.semester;

  if (!nextGroupName || !nextTitle) throw new AppError('tableTitle and groupName are required', 400);

  const periodChanged =
    nextGroupName !== row.groupName ||
    nextYear !== row.year ||
    nextMonth !== row.month ||
    nextWeek !== row.week;

  if (periodChanged) {
    const clash = await prisma.timetableTableSnapshot.findFirst({
      where: {
        id: { not: id },
        groupName: nextGroupName,
        year: nextYear,
        month: nextMonth,
        week: nextWeek,
      },
    });
    if (clash) throw new AppError('Another batch table already uses this group and period', 409);
  }

  const oldGroup = await prisma.studentGroup.findFirst({
    where: { name: { equals: row.groupName, mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  const newGroup = await ensureStudentGroup(nextGroupName, input.departmentId);

  if (oldGroup && oldGroup.id !== newGroup.id) {
    await prisma.masterTimetable.updateMany({
      where: {
        groupId: oldGroup.id,
        year: row.year,
        month: row.month,
        week: row.week,
      },
      data: { groupId: newGroup.id },
    });
  } else if (periodChanged && oldGroup) {
    await prisma.masterTimetable.updateMany({
      where: {
        groupId: oldGroup.id,
        year: row.year,
        month: row.month,
        week: row.week,
      },
      data: { year: nextYear, month: nextMonth, week: nextWeek },
    });
  }

  const grid = normalizeGridSnapshot({
    ...(row.gridData as unknown as TimetableGridSnapshot),
    tableTitle: nextTitle,
    groupName: nextGroupName,
    year: nextYear,
    month: nextMonth,
    week: nextWeek,
    semester: nextSemester,
  });

  const updated = await prisma.timetableTableSnapshot.update({
    where: { id },
    data: {
      tableTitle: nextTitle,
      groupName: nextGroupName,
      year: nextYear,
      month: nextMonth,
      week: nextWeek,
      semester: nextSemester,
      gridData: grid as object,
      updatedAt: new Date(),
    },
  });

  invalidateTimetableCache();
  return {
    id: updated.id,
    meta: {
      id: updated.id,
      tableTitle: updated.tableTitle,
      groupName: updated.groupName,
      year: updated.year,
      month: updated.month,
      week: updated.week,
      slotCount: updated.slotCount,
      importedAt: updated.importedAt,
      sourceFile: updated.sourceFile,
    },
  };
}

export async function deleteTableSnapshot(id: string): Promise<void> {
  const row = await prisma.timetableTableSnapshot.findUnique({ where: { id } });
  if (!row) throw new AppError('Timetable table not found', 404);

  const group = await prisma.studentGroup.findFirst({
    where: { name: { equals: row.groupName, mode: 'insensitive' } },
    select: { id: true },
  });

  if (group) {
    await prisma.masterTimetable.deleteMany({
      where: {
        groupId: group.id,
        year: row.year,
        month: row.month,
        week: row.week,
      },
    });
  }

  await prisma.timetableTableSnapshot.delete({ where: { id } });
  invalidateTimetableCache();
}
