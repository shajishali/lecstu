import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';
import { isValidFloorIndex } from './floorPlanStorage';
import { MapMarkerType, Prisma } from '../generated/prisma/client';

const MARKER_INCLUDE = {
  building: { select: { id: true, name: true, code: true } },
  hall: { select: { id: true, name: true, building: true, floor: true } },
  office: {
    select: {
      id: true,
      roomNumber: true,
      building: true,
      floor: true,
      lecturer: { select: { firstName: true, lastName: true } },
    },
  },
} as const;

export function clampMarkerPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Accept 0-1 or 0-100 from clients */
export function normalizeMarkerCoord(value: number): number {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  if (n >= 0 && n <= 1) return clampMarkerPercent(n * 100);
  return clampMarkerPercent(n);
}

function buildingNameMatchers(buildingName: string, code: string) {
  const def = getFacultyBuildingByCode(code);
  const labels = new Set(
    [buildingName, code, def?.hallBuildingLabel, def?.name].filter(Boolean) as string[]
  );
  return [...labels];
}

export async function getBuildingOrThrow(buildingId: string) {
  const building = await prisma.mapBuilding.findUnique({ where: { id: buildingId } });
  if (!building) throw new AppError('Building not found', 404);
  return building;
}

export async function getIndoorEditorContext(buildingId: string, floor: number) {
  const building = await getBuildingOrThrow(buildingId);
  if (!isValidFloorIndex(floor, building.floors)) {
    throw new AppError(`Invalid floor ${floor} for ${building.name}`, 400);
  }

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!floorPlan) {
    throw new AppError(
      `No floor plan image for ${building.name} ${floor === 0 ? 'Ground' : `floor ${floor}`}. Upload in Admin → Buildings first.`,
      404
    );
  }

  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor },
    include: MARKER_INCLUDE,
    orderBy: { label: 'asc' },
  });

  const labels = buildingNameMatchers(building.name, building.code);

  const halls = await prisma.lectureHall.findMany({
    where: {
      isActive: true,
      floor,
      OR: labels.map((label) => ({
        building: { contains: label, mode: 'insensitive' as const },
      })),
    },
    orderBy: { name: 'asc' },
  });

  const offices = await prisma.lecturerOffice.findMany({
    where: {
      floor,
      OR: labels.map((label) => ({
        building: { contains: label, mode: 'insensitive' as const },
      })),
    },
    include: {
      lecturer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { roomNumber: 'asc' },
  });

  const markedHallIds = new Set(
    markers.map((m) => m.hallId).filter((id): id is string => !!id)
  );
  const markedOfficeIds = new Set(
    markers.map((m) => m.officeId).filter((id): id is string => !!id)
  );

  const hallsWithoutMarker = halls.filter((h) => !markedHallIds.has(h.id));
  const officesWithoutMarker = offices.filter((o) => !markedOfficeIds.has(o.id));

  const timetableHallRows = await prisma.masterTimetable.findMany({
    where: {
      hall: {
        floor,
        OR: labels.map((label) => ({
          building: { contains: label, mode: 'insensitive' as const },
        })),
      },
    },
    distinct: ['hallId'],
    select: {
      hall: { select: { id: true, name: true, building: true, floor: true } },
    },
  });

  const timetableHallsMissingMarker = timetableHallRows
    .map((r) => r.hall)
    .filter((h) => h && !markedHallIds.has(h.id));

  return {
    building,
    floor,
    floorPlan,
    markers,
    halls,
    offices,
    hallsWithoutMarker,
    officesWithoutMarker,
    timetableHallsMissingMarker,
  };
}

export async function createIndoorMarker(data: {
  buildingId: string;
  floor: number;
  type: MapMarkerType;
  label: string;
  x: number;
  y: number;
  hallId?: string | null;
  officeId?: string | null;
  legendNumber?: number | null;
}) {
  const building = await getBuildingOrThrow(data.buildingId);
  if (!isValidFloorIndex(data.floor, building.floors)) {
    throw new AppError('Invalid floor for this building', 400);
  }

  const x = normalizeMarkerCoord(data.x);
  const y = normalizeMarkerCoord(data.y);

  if (data.hallId) {
    const hall = await prisma.lectureHall.findUnique({ where: { id: data.hallId } });
    if (!hall) throw new AppError('Lecture hall not found', 404);
  }
  if (data.officeId) {
    const office = await prisma.lecturerOffice.findUnique({ where: { id: data.officeId } });
    if (!office) throw new AppError('Lecturer office not found', 404);
  }

  const metadata: Record<string, unknown> = {
    reviewStatus: 'pending',
    source: 'admin-manual',
  };
  if (typeof data.legendNumber === 'number' && !Number.isNaN(data.legendNumber)) {
    metadata.legendNumber = data.legendNumber;
  }

  const marker = await prisma.mapMarker.create({
    data: {
      buildingId: data.buildingId,
      floor: data.floor,
      type: data.type,
      label: data.label.trim(),
      x,
      y,
      hallId: data.hallId || null,
      officeId: data.officeId || null,
      metadata: metadata as Prisma.InputJsonValue,
    },
    include: MARKER_INCLUDE,
  });

  const { markFloorPlanStaleAfterEdit } = await import('./floorPlanReviewService');
  const { syncNavNodesFromMarkers } = await import('./indoorNavigationService');
  await syncNavNodesFromMarkers(data.buildingId, data.floor);
  await markFloorPlanStaleAfterEdit(data.buildingId, data.floor);

  return marker;
}

export async function updateIndoorMarker(
  id: string,
  data: Partial<{
    type: MapMarkerType;
    label: string;
    x: number;
    y: number;
    hallId: string | null;
    officeId: string | null;
    floor: number;
  }>
) {
  const existing = await prisma.mapMarker.findUnique({ where: { id } });
  if (!existing) throw new AppError('Marker not found', 404);

  const patch: Record<string, unknown> = {};
  if (data.type !== undefined) patch.type = data.type;
  if (data.label !== undefined) patch.label = data.label.trim();
  if (data.x !== undefined) patch.x = normalizeMarkerCoord(data.x);
  if (data.y !== undefined) patch.y = normalizeMarkerCoord(data.y);
  if (data.floor !== undefined) patch.floor = data.floor;
  if (data.hallId !== undefined) patch.hallId = data.hallId || null;
  if (data.officeId !== undefined) patch.officeId = data.officeId || null;

  const updated = await prisma.mapMarker.update({
    where: { id },
    data: patch,
    include: MARKER_INCLUDE,
  });

  if (
    data.x !== undefined ||
    data.y !== undefined ||
    data.label !== undefined ||
    data.hallId !== undefined ||
    data.officeId !== undefined ||
    data.type !== undefined
  ) {
    const { markFloorPlanStaleAfterEdit } = await import('./floorPlanReviewService');
    await markFloorPlanStaleAfterEdit(existing.buildingId, existing.floor);
  }

  return updated;
}
