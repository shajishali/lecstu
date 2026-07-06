import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { invalidateAll as invalidateTimetableCache } from '../services/timetableCache';
import { resolveGroupIdToCanonical } from '../services/studentGroupResolver';
import { notifyTimetableChange, notifyTimetableChangeBroadcast } from '../services/notificationService';
import {
  parseTimetableFile,
  buildTimetableImportTemplate,
  formatShortCourseDisplay,
  type ParsedTimetableRow,
} from '../services/timetableParserService';
import { resolveAndImport } from '../services/timetableImportService';
import { detectConflicts } from '../services/conflictDetector';
import {
  saveTableSnapshots,
  listTableSnapshots,
  getTableSnapshotById,
  updateSnapshotSlotCount,
  updateTableSnapshotGrid,
  createTableSnapshot,
  updateTableSnapshotMeta,
  deleteTableSnapshot,
  validateTableSlot,
} from '../services/timetableTableService';
import type { TimetableGridSnapshot } from '../types/timetableGrid';
import { gridSnapshotsToParsedRows, normalizeGridSnapshot } from '../services/timetableGridBuilder';
import { finalizeParsedRows } from '../services/timetableParserService';

export type TimetableImportEntry = {
  id: string;
  year: number;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  courseName: string;
  lecturerName: string;
  lecturerEmail: string;
  hallName: string;
  groupName: string;
  semester: number;
  month: number;
  week: number;
};

function rowsToImportEntries(rows: ParsedTimetableRow[]): TimetableImportEntry[] {
  return rows.map((r, i) => ({
    id: `row-${i}-${r.courseCode}-${r.startTime}`,
    year: r.year,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    courseCode: r.courseCode,
    courseName: r.courseName,
    lecturerName: r.lecturerName || '',
    lecturerEmail: r.lecturerEmail || '',
    hallName: r.hallName,
    groupName: r.groupName,
    semester: r.semester ?? 1,
    month: r.month ?? 1,
    week: r.week ?? 1,
  }));
}

function entriesToParsedRows(entries: TimetableImportEntry[]): ParsedTimetableRow[] {
  return entries
    .map((e) => ({
      year: e.year ?? 2026,
      month: e.month ?? 1,
      week: e.week ?? 1,
      dayOfWeek: e.dayOfWeek,
      startTime: e.startTime,
      endTime: e.endTime,
      courseCode: (e.courseCode || 'UNKNOWN').trim().toUpperCase(),
      courseName: formatShortCourseDisplay(e.courseName || e.courseCode || '', e.courseCode || 'UNKNOWN'),
      lecturerEmail: (e.lecturerEmail || '').trim().toLowerCase(),
      lecturerName: e.lecturerName?.trim() || undefined,
      hallName: (e.hallName || 'TBD').trim(),
      groupName: (e.groupName || '').trim(),
      semester: e.semester ?? 1,
    }))
    .filter((r) => r.groupName && r.dayOfWeek && r.startTime && r.endTime);
}

const INCLUDE_RELATIONS = {
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
};

const TIMETABLE_LIST_SELECT = {
  id: true,
  year: true,
  month: true,
  week: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  semester: true,
  lecturerInitials: true,
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true } },
  group: { select: { id: true, name: true, batchYear: true, batchLabel: true } },
} as const;

export async function listTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      page = '1',
      limit = '20',
      dayOfWeek,
      lecturerId,
      hallId,
      groupId,
      courseId,
      semester,
      year,
      month,
      week,
      search,
    } = req.query as Record<string, string>;

    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pg - 1) * lim;

    const where: any = { isActive: true };
    if (dayOfWeek) where.dayOfWeek = dayOfWeek;
    if (lecturerId) where.lecturerId = lecturerId;
    if (hallId) where.hallId = hallId;
    if (groupId) where.groupId = groupId;
    if (courseId) where.courseId = courseId;
    if (semester) where.semester = parseInt(semester);
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (week) where.week = parseInt(week);
    if (search) {
      where.OR = [
        { course: { name: { contains: search, mode: 'insensitive' } } },
        { course: { code: { contains: search, mode: 'insensitive' } } },
        { lecturer: { firstName: { contains: search, mode: 'insensitive' } } },
        { lecturer: { lastName: { contains: search, mode: 'insensitive' } } },
        { hall: { name: { contains: search, mode: 'insensitive' } } },
        { group: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.masterTimetable.findMany({
        where,
        select: TIMETABLE_LIST_SELECT,
        orderBy: [
          { year: 'asc' },
          { month: 'asc' },
          { week: 'asc' },
          { dayOfWeek: 'asc' },
          { startTime: 'asc' },
        ],
        skip,
        take: lim,
      }),
      prisma.masterTimetable.count({ where }),
    ]);

    res.json({
      success: true,
      data,
      pagination: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
    });
  } catch (err) {
    next(err);
  }
}

export async function getTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const entry = await prisma.masterTimetable.findUnique({
      where: { id },
      include: INCLUDE_RELATIONS,
    });
    if (!entry) throw new AppError('Timetable entry not found', 404);
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function createTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const { year, month, week, dayOfWeek, startTime, endTime, semester, courseId, lecturerId, hallId, groupId } = req.body;

    if (startTime >= endTime) throw new AppError('Start time must be before end time', 400);

    const resolvedGroupId = await resolveGroupIdToCanonical(groupId);

    const conflicts = await detectConflicts({
      year: year ?? 2026,
      month: month ?? 1,
      week: week ?? 1,
      dayOfWeek,
      startTime,
      endTime,
      hallId,
      lecturerId,
      groupId: resolvedGroupId,
    });
    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Schedule conflicts detected', conflicts });
      return;
    }

    const entry = await prisma.masterTimetable.create({
      data: {
        year: year ?? 2026,
        month: month ?? 1,
        week: week ?? 1,
        dayOfWeek,
        startTime,
        endTime,
        semester: semester || 1,
        courseId,
        lecturerId,
        hallId,
        groupId: resolvedGroupId,
      },
      include: INCLUDE_RELATIONS,
    });

    invalidateTimetableCache();
    await notifyTimetableChange([resolvedGroupId]);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function updateTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.masterTimetable.findUnique({ where: { id } });
    if (!existing) throw new AppError('Timetable entry not found', 404);

    const merged = { ...existing, ...req.body };
    if (merged.startTime >= merged.endTime) throw new AppError('Start time must be before end time', 400);

    if (req.body.groupId) {
      merged.groupId = await resolveGroupIdToCanonical(req.body.groupId);
    }

    const conflicts = await detectConflicts({
      year: merged.year ?? 2026,
      month: merged.month ?? 1,
      week: merged.week ?? 1,
      dayOfWeek: merged.dayOfWeek,
      startTime: merged.startTime,
      endTime: merged.endTime,
      hallId: merged.hallId,
      lecturerId: merged.lecturerId,
      groupId: merged.groupId,
      excludeId: id,
    });
    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Schedule conflicts detected', conflicts });
      return;
    }

    const entry = await prisma.masterTimetable.update({
      where: { id },
      data: req.body,
      include: INCLUDE_RELATIONS,
    });

    invalidateTimetableCache();
    await notifyTimetableChange([entry.groupId]);
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
}

export async function deleteTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.masterTimetable.findUnique({ where: { id } });
    if (!existing) throw new AppError('Timetable entry not found', 404);

    await prisma.masterTimetable.delete({ where: { id } });
    invalidateTimetableCache();
    await notifyTimetableChange([existing.groupId]);
    res.json({ success: true, message: 'Timetable entry deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getDropdownData(_req: Request, res: Response, next: NextFunction) {
  try {
    const [courses, lecturers, halls, groups] = await Promise.all([
      prisma.course.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { code: 'asc' } }),
      prisma.user.findMany({ where: { role: 'LECTURER' }, select: { id: true, firstName: true, lastName: true, designation: true, email: true }, orderBy: { firstName: 'asc' } }),
      prisma.lectureHall.findMany({ where: { isActive: true }, select: { id: true, name: true, building: true, capacity: true }, orderBy: { name: 'asc' } }),
      prisma.studentGroup.findMany({
        select: {
          id: true,
          name: true,
          batchYear: true,
          batchLabel: true,
          _count: {
            select: {
              members: true,
              timetableEntries: { where: { isActive: true } },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const groupsWithMeta = groups.map((g) => ({
      id: g.id,
      name: g.name,
      batchYear: g.batchYear,
      batchLabel: g.batchLabel,
      memberCount: g._count.members,
      entryCount: g._count.timetableEntries,
    }));

    res.json({ success: true, data: { courses, lecturers, halls, groups: groupsWithMeta } });
  } catch (err) {
    next(err);
  }
}

export async function bulkImportTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = buildTimetableImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="timetable-import-template.xlsx"');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function bulkImportPreview(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file?.buffer) throw new AppError('CSV, Excel, or PDF file is required', 400);

    const parseResult = await parseTimetableFile(
      req.file.buffer,
      req.file.originalname || '',
    );

    if (parseResult.rows.length === 0 && (parseResult.tables?.length ?? 0) === 0) {
      const detail = parseResult.errors[0]?.message;
      res.status(400).json({
        success: false,
        message: detail || 'Could not parse file',
        validationErrors: parseResult.errors,
        preview: [],
        total: 0,
      });
      return;
    }

    res.json({
      success: true,
      entries: rowsToImportEntries(parseResult.rows),
      tables: parseResult.tables ?? [],
      total: parseResult.rows.length,
      tableCount: parseResult.tables?.length ?? 0,
      validationErrors: parseResult.errors,
    });
  } catch (err) {
    next(err);
  }
}

export async function bulkImportConfirm(req: Request, res: Response, next: NextFunction) {
  try {
    const replacePeriod = req.body?.replacePeriod === true || req.body?.replacePeriod === 'true';
    const rawTables = (req.body?.tables ?? []) as TimetableGridSnapshot[];
    const tables = rawTables.map(normalizeGridSnapshot);
    const raw = req.body?.entries;
    const entries = Array.isArray(raw) ? (raw as TimetableImportEntry[]) : [];

    let rows: ParsedTimetableRow[];
    if (tables.length > 0) {
      rows = finalizeParsedRows(gridSnapshotsToParsedRows(tables));
    } else if (entries.length > 0) {
      rows = entriesToParsedRows(entries);
    } else {
      throw new AppError('No timetable tables or entries to import', 400);
    }

    if (rows.length === 0) {
      throw new AppError('No classes found in timetable tables', 400);
    }

    if (tables.length > 0) {
      await saveTableSnapshots(tables, 'admin-confirm', replacePeriod);
    }

    const importResult = await resolveAndImport(rows, undefined, replacePeriod);
    const { created, conflicts, stats } = importResult;

    if (conflicts.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Schedule conflicts detected',
        conflicts,
        summary: {
          total: rows.length,
          imported: 0,
          conflicting: conflicts.length,
        },
      });
      return;
    }

    for (const t of tables) {
      const count = rows.filter((r) => r.groupName === t.groupName).length;
      await updateSnapshotSlotCount(t.groupName, t.year, t.month, t.week, count);
    }

    invalidateTimetableCache();
    if (created > 0) {
      await notifyTimetableChangeBroadcast();
    }

    res.status(201).json({
      success: true,
      message: `Imported ${tables.length} table(s) and ${created} slot(s).`,
      summary: {
        total: rows.length,
        imported: created,
        tablesSaved: tables.length,
        autoCreated: stats.created,
        unassignedLecturer: stats.unassignedCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function bulkImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file || !req.file.buffer) throw new AppError('CSV, Excel, or PDF file is required', 400);

    const parseResult = await parseTimetableFile(
      req.file.buffer,
      req.file.originalname || '',
    );
    const replacePeriod = req.body?.replacePeriod === 'true' || req.body?.replacePeriod === true;

    if (parseResult.errors.length > 0 && parseResult.rows.length === 0 && (parseResult.tables?.length ?? 0) === 0) {
      res.status(400).json({
        success: false,
        message: 'Could not parse file',
        validationErrors: parseResult.errors,
        conflicts: [],
        summary: { total: 0, valid: 0, errors: parseResult.errors.length, conflicting: 0 },
      });
      return;
    }

    const fileName = req.file.originalname || 'upload';
    if (parseResult.tables?.length) {
      await saveTableSnapshots(parseResult.tables, fileName, replacePeriod);
    }

    const importResult = await resolveAndImport(parseResult.rows, undefined, replacePeriod);
    const { created, conflicts, stats, groupIds: affectedGroupIds = [] } = importResult;

    if (conflicts.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Schedule conflicts detected',
        validationErrors: parseResult.errors,
        conflicts,
        summary: {
          total: parseResult.rows.length,
          valid: parseResult.rows.length - parseResult.errors.length,
          errors: parseResult.errors.length,
          conflicting: conflicts.length,
        },
      });
      return;
    }

    invalidateTimetableCache();
    if (created > 0) {
      await notifyTimetableChangeBroadcast();
    }

    for (const t of parseResult.tables ?? []) {
      const count = parseResult.rows.filter((r) => r.groupName === t.groupName).length;
      await updateSnapshotSlotCount(t.groupName, t.year, t.month, t.week, count);
    }

    res.status(201).json({
      success: true,
      message: `Imported ${parseResult.tables?.length ?? 0} table(s) and ${created} slot(s). Auto-created: ${stats.created.courses} courses, ${stats.created.halls} halls, ${stats.created.groups} groups.`,
      summary: {
        total: parseResult.rows.length,
        imported: created,
        tablesSaved: parseResult.tables?.length ?? 0,
        autoCreated: stats.created,
        unassignedLecturer: stats.unassignedCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function listTimetableTables(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? parseInt(String(req.query.year), 10) : undefined;
    const month = req.query.month ? parseInt(String(req.query.month), 10) : undefined;
    const week = req.query.week ? parseInt(String(req.query.week), 10) : undefined;
    const tables = await listTableSnapshots({ year, month, week });
    res.json({ success: true, data: tables });
  } catch (err) {
    next(err);
  }
}

export async function getTimetableTable(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const grid = await getTableSnapshotById(id);
    if (!grid) throw new AppError('Timetable table not found', 404);
    res.json({ success: true, data: grid });
  } catch (err) {
    next(err);
  }
}

export async function validateTimetableSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const body = req.body as {
      dayOfWeek?: string;
      startTime?: string;
      endTime?: string;
      hallName?: string;
      sharedHall?: boolean;
    };
    const dayOfWeek = body.dayOfWeek?.trim();
    const startTime = body.startTime?.trim();
    const endTime = body.endTime?.trim();
    if (!dayOfWeek || !startTime || !endTime) {
      throw new AppError('dayOfWeek, startTime, and endTime are required', 400);
    }
    const conflicts = await validateTableSlot(id, {
      dayOfWeek,
      startTime,
      endTime,
      hallName: body.hallName?.trim() || 'TBD',
      sharedHall: body.sharedHall === true,
    });
    res.json({
      success: true,
      ok: conflicts.length === 0,
      conflicts,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTimetableTable(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const grid = req.body?.grid as TimetableGridSnapshot | undefined;
    if (!grid || typeof grid !== 'object') {
      throw new AppError('grid is required', 400);
    }
    const result = await updateTableSnapshotGrid(id, grid);
    const syncWarnings = result.syncWarnings as string | undefined;
    res.json({
      success: true,
      message: syncWarnings
        ? syncWarnings
        : `Timetable saved (${result.imported} slot(s) synced)`,
      data: result.grid,
      imported: result.imported,
      syncWarnings,
    });
  } catch (err) {
    next(err);
  }
}

export async function createTimetableTable(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body as {
      tableTitle?: string;
      groupName?: string;
      year?: number;
      month?: number;
      week?: number;
      semester?: number;
      departmentId?: string;
    };
    const groupName = body.groupName?.trim();
    if (!groupName) throw new AppError('groupName is required', 400);
    const year = body.year ?? 2026;
    const month = body.month ?? 1;
    const week = body.week ?? 1;
    const result = await createTableSnapshot({
      tableTitle: body.tableTitle?.trim() || groupName,
      groupName,
      year,
      month,
      week,
      semester: body.semester,
      departmentId: body.departmentId,
    });
    res.status(201).json({
      success: true,
      message: 'Batch table created',
      data: result.meta,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateTimetableTableMeta(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const body = req.body as {
      tableTitle?: string;
      groupName?: string;
      year?: number;
      month?: number;
      week?: number;
      semester?: number;
      departmentId?: string;
    };
    const result = await updateTableSnapshotMeta(id, body);
    res.json({
      success: true,
      message: 'Batch table updated',
      data: result.meta,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteTimetableTable(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await deleteTableSnapshot(id);
    res.json({ success: true, message: 'Batch table deleted' });
  } catch (err) {
    next(err);
  }
}

export async function reresolveLecturers(_req: Request, res: Response, next: NextFunction) {
  try {
    const { reresolveUnassignedLecturers } = await import('../services/timetableImportService');
    const result = await reresolveUnassignedLecturers();
    if (result.matched > 0) {
      invalidateTimetableCache();
    }
    res.json({
      success: true,
      message: `Unlinked ${result.stillUnassigned} auto-assigned lecturer(s). Re-import Excel to load sheet codes (ND, MB, …) per class.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

export async function assignLecturer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { lecturerId } = req.body as { lecturerId: string };
    if (!lecturerId) throw new AppError('lecturerId is required', 400);

    const entry = await prisma.masterTimetable.findUnique({ where: { id } });
    if (!entry) throw new AppError('Timetable entry not found', 404);

    const lecturer = await prisma.user.findFirst({
      where: { id: lecturerId, role: 'LECTURER' },
    });
    if (!lecturer) throw new AppError('Lecturer not found', 404);

    const conflicts = await import('../services/conflictDetector').then((m) =>
      m.detectConflicts({
        year: entry.year,
        month: entry.month,
        week: entry.week,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        lecturerId,
        hallId: entry.hallId,
        groupId: entry.groupId,
        excludeId: id,
      })
    );
    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Lecturer has a conflict at this time', conflicts });
      return;
    }

    const updated = await prisma.masterTimetable.update({
      where: { id },
      data: { lecturerId },
      include: {
        lecturer: { select: { id: true, firstName: true, lastName: true, designation: true, email: true } },
        course: { select: { id: true, name: true, code: true } },
        hall: { select: { id: true, name: true, building: true } },
        group: { select: { id: true, name: true } },
      },
    });

    invalidateTimetableCache();
    await notifyTimetableChange([entry.groupId]);

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
