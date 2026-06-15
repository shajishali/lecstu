import prisma from '../config/database';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import { invalidateAll as invalidateTimetableCache } from './timetableCache';
import { enrichGridFromSlots, normalizeGridSnapshot, type GridSlotRef } from './timetableGridBuilder';
import { backfillSlotRefsForGroup } from './timetableRepairService';
import { getLecturerDisplayIndex } from './lecturerDisplayService';
import { UNASSIGNED_LECTURER_EMAIL } from './conflictDetector';
import { gridSnapshotsToParsedRows, normalizeGridSnapshot } from './timetableGridBuilder';
import { finalizeParsedRows } from './timetableParserService';
import { resolveAndImport } from './timetableImportService';
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

  await prisma.timetableTableSnapshot.update({
    where: { id },
    data: {
      gridData: grid as object,
      tableTitle: grid.tableTitle,
      updatedAt: new Date(),
    },
  });

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

  const rows = finalizeParsedRows(gridSnapshotsToParsedRows([grid]));
  const importResult = await resolveAndImport(rows, undefined, false);
  if (importResult.conflicts.length > 0) {
    throw new AppError(
      importResult.conflicts[0]?.conflicts?.[0]
        ? String((importResult.conflicts[0].conflicts[0] as { message?: string }).message)
        : 'Schedule conflicts detected while saving timetable',
      400,
    );
  }

  await updateSnapshotSlotCount(row.groupName, row.year, row.month, row.week, rows.length);
  invalidateTimetableCache();

  if (importResult.groupIds?.length) {
    await notifyTimetableChange(importResult.groupIds);
  }

  const enriched = await enrichSnapshotGrid(grid, row.groupName);
  return { grid: enriched, imported: importResult.created };
}
