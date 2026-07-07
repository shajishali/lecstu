import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import {
  getCatalogForEnrollment,
  importHandbookCatalogFile,
  syncCatalogFromTimetable,
  enrichAllCourseNamesFromCatalog,
} from '../services/handbookCatalogService';
import { parseEnrollmentFromGroupName } from '../services/studentGroupResolver';
import { getAllowedElectiveCourseIdsForStudent } from '../services/timetableService';
import fs from 'fs';
import path from 'path';
import { invalidateAll as invalidateTimetableCache } from '../services/timetableCache';
import type { HandbookCatalogFile } from '../types/handbookCatalog';

export async function getCourseCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const programCode = String(req.query.programCode ?? '').toUpperCase();
    const studyYear = Number(req.query.studyYear);
    const pathwayCode = req.query.pathwayCode
      ? String(req.query.pathwayCode).toUpperCase()
      : null;

    if (!programCode || !studyYear) {
      throw new AppError('programCode and studyYear are required', 400);
    }

    const catalog = await getCatalogForEnrollment(programCode, studyYear, pathwayCode);
    res.json({ success: true, data: catalog });
  } catch (err) {
    next(err);
  }
}

export async function getMyCourseCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const membership = await prisma.studentGroupMember.findFirst({
      where: { studentId: userId },
      include: { group: { select: { name: true } } },
    });
    if (!membership?.group) {
      return res.json({ success: true, data: [], meta: { message: 'No enrollment group' } });
    }

    const enrollment = parseEnrollmentFromGroupName(membership.group.name);
    if (!enrollment) {
      return res.json({ success: true, data: [], meta: { message: 'Could not parse enrollment' } });
    }

    const studyYear = Number(enrollment.studyYear.replace('Y', ''));
    const catalog = await getCatalogForEnrollment(
      enrollment.programCode,
      studyYear,
      enrollment.pathwayCode ?? null,
    );

    const selections = await prisma.studentCourseSelection.findMany({
      where: { studentId: userId },
      select: { courseId: true },
    });

    res.json({
      success: true,
      data: catalog,
      meta: {
        enrollment,
        selectedCourseIds: selections.map((s) => s.courseId),
        supportsPersonalization: studyYear >= 3,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMyCourseSelections(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { courseIds, academicYear } = req.body as { courseIds?: string[]; academicYear?: number };

    if (!Array.isArray(courseIds)) {
      throw new AppError('courseIds array is required', 400);
    }

    const year = academicYear ?? new Date().getFullYear();

    const allowedElectives = new Set(await getAllowedElectiveCourseIdsForStudent(userId));
    const invalid = courseIds.filter((id) => !allowedElectives.has(id));
    if (invalid.length > 0) {
      throw new AppError('Only optional elective modules can be saved to your personal timetable', 400);
    }

    await prisma.studentCourseSelection.deleteMany({
      where: { studentId: userId, academicYear: year },
    });

    if (courseIds.length > 0) {
      await prisma.studentCourseSelection.createMany({
        data: courseIds.map((courseId) => ({
          studentId: userId,
          courseId,
          academicYear: year,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.studentTimetableModuleConfig.upsert({
      where: { studentId: userId },
      create: { studentId: userId, academicYear: year },
      update: { academicYear: year, configuredAt: new Date() },
    });

    const selections = await prisma.studentCourseSelection.findMany({
      where: { studentId: userId, academicYear: year },
      include: { course: { select: { id: true, code: true, name: true } } },
    });

    invalidateTimetableCache();

    res.json({ success: true, data: selections });
  } catch (err) {
    next(err);
  }
}

export async function adminImportCatalog(req: Request, res: Response, next: NextFunction) {
  try {
    const jsonPath = path.resolve(
      __dirname,
      '../../data/handbook-extract/fct-handbook-catalog.json',
    );
    if (!fs.existsSync(jsonPath)) {
      throw new AppError('Catalog file not found. Run handbook:extract first.', 404);
    }
    const file = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as HandbookCatalogFile;
    const result = await importHandbookCatalogFile(file);
    const enriched = await enrichAllCourseNamesFromCatalog();
    res.json({ success: true, data: { ...result, enriched } });
  } catch (err) {
    next(err);
  }
}

export async function adminSyncCatalogFromTimetable(_req: Request, res: Response, next: NextFunction) {
  try {
    const { synced } = await syncCatalogFromTimetable();
    const enriched = await enrichAllCourseNamesFromCatalog();
    res.json({ success: true, data: { synced, enriched } });
  } catch (err) {
    next(err);
  }
}
