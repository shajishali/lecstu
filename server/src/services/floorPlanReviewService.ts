import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getConnectionsForBuilding } from '../constants/buildingConnections';
import { PHASE_11_ACTIVE_FLOORS } from '../constants/facultyBuildings';
import {
  getLegendNumber,
  getMarkerReviewStatus,
  isFloorPlanPlace,
  isJunkMarker,
  isMarkerVisibleToStudents,
  parseMarkerMetadata,
  withBuildingConnection,
  withReviewStatus,
  type MarkerReviewStatus,
} from '../utils/markerMetadata';
import { isValidFloorIndex } from './floorPlanStorage';
import { getBuildingOrThrow, getIndoorEditorContext } from './indoorMarkerService';
import { parseDrawableRegion } from '../utils/floorPlanMapRegion';
import { Prisma, type FloorPlanPublishStatus, type MapMarkerType } from '../generated/prisma/client';
import { syncNavNodesFromMarkers } from './indoorNavigationService';
import { clearAutoWalkingPaths, saveWalkingPathsSnapshot } from './navGraphBuildService';
import { validateFloorNavGraph } from './navGraphValidationService';

const DEFAULT_SCALE_METERS_PER_UNIT = 0.45;

async function syncNavGraphForFloor(buildingId: string, floor: number) {
  await syncNavNodesFromMarkers(buildingId, floor);
}

export async function getFloorPlanLockState(buildingId: string, floor: number) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: {
      locationsLockedAt: true,
      lockedImagePath: true,
      lockedMarkerSnapshot: true,
      imagePath: true,
    },
  });
  if (!plan) throw new AppError('Floor plan not found', 404);
  return plan;
}

export async function assertFloorPlanNotLocked(buildingId: string, floor: number) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { locationsLockedAt: true },
  });
  if (plan?.locationsLockedAt) {
    throw new AppError(
      'Locations are locked for Walking paths — click Unlock on Locations & publish to edit',
      409
    );
  }
}

/** Freeze marker positions + floor plan image for the Walking paths editor. */
export async function lockFloorLocations(buildingId: string, floor: number) {
  const ctx = await getIndoorEditorContext(buildingId, floor);
  if (ctx.floorPlan.locationsLockedAt) {
    throw new AppError('Locations already locked', 400);
  }

  const places = ctx.markers.filter((m) => isFloorPlanPlace(m.label, m.type, m.metadata));
  if (!places.length) {
    throw new AppError('Place at least one location on the map before locking', 400);
  }

  for (const m of places) {
    if (getMarkerReviewStatus(m.metadata) !== 'approved') {
      await prisma.mapMarker.update({
        where: { id: m.id },
        data: {
          metadata: withReviewStatus(parseMarkerMetadata(m.metadata), 'approved') as Prisma.InputJsonValue,
        },
      });
    }
  }

  const refreshed = await prisma.mapMarker.findMany({
    where: { buildingId, floor },
    orderBy: { label: 'asc' },
  });
  const approvedPlaces = refreshed
    .filter((m) => isFloorPlanPlace(m.label, m.type, m.metadata))
    .filter((m) => getMarkerReviewStatus(m.metadata) === 'approved');

  const snapshot = approvedPlaces.map((m) => ({
    id: m.id,
    label: m.label,
    x: m.x,
    y: m.y,
    legendNumber: getLegendNumber(m.metadata),
  }));

  const lockedAt = new Date();
  const updated = await prisma.floorPlan.update({
    where: { id: ctx.floorPlan.id },
    data: {
      locationsLockedAt: lockedAt,
      lockedImagePath: ctx.floorPlan.imagePath,
      lockedMarkerSnapshot: snapshot as Prisma.InputJsonValue,
    },
  });

  await saveWalkingPathsSnapshot(buildingId, floor);
  await syncNavNodesFromMarkers(buildingId, floor);
  await clearAutoWalkingPaths(buildingId, floor);

  return {
    locationsLockedAt: updated.locationsLockedAt,
    lockedImagePath: updated.lockedImagePath,
    lockedMarkerSnapshot: snapshot,
    markerCount: snapshot.length,
  };
}

export async function unlockFloorLocations(buildingId: string, floor: number) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!plan) throw new AppError('Floor plan not found', 404);
  if (!plan.locationsLockedAt) {
    throw new AppError('Locations are not locked', 400);
  }
  return prisma.floorPlan.update({
    where: { id: plan.id },
    data: {
      locationsLockedAt: null,
      lockedImagePath: null,
      lockedMarkerSnapshot: Prisma.JsonNull,
    },
  });
}

function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Number(v)));
}

async function deleteNavNodesForMarkers(markerIds: string[]) {
  if (!markerIds.length) return;
  const navNodes = await prisma.navNode.findMany({
    where: { mapMarkerId: { in: markerIds } },
    select: { id: true },
  });
  const navIds = navNodes.map((n) => n.id);
  if (!navIds.length) return;
  await prisma.navEdge.deleteMany({
    where: { OR: [{ fromNodeId: { in: navIds } }, { toNodeId: { in: navIds } }] },
  });
  await prisma.navNode.deleteMany({ where: { id: { in: navIds } } });
}

/** Remove doors, old text-guide markers, and direction sentences — keep real floor-plan places. */
export async function purgeFloorPlanJunkMarkers(buildingId: string, floor: number) {
  const markers = await prisma.mapMarker.findMany({ where: { buildingId, floor } });
  const junkIds = markers.filter((m) => isJunkMarker(m.label, m.metadata)).map((m) => m.id);
  if (!junkIds.length) return { removed: 0 };

  await deleteNavNodesForMarkers(junkIds);
  await prisma.mapMarker.deleteMany({ where: { id: { in: junkIds } } });
  await markFloorPlanStaleAfterEdit(buildingId, floor);
  return { removed: junkIds.length };
}

export async function getFloorLocationsReview(buildingId: string, floor: number) {
  const ctx = await getIndoorEditorContext(buildingId, floor);
  const connections = getConnectionsForBuilding(ctx.building.code);

  const junkCount = ctx.markers.filter((m) => isJunkMarker(m.label, m.metadata)).length;

  const markers = ctx.markers
    .filter((m) => isFloorPlanPlace(m.label, m.type, m.metadata))
    .map((m) => ({
      ...m,
      reviewStatus: getMarkerReviewStatus(m.metadata),
      legendNumber: getLegendNumber(m.metadata),
    }))
    .sort((a, b) => {
      const an = a.legendNumber ?? 999;
      const bn = b.legendNumber ?? 999;
      if (an !== bn) return an - bn;
      return a.label.localeCompare(b.label);
    });

  const connectionStatus = connections.map((def) => {
    const found = markers.find((m) => {
      const meta = m.metadata as { buildingConnection?: { targetBuildingCode?: string } } | null;
      return (
        m.type === def.markerType &&
        meta?.buildingConnection?.targetBuildingCode === def.targetBuildingCode
      );
    });
    return { ...def, placed: !!found, markerId: found?.id ?? null };
  });

  const pendingCount = markers.filter((m) => m.reviewStatus === 'pending').length;
  const approvedCount = markers.filter((m) => m.reviewStatus === 'approved').length;

  return {
    building: ctx.building,
    floor,
    floorPlan: ctx.floorPlan,
    markers,
    halls: ctx.halls,
    offices: ctx.offices,
    hallsWithoutMarker: ctx.hallsWithoutMarker,
    officesWithoutMarker: ctx.officesWithoutMarker,
    connections: connectionStatus,
    stats: {
      total: markers.length,
      pending: pendingCount,
      approved: approvedCount,
      rejected: markers.filter((m) => m.reviewStatus === 'rejected').length,
    },
    activePhaseFloors: [...PHASE_11_ACTIVE_FLOORS],
    junkHidden: junkCount,
  };
}

/** After admin edits locations, students must not keep seeing a stale published floor. */
export async function markFloorPlanStaleAfterEdit(buildingId: string, floor: number) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!plan || plan.publishStatus !== 'PUBLISHED') return plan;
  return prisma.floorPlan.update({
    where: { id: plan.id },
    data: { publishStatus: 'REVIEWED' },
  });
}

export async function updateMarkerReviewStatus(markerId: string, reviewStatus: MarkerReviewStatus) {
  const marker = await prisma.mapMarker.findUnique({ where: { id: markerId } });
  if (!marker) throw new AppError('Marker not found', 404);

  const updated = await prisma.mapMarker.update({
    where: { id: markerId },
    data: {
      metadata: withReviewStatus(
        parseMarkerMetadata(marker.metadata),
        reviewStatus
      ) as Prisma.InputJsonValue,
    },
  });

  await syncNavGraphForFloor(marker.buildingId, marker.floor);
  await markFloorPlanStaleAfterEdit(marker.buildingId, marker.floor);
  return updated;
}

export async function bulkApproveMarkers(markerIds: string[]) {
  if (!markerIds.length) throw new AppError('markerIds required', 400);
  const markers = await prisma.mapMarker.findMany({ where: { id: { in: markerIds } } });
  if (!markers.length) throw new AppError('No markers found', 404);

  await Promise.all(
    markers.map((m) =>
      prisma.mapMarker.update({
        where: { id: m.id },
        data: {
          metadata: withReviewStatus(
            parseMarkerMetadata(m.metadata),
            'approved'
          ) as Prisma.InputJsonValue,
        },
      })
    )
  );

  const buildingFloors = new Set(markers.map((m) => `${m.buildingId}:${m.floor}`));
  for (const key of buildingFloors) {
    const [buildingId, floor] = key.split(':');
    const floorNum = parseInt(floor, 10);
    await syncNavGraphForFloor(buildingId, floorNum);
    await markFloorPlanStaleAfterEdit(buildingId, floorNum);
  }

  return { approved: markers.length };
}

export async function placeBuildingConnectionMarker(
  buildingId: string,
  floor: number,
  targetBuildingCode: string,
  x: number,
  y: number
) {
  await assertFloorPlanNotLocked(buildingId, floor);
  const building = await getBuildingOrThrow(buildingId);
  const def = getConnectionsForBuilding(building.code).find(
    (c) => c.targetBuildingCode === targetBuildingCode.toUpperCase()
  );
  if (!def) {
    throw new AppError(`No connection defined from ${building.code} to ${targetBuildingCode}`, 400);
  }

  const existing = await prisma.mapMarker.findMany({
    where: { buildingId, floor, type: def.markerType as MapMarkerType },
  });
  const duplicate = existing.find((m) => {
    const meta = m.metadata as { buildingConnection?: { targetBuildingCode?: string } } | null;
    return meta?.buildingConnection?.targetBuildingCode === def.targetBuildingCode;
  });
  if (duplicate) {
    throw new AppError('Connection point already placed — edit or delete the existing marker', 409);
  }

  const role = def.markerType === 'ENTRANCE' ? 'entrance' : 'exit';
  const marker = await prisma.mapMarker.create({
    data: {
      buildingId,
      floor,
      type: def.markerType as MapMarkerType,
      label: def.label,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      metadata: withBuildingConnection(null, {
        targetBuildingCode: def.targetBuildingCode,
        role,
      }) as Prisma.InputJsonValue,
    },
  });

  await syncNavGraphForFloor(buildingId, floor);
  await markFloorPlanStaleAfterEdit(buildingId, floor);
  return marker;
}

export async function updateFloorPlanCalibration(
  buildingId: string,
  floor: number,
  input: {
    scaleMetersPerUnit?: number | null;
    drawableRegion?: { x0: number; y0: number; x1: number; y1: number };
    bounds?: [[number, number], [number, number]];
  }
) {
  const building = await getBuildingOrThrow(buildingId);
  if (!isValidFloorIndex(floor, building.floors)) {
    throw new AppError('Invalid floor', 400);
  }

  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!plan) throw new AppError('Upload a floor plan image first', 404);

  const data: Record<string, unknown> = {};
  if (input.scaleMetersPerUnit !== undefined) {
    const scale = input.scaleMetersPerUnit;
    if (scale !== null && (typeof scale !== 'number' || scale <= 0)) {
      throw new AppError('scaleMetersPerUnit must be a positive number', 400);
    }
    data.scaleMetersPerUnit = scale ?? DEFAULT_SCALE_METERS_PER_UNIT;
  }
  if (input.drawableRegion) {
    const r = parseDrawableRegion(input.drawableRegion);
    data.drawableRegion = r;
  }
  if (input.bounds) {
    data.bounds = input.bounds;
  }

  const updated = await prisma.floorPlan.update({
    where: { id: plan.id },
    data,
  });
  await markFloorPlanStaleAfterEdit(buildingId, floor);
  return updated;
}

export async function updateFloorPlanPublishStatus(
  buildingId: string,
  floor: number,
  publishStatus: FloorPlanPublishStatus
) {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
  });
  if (!plan) throw new AppError('Upload a floor plan image first', 404);

  if (publishStatus === 'PUBLISHED') {
    const pending = await prisma.mapMarker.findMany({
      where: { buildingId, floor },
    });
    const blocking = pending.filter((m) => !isMarkerVisibleToStudents(m.metadata));
    if (blocking.length > 0) {
      throw new AppError(
        `${blocking.length} location(s) still pending review — approve or reject before publishing`,
        400
      );
    }
    await syncNavNodesFromMarkers(buildingId, floor);
    await clearAutoWalkingPaths(buildingId, floor);
  }

  const updated = await prisma.floorPlan.update({
    where: { id: plan.id },
    data: { publishStatus },
  });

  if (publishStatus === 'PUBLISHED') {
    const graphValidation = await validateFloorNavGraph(buildingId, floor);
    return { ...updated, graphValidation };
  }

  return updated;
}

/** Filter marker list for student-facing APIs. */
export function filterStudentMarkers<T extends { metadata: unknown }>(markers: T[]): T[] {
  return markers.filter((m) => isMarkerVisibleToStudents(m.metadata));
}

export async function updateFloorMarkerPosition(
  buildingId: string,
  floor: number,
  markerId: string,
  x: number,
  y: number
) {
  await assertFloorPlanNotLocked(buildingId, floor);
  const marker = await prisma.mapMarker.findUnique({ where: { id: markerId } });
  if (!marker || marker.buildingId !== buildingId || marker.floor !== floor) {
    throw new AppError('Marker not found on this floor', 404);
  }
  const xn = clampPct(x);
  const yn = clampPct(y);
  const updated = await prisma.mapMarker.update({
    where: { id: markerId },
    data: { x: xn, y: yn },
  });
  await prisma.navNode.updateMany({
    where: { mapMarkerId: markerId },
    data: { x: xn, y: yn },
  });
  void markFloorPlanStaleAfterEdit(buildingId, floor);
  return updated;
}

export async function updateFloorMarkerDetails(
  buildingId: string,
  floor: number,
  markerId: string,
  input: {
    label?: string;
    type?: MapMarkerType;
    legendNumber?: number | null;
    hallId?: string | null;
    officeId?: string | null;
  }
) {
  await assertFloorPlanNotLocked(buildingId, floor);
  const marker = await prisma.mapMarker.findUnique({ where: { id: markerId } });
  if (!marker || marker.buildingId !== buildingId || marker.floor !== floor) {
    throw new AppError('Marker not found on this floor', 404);
  }
  const meta = parseMarkerMetadata(marker.metadata);
  if (input.legendNumber !== undefined) {
    if (input.legendNumber === null || Number.isNaN(input.legendNumber)) {
      delete meta.legendNumber;
    } else {
      meta.legendNumber = input.legendNumber;
    }
  }
  const updated = await prisma.mapMarker.update({
    where: { id: markerId },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.hallId !== undefined ? { hallId: input.hallId } : {}),
      ...(input.officeId !== undefined ? { officeId: input.officeId } : {}),
      metadata: meta as Prisma.InputJsonValue,
    },
  });
  await syncNavGraphForFloor(buildingId, floor);
  await markFloorPlanStaleAfterEdit(buildingId, floor);
  return updated;
}

export async function deleteFloorMarker(buildingId: string, floor: number, markerId: string) {
  await assertFloorPlanNotLocked(buildingId, floor);
  const marker = await prisma.mapMarker.findUnique({ where: { id: markerId } });
  if (!marker || marker.buildingId !== buildingId || marker.floor !== floor) {
    throw new AppError('Marker not found on this floor', 404);
  }
  await deleteNavNodesForMarkers([markerId]);
  await prisma.mapMarker.delete({ where: { id: markerId } });
  await markFloorPlanStaleAfterEdit(buildingId, floor);
  return { deleted: true };
}
