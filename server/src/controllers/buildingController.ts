import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import { Prisma } from '../generated/prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logActionForRequest } from '../services/auditLogger';
import {
  defaultFloorPlanBounds,
  deleteFloorPlanFile,
  floorPlanFilename,
  getFloorPlansDir,
  getFloorPlansImportDir,
  normalizeBounds,
  parseFloorPlanFilename,
  isValidFloorIndex,
  formatFloorLabel,
} from '../services/floorPlanStorage';
import {
  getFacultySetupStatus,
  upsertFacultyMapBuildings,
} from '../services/facultyBuildingSeed';
import { config } from '../config';
import {
  isVisionServiceHealthy,
  processFloorPlanWithVision,
} from '../services/floorPlanVisionService';
import { markFloorPlanStaleAfterEdit } from '../services/floorPlanReviewService';

const FLOORPLANS_URL_PREFIX = '/uploads/floorplans/';

const INCLUDE = {
  _count: { select: { markers: true, floorPlans: true } },
  floorPlans: {
    select: {
      id: true,
      floor: true,
      imagePath: true,
      bounds: true,
      drawableRegion: true,
      scaleMetersPerUnit: true,
      navigationNotes: true,
      navigationGuide: true,
      publishStatus: true,
      locationsLockedAt: true,
      lockedImagePath: true,
    },
    orderBy: { floor: 'asc' as const },
  },
};

function writeFloorPlanBuffer(
  buffer: Buffer,
  buildingCode: string,
  floor: number,
  originalName: string
): string {
  let ext = path.extname(originalName).toLowerCase() || '.jpg';
  if (ext === '.jpeg') ext = '.jpg';
  const dir = getFloorPlansDir();
  const filename = floorPlanFilename(buildingCode, floor, ext);
  const absolutePath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${absolutePath}.upload-${process.pid}-${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, buffer);
  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    fs.renameSync(tempPath, absolutePath);
  } catch (err) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      /* ignore cleanup failure */
    }
    throw err;
  }
  return `${FLOORPLANS_URL_PREFIX}${filename}`;
}

async function upsertFloorPlanRecord(
  buildingId: string,
  buildingCode: string,
  floor: number,
  imagePath: string,
  boundsInput: unknown,
  latitude: number,
  longitude: number
) {
  const bounds = normalizeBounds(boundsInput) ?? defaultFloorPlanBounds(latitude, longitude);

  return prisma.floorPlan.upsert({
    where: { buildingId_floor: { buildingId, floor } },
    create: {
      buildingId,
      floor,
      imagePath,
      bounds,
      scaleMetersPerUnit: 0.45,
      publishStatus: 'DRAFT',
    },
    update: {
      imagePath,
      bounds,
      locationsLockedAt: null,
      lockedImagePath: null,
      lockedMarkerSnapshot: Prisma.JsonNull,
    },
  });
}

export async function seedFacultyBuildings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await upsertFacultyMapBuildings(prisma);
    await logActionForRequest(req, 'SEED_FACULTY_BUILDINGS', 'MapBuilding', 'faculty', {
      codes: data.map((b) => b.code),
    });
    res.json({ success: true, data, message: 'Academic, Administration, and Laboratory buildings ready.' });
  } catch (err) {
    next(err);
  }
}

export async function getFacultySetupStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getFacultySetupStatus(prisma);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function listBuildings(req: Request, res: Response, next: NextFunction) {
  try {
    const { search } = req.query as Record<string, string>;
    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const data = await prisma.mapBuilding.findMany({
      where,
      include: INCLUDE,
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function getBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const building = await prisma.mapBuilding.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        markers: {
          include: {
            hall: { select: { id: true, name: true } },
            office: {
              select: {
                id: true,
                roomNumber: true,
                lecturer: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { floor: 'asc' },
        },
      },
    });
    if (!building) throw new AppError('Building not found', 404);
    res.json({ success: true, data: building });
  } catch (err) {
    next(err);
  }
}

export async function createBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, code, latitude, longitude, floors, metadata } = req.body;
    const building = await prisma.mapBuilding.create({
      data: {
        name,
        code: String(code).toUpperCase(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        floors: floors || 1,
        metadata,
      },
      include: INCLUDE,
    });
    await logActionForRequest(req, 'CREATE', 'MapBuilding', building.id, { name, code });
    res.status(201).json({ success: true, data: building });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A building with this code already exists', 409));
    next(err);
  }
}

export async function updateBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapBuilding.findUnique({ where: { id } });
    if (!existing) throw new AppError('Building not found', 404);

    const data: Record<string, unknown> = { ...req.body };
    if (data.code) data.code = String(data.code).toUpperCase();
    if (data.latitude) data.latitude = parseFloat(data.latitude as string);
    if (data.longitude) data.longitude = parseFloat(data.longitude as string);

    const building = await prisma.mapBuilding.update({
      where: { id },
      data,
      include: INCLUDE,
    });
    await logActionForRequest(req, 'UPDATE', 'MapBuilding', id, req.body);
    res.json({ success: true, data: building });
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError('A building with this code already exists', 409));
    next(err);
  }
}

export async function deleteBuilding(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const existing = await prisma.mapBuilding.findUnique({
      where: { id },
      include: { floorPlans: true },
    });
    if (!existing) throw new AppError('Building not found', 404);

    for (const plan of existing.floorPlans) {
      deleteFloorPlanFile(plan.imagePath);
    }

    await prisma.mapBuilding.delete({ where: { id } });
    await logActionForRequest(req, 'DELETE', 'MapBuilding', id, { name: existing.name });
    res.json({ success: true, message: 'Building deleted' });
  } catch (err) {
    next(err);
  }
}

export async function uploadFloorPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.body.floor), 10);
    if (!req.file) throw new AppError('Floor plan image is required', 400);

    const building = await prisma.mapBuilding.findUnique({ where: { id: buildingId } });
    if (!building) throw new AppError('Building not found', 404);
    if (isNaN(floor) || !isValidFloorIndex(floor, building.floors)) {
      throw new AppError(
        `Invalid floor ${floor}. Use 0 (${formatFloorLabel(0)}) through ${building.floors - 1} for ${building.name}`,
        400
      );
    }

    const existing = await prisma.floorPlan.findUnique({
      where: { buildingId_floor: { buildingId, floor } },
    });
    const previousImagePath = existing?.imagePath ?? null;

    const imagePath = writeFloorPlanBuffer(
      req.file.buffer,
      building.code,
      floor,
      req.file.originalname
    );

    if (previousImagePath && previousImagePath !== imagePath) {
      deleteFloorPlanFile(previousImagePath);
    }

    let boundsInput: unknown;
    if (req.body.bounds) {
      try {
        boundsInput = JSON.parse(req.body.bounds);
      } catch {
        throw new AppError('Invalid bounds JSON', 400);
      }
    }

    const record = await upsertFloorPlanRecord(
      buildingId,
      building.code,
      floor,
      imagePath,
      boundsInput,
      building.latitude,
      building.longitude
    );

    if (existing) {
      await markFloorPlanStaleAfterEdit(buildingId, floor);
    }

    await logActionForRequest(req, 'UPLOAD_FLOORPLAN', 'MapBuilding', buildingId, {
      floor,
      imagePath,
    });

    res.status(existing ? 200 : 201).json({
      success: true,
      data: record,
      message: 'Floor plan saved. Run AI analyze when ready.',
    });
  } catch (err) {
    next(err);
  }
}

/** Re-run AI on an existing floor plan (OCR rooms + auto navigation graph) */
export async function analyzeFloorPlanWithAi(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);

    const building = await prisma.mapBuilding.findUnique({ where: { id: buildingId } });
    if (!building) throw new AppError('Building not found', 404);
    if (isNaN(floor) || !isValidFloorIndex(floor, building.floors)) {
      throw new AppError('Invalid floor', 400);
    }

    const plan = await prisma.floorPlan.findUnique({
      where: { buildingId_floor: { buildingId, floor } },
    });
    if (!plan) throw new AppError('No floor plan image for this floor. Upload JPG first.', 404);

    const healthy = await isVisionServiceHealthy();
    if (!healthy) {
      throw new AppError(
        'Floor plan AI service is not running. Start: npm run floorplan-vision (port 8003)',
        503
      );
    }

    const vision = await processFloorPlanWithVision(buildingId, floor, plan.imagePath);
    await logActionForRequest(req, 'ANALYZE_FLOORPLAN_AI', 'MapBuilding', buildingId, {
      floor,
      vision,
    });

    res.json({ success: true, data: vision });
  } catch (err) {
    next(err);
  }
}

export async function bulkUploadFloorPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) throw new AppError('At least one floor plan image is required', 400);

    const results: {
      filename: string;
      ok: boolean;
      message: string;
      imagePath?: string;
    }[] = [];

    for (const file of files) {
      const parsed = parseFloorPlanFilename(file.originalname);
      if (!parsed) {
        results.push({
          filename: file.originalname,
          ok: false,
          message: 'Name must be CODE_floorN.jpg (e.g. ACAD_floor1.jpg)',
        });
        continue;
      }

      const building = await prisma.mapBuilding.findUnique({ where: { code: parsed.code } });
      if (!building) {
        results.push({
          filename: file.originalname,
          ok: false,
          message: `Unknown building code ${parsed.code}. Run db:seed-faculty-buildings`,
        });
        continue;
      }

      if (!isValidFloorIndex(parsed.floor, building.floors)) {
        results.push({
          filename: file.originalname,
          ok: false,
          message: `Floor ${parsed.floor} invalid for ${building.name} (0=Ground … ${building.floors - 1})`,
        });
        continue;
      }

      const existing = await prisma.floorPlan.findUnique({
        where: { buildingId_floor: { buildingId: building.id, floor: parsed.floor } },
      });
      if (existing) deleteFloorPlanFile(existing.imagePath);

      const imagePath = writeFloorPlanBuffer(
        file.buffer,
        building.code,
        parsed.floor,
        file.originalname
      );

      await upsertFloorPlanRecord(
        building.id,
        building.code,
        parsed.floor,
        imagePath,
        null,
        building.latitude,
        building.longitude
      );

      results.push({
        filename: file.originalname,
        ok: true,
        message: `Saved as ${building.code} floor ${parsed.floor}`,
        imagePath,
      });
    }

    const okCount = results.filter((r) => r.ok).length;
    await logActionForRequest(req, 'BULK_UPLOAD_FLOORPLAN', 'MapBuilding', 'bulk', {
      ok: okCount,
      total: results.length,
    });

    res.json({
      success: true,
      data: { results, imported: okCount, failed: results.length - okCount },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateFloorPlanBounds(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const planId = req.params.planId as string;
    const bounds = normalizeBounds(req.body.bounds);
    if (!bounds) throw new AppError('bounds must be [[south, west], [north, east]]', 400);

    const plan = await prisma.floorPlan.findFirst({
      where: { id: planId, buildingId },
    });
    if (!plan) throw new AppError('Floor plan not found', 404);

    const updated = await prisma.floorPlan.update({
      where: { id: planId },
      data: { bounds },
    });

    await logActionForRequest(req, 'UPDATE_FLOORPLAN_BOUNDS', 'MapBuilding', buildingId, {
      floor: plan.floor,
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteFloorPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.planId as string;
    const plan = await prisma.floorPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError('Floor plan not found', 404);

    deleteFloorPlanFile(plan.imagePath);

    await prisma.floorPlan.delete({ where: { id } });
    await logActionForRequest(req, 'DELETE_FLOORPLAN', 'MapBuilding', plan.buildingId, {
      floor: plan.floor,
    });
    res.json({ success: true, message: 'Floor plan deleted' });
  } catch (err) {
    next(err);
  }
}

/** PATCH navigation notes for a floor (paste from ChatGPT / building description). */
export async function saveFloorNavigationNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const notes = (req.body?.notes as string) ?? '';
    if (!notes.trim()) throw new AppError('notes is required', 400);

    const plan = await prisma.floorPlan.findUnique({
      where: { buildingId_floor: { buildingId, floor } },
    });
    if (!plan) throw new AppError('Upload a floor plan image first', 404);

    const updated = await prisma.floorPlan.update({
      where: { id: plan.id },
      data: { navigationNotes: notes.trim() },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/** Build navigation guide from notes + auto-match room positions on the floor plan. */
export async function buildFloorNavigationGuideHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const buildingId = req.params.id as string;
    const floor = parseInt(String(req.params.floor), 10);
    const notes = (req.body?.notes as string) || undefined;
    const runVision = req.body?.runVision !== false;

    const plan = await prisma.floorPlan.findUnique({
      where: { buildingId_floor: { buildingId, floor } },
    });
    if (!plan) throw new AppError('Upload a floor plan image first', 404);

    const effectiveNotes = notes?.trim() || plan.navigationNotes || '';
    if (!effectiveNotes) throw new AppError('Paste navigation notes describing this floor first', 400);

    const { buildFloorNavigationGuide } = await import('../services/floorNavigationStoryService');
    const guide = await buildFloorNavigationGuide(buildingId, floor, effectiveNotes, {
      runVision,
      imagePath: plan.imagePath,
    });

    await logActionForRequest(req, 'BUILD_NAV_GUIDE', 'FloorPlan', plan.id, {
      floor,
      placeCount: guide.places.length,
    });

    res.json({
      success: true,
      data: { guide, message: `Navigation ready - ${guide.places.length} places on ${formatFloorLabel(floor)}` },
    });
  } catch (err) {
    next(err);
  }
}

/** GET import folder path for admin UI */
export async function getFloorPlanImportInfo(_req: Request, res: Response, next: NextFunction) {
  try {
    const importDir = getFloorPlansImportDir();
    const files = fs.existsSync(importDir)
      ? fs.readdirSync(importDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      : [];

    res.json({
      success: true,
      data: {
        importDir,
        naming: 'CODE_floor0.jpg or CODE_ground.jpg (ground), CODE_floor1.jpg, …',
        codes: ['ACAD', 'ADMIN', 'LAB'],
        pendingFiles: files,
      },
    });
  } catch (err) {
    next(err);
  }
}
