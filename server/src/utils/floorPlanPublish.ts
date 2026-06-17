import type { FloorPlanPublishStatus } from '../generated/prisma/client';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const PUBLISHED_FLOOR_STATUS: FloorPlanPublishStatus = 'PUBLISHED';

export function isFloorPlanPublished(status: FloorPlanPublishStatus | string | null | undefined): boolean {
  return status === PUBLISHED_FLOOR_STATUS;
}

/** Prisma filter: student/public indoor navigation reads published floors only. */
export function publishedFloorPlanFilter() {
  return { publishStatus: PUBLISHED_FLOOR_STATUS as FloorPlanPublishStatus };
}

export async function assertStudentFloorAccess(buildingId: string, floor: number): Promise<void> {
  const plan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { publishStatus: true },
  });
  if (!isFloorPlanPublished(plan?.publishStatus)) {
    throw new AppError(
      'This floor is not published for student navigation yet. Ask an admin to publish it in Indoor Navigation.',
      404
    );
  }
}

export async function assertRoutePublishedForStudents(
  segments: Array<{ buildingId: string; floor: number }>
): Promise<void> {
  const seen = new Set<string>();
  for (const seg of segments) {
    const key = `${seg.buildingId}-${seg.floor}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await assertStudentFloorAccess(seg.buildingId, seg.floor);
  }
}
