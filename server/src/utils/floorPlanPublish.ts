import type { FloorPlanPublishStatus } from '../generated/prisma/client';

export const PUBLISHED_FLOOR_STATUS: FloorPlanPublishStatus = 'PUBLISHED';

export function isFloorPlanPublished(status: FloorPlanPublishStatus | string | null | undefined): boolean {
  return status === PUBLISHED_FLOOR_STATUS;
}

/** Prisma filter: student/public indoor navigation reads published floors only. */
export function publishedFloorPlanFilter() {
  return { publishStatus: PUBLISHED_FLOOR_STATUS as FloorPlanPublishStatus };
}
