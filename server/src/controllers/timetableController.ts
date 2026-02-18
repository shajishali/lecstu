import { Request, Response, NextFunction } from 'express';
import { Readable } from 'stream';
import csvParser from 'csv-parser';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { detectConflicts } from '../services/conflictDetector';
import { invalidateAll as invalidateTimetableCache } from '../services/timetableCache';

const INCLUDE_RELATIONS = {
  course: { select: { id: true, name: true, code: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true, email: true } },
  hall: { select: { id: true, name: true, building: true, capacity: true } },
  group: { select: { id: true, name: true, batchYear: true } },
};

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
        include: INCLUDE_RELATIONS,
        orderBy: [
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
    const { dayOfWeek, startTime, endTime, semester, year, courseId, lecturerId, hallId, groupId } = req.body;

    if (startTime >= endTime) throw new AppError('Start time must be before end time', 400);

    const conflicts = await detectConflicts({ dayOfWeek, startTime, endTime, hallId, lecturerId, groupId });
    if (conflicts.length > 0) {
      res.status(409).json({ success: false, message: 'Schedule conflicts detected', conflicts });
      return;
    }

    const entry = await prisma.masterTimetable.create({
      data: { dayOfWeek, startTime, endTime, semester: semester || 1, year: year || 2026, courseId, lecturerId, hallId, groupId },
      include: INCLUDE_RELATIONS,
    });

    invalidateTimetableCache();
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

    const conflicts = await detectConflicts({
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
    res.json({ success: true, message: 'Timetable entry deleted' });
  } catch (err) {
    next(err);
  }
}

export async function getDropdownData(_req: Request, res: Response, next: NextFunction) {
  try {
    const [courses, lecturers, halls, groups] = await Promise.all([
      prisma.course.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true }, orderBy: { code: 'asc' } }),
      prisma.user.findMany({ where: { role: 'LECTURER' }, select: { id: true, firstName: true, lastName: true, email: true }, orderBy: { firstName: 'asc' } }),
      prisma.lectureHall.findMany({ where: { isActive: true }, select: { id: true, name: true, building: true, capacity: true }, orderBy: { name: 'asc' } }),
      prisma.studentGroup.findMany({ select: { id: true, name: true, batchYear: true }, orderBy: { name: 'asc' } }),
    ]);

    res.json({ success: true, data: { courses, lecturers, halls, groups } });
  } catch (err) {
    next(err);
  }
}

interface CsvRow {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  courseCode: string;
  lecturerEmail: string;
  hallName: string;
  groupName: string;
  semester?: string;
  year?: string;
}

export async function bulkImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('CSV file is required', 400);

    const rows: CsvRow[] = [];
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser({ mapHeaders: ({ header }: { header: string }) => header.trim() }))
        .on('data', (row: CsvRow) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) throw new AppError('CSV file is empty', 400);

    const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    const TIME_RE = /^\d{2}:\d{2}$/;

    const [courses, lecturers, halls, groups] = await Promise.all([
      prisma.course.findMany({ select: { id: true, code: true } }),
      prisma.user.findMany({ where: { role: 'LECTURER' }, select: { id: true, email: true } }),
      prisma.lectureHall.findMany({ select: { id: true, name: true } }),
      prisma.studentGroup.findMany({ select: { id: true, name: true } }),
    ]);

    const courseMap = new Map(courses.map((c) => [c.code.toUpperCase(), c.id]));
    const lecturerMap = new Map(lecturers.map((l) => [l.email.toLowerCase(), l.id]));
    const hallMap = new Map(halls.map((h) => [h.name.toUpperCase(), h.id]));
    const groupMap = new Map(groups.map((g) => [g.name.toUpperCase(), g.id]));

    const errors: { row: number; message: string }[] = [];
    const validEntries: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // header is row 1
      const day = r.dayOfWeek?.toUpperCase().trim();

      if (!day || !VALID_DAYS.includes(day)) {
        errors.push({ row: rowNum, message: `Invalid dayOfWeek "${r.dayOfWeek}"` });
        continue;
      }
      if (!r.startTime || !TIME_RE.test(r.startTime.trim())) {
        errors.push({ row: rowNum, message: `Invalid startTime "${r.startTime}" (expected HH:mm)` });
        continue;
      }
      if (!r.endTime || !TIME_RE.test(r.endTime.trim())) {
        errors.push({ row: rowNum, message: `Invalid endTime "${r.endTime}" (expected HH:mm)` });
        continue;
      }
      if (r.startTime.trim() >= r.endTime.trim()) {
        errors.push({ row: rowNum, message: 'startTime must be before endTime' });
        continue;
      }

      const courseId = courseMap.get(r.courseCode?.toUpperCase().trim());
      if (!courseId) { errors.push({ row: rowNum, message: `Course "${r.courseCode}" not found` }); continue; }

      const lecturerId = lecturerMap.get(r.lecturerEmail?.toLowerCase().trim());
      if (!lecturerId) { errors.push({ row: rowNum, message: `Lecturer "${r.lecturerEmail}" not found` }); continue; }

      const hallId = hallMap.get(r.hallName?.toUpperCase().trim());
      if (!hallId) { errors.push({ row: rowNum, message: `Hall "${r.hallName}" not found` }); continue; }

      const groupId = groupMap.get(r.groupName?.toUpperCase().trim());
      if (!groupId) { errors.push({ row: rowNum, message: `Group "${r.groupName}" not found` }); continue; }

      validEntries.push({
        dayOfWeek: day,
        startTime: r.startTime.trim(),
        endTime: r.endTime.trim(),
        semester: r.semester ? parseInt(r.semester) : 1,
        year: r.year ? parseInt(r.year) : 2026,
        courseId, lecturerId, hallId, groupId,
        _rowNum: rowNum,
      });
    }

    const allConflicts: { row: number; conflicts: any[] }[] = [];
    for (const entry of validEntries) {
      const conflicts = await detectConflicts({
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        hallId: entry.hallId,
        lecturerId: entry.lecturerId,
        groupId: entry.groupId,
      });
      if (conflicts.length > 0) {
        allConflicts.push({ row: entry._rowNum, conflicts });
      }
    }

    if (errors.length > 0 || allConflicts.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Validation/conflict errors found in CSV',
        validationErrors: errors,
        conflicts: allConflicts,
        summary: { total: rows.length, valid: validEntries.length, errors: errors.length, conflicting: allConflicts.length },
      });
      return;
    }

    const created = await prisma.masterTimetable.createMany({
      data: validEntries.map(({ _rowNum, ...e }) => e),
    });

    invalidateTimetableCache();
    res.status(201).json({
      success: true,
      message: `Successfully imported ${created.count} timetable entries`,
      summary: { total: rows.length, imported: created.count },
    });
  } catch (err) {
    next(err);
  }
}
