import fs from 'fs';
import path from 'path';
import { config } from '../config';

const FLOORPLANS_SUBDIR = 'floorplans';
const IMPORT_SUBDIR = 'import';

export function getFloorPlansDir(): string {
  const dir = path.join(config.upload.uploadDir, FLOORPLANS_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getFloorPlansImportDir(): string {
  const dir = path.join(getFloorPlansDir(), IMPORT_SUBDIR);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** UI / API label: 0 = Ground floor */
export function formatFloorLabel(floor: number): string {
  if (floor === 0) return 'Ground floor (G)';
  return `Floor ${floor}`;
}

/** Canonical filename on disk: ACAD_floor0.jpg (ground) or ACAD_floor1.jpg */
export function floorPlanFilename(buildingCode: string, floor: number, ext = '.jpg'): string {
  const safeCode = buildingCode.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase();
  return `${safeCode}_floor${floor}${ext}`;
}

/** Public URL path served by express.static /uploads */
export function floorPlanImagePath(buildingCode: string, floor: number, ext = '.jpg'): string {
  return `/uploads/${FLOORPLANS_SUBDIR}/${floorPlanFilename(buildingCode, floor, ext)}`;
}

/**
 * Parse ACAD_floor0.jpg (ground), ACAD_ground.jpg, ACAD_floor1.jpg, etc.
 */
export function parseFloorPlanFilename(
  filename: string
): { code: string; floor: number; ext: string } | null {
  const base = path.basename(filename);
  const extMatch = base.match(/\.(jpe?g|png|webp)$/i);
  if (!extMatch) return null;
  const ext =
    extMatch[1].toLowerCase() === 'jpeg' ? '.jpg' : `.${extMatch[1].toLowerCase()}`;

  const ground = base.match(/^([A-Za-z0-9_-]+)_ground\.(jpe?g|png|webp)$/i);
  if (ground) {
    return { code: ground[1].toUpperCase(), floor: 0, ext };
  }

  const numbered = base.match(/^([A-Za-z0-9_-]+)_floor(\d+)\.(jpe?g|png|webp)$/i);
  if (!numbered) return null;
  return {
    code: numbered[1].toUpperCase(),
    floor: parseInt(numbered[2], 10),
    ext,
  };
}

/** floor index 0 .. building.floors - 1 (0 = ground) */
export function isValidFloorIndex(floor: number, buildingFloors: number): boolean {
  return Number.isInteger(floor) && floor >= 0 && floor < buildingFloors;
}

export function resolveUploadFilePath(imagePath: string): string {
  const rel = imagePath.replace(/^\/uploads\/?/i, '').replace(/\\/g, '/');
  return path.join(config.upload.uploadDir, rel);
}

export function deleteFloorPlanFile(imagePath: string): void {
  const full = resolveUploadFilePath(imagePath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}

/** Default Leaflet overlay bounds: [[south, west], [north, east]] */
export function defaultFloorPlanBounds(
  latitude: number,
  longitude: number,
  span = 0.00035
): [[number, number], [number, number]] {
  return [
    [latitude - span, longitude - span],
    [latitude + span, longitude + span],
  ];
}

export function normalizeBounds(raw: unknown): [[number, number], [number, number]] | null {
  if (!raw || !Array.isArray(raw) || raw.length < 2) return null;
  const a = raw[0];
  const b = raw[1];
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return null;
  const south = Number(a[0]);
  const west = Number(a[1]);
  const north = Number(b[0]);
  const east = Number(b[1]);
  if ([south, west, north, east].some((n) => Number.isNaN(n))) return null;
  return [
    [south, west],
    [north, east],
  ];
}

export function moveUploadedToCanonical(
  tempPath: string,
  buildingCode: string,
  floor: number,
  originalName?: string
): { absolutePath: string; imagePath: string; ext: string } {
  let ext = '.jpg';
  if (originalName) {
    const parsed = parseFloorPlanFilename(originalName);
    if (parsed) ext = parsed.ext.startsWith('.') ? parsed.ext : `.${parsed.ext}`;
  } else {
    ext = path.extname(tempPath).toLowerCase() || '.jpg';
  }
  if (ext === '.jpeg') ext = '.jpg';

  const dir = getFloorPlansDir();
  const filename = floorPlanFilename(buildingCode, floor, ext);
  const absolutePath = path.join(dir, filename);
  fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  fs.renameSync(tempPath, absolutePath);

  return {
    absolutePath,
    imagePath: floorPlanImagePath(buildingCode, floor, ext),
    ext,
  };
}
