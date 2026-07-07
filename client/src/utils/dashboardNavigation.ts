/** Default start for dashboard quick navigation - Administration Building ground entrance. */
export const DASHBOARD_NAV_FROM_BUILDING_CODE = 'ADMIN';
export const DASHBOARD_NAV_FROM_FLOOR = 0;

export interface MapBuildingRef {
  id: string;
  code?: string;
  name: string;
}

export function findBuildingByCode(
  buildings: MapBuildingRef[],
  code: string,
): MapBuildingRef | undefined {
  const normalized = code.trim().toUpperCase();
  return buildings.find((b) => (b.code || '').toUpperCase() === normalized);
}

export function buildDashboardNavigateUrl(options: {
  fromBuildingId: string;
  toBuildingId: string;
  destination: string;
  toFloor?: number;
  toMarkerId?: string;
}): string {
  const params = new URLSearchParams({
    auto: '1',
    fromBuildingId: options.fromBuildingId,
    fromFloor: String(DASHBOARD_NAV_FROM_FLOOR),
    toBuildingId: options.toBuildingId,
    q: options.destination.trim(),
  });
  if (options.toFloor !== undefined) {
    params.set('floor', String(options.toFloor));
  }
  if (options.toMarkerId) {
    params.set('toMarkerId', options.toMarkerId);
  }
  return `/navigate?${params.toString()}`;
}
