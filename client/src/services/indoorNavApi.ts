import api from './api';

export type IndoorRouteResult = {
  found: boolean;
  destinationLabel?: string;
  startLabel?: string;
  startFloor?: number;
  steps?: Array<{ instruction: string; floor: number; polylineIndex?: number; buildingId?: string } | string>;
  polyline?: Array<{ x: number; y: number; floor: number; buildingId?: string; label?: string }>;
  distanceMeters?: number;
  estimatedMinutes?: number;
  pathfindingAlgorithm?: string;
  crossBuilding?: boolean;
  buildingPath?: string[];
  legs?: Array<{
    buildingId: string;
    buildingCode: string;
    buildingName: string;
    pathNodeIds: string[];
    polyline: Array<{ x: number; y: number; floor: number; buildingId?: string; label?: string }>;
    segments: Array<{ buildingId: string; floor: number; polyline: [number, number][] }>;
    steps: Array<{ instruction: string; floor: number; polylineIndex?: number; buildingId?: string }>;
  }>;
  fromBuilding?: { id: string; name: string; code: string };
  building?: { id: string; name: string; code: string };
  marker?: { id: string; label: string; floor: number } | null;
  segments?: Array<{ buildingId: string; floor: number; polyline: [number, number][] }>;
  pathNodeIds?: string[];
  startNodeId?: string;
  goalNodeId?: string;
  sessionId?: string;
  deepLink?: string | null;
  message?: string;
};

export async function postIndoorRoute(body: {
  buildingId?: string;
  fromBuildingId?: string;
  toBuildingId?: string;
  toMarkerId?: string;
  fromMarkerId?: string;
  toHallId?: string;
  q?: string;
  sourceQ?: string;
  fromNodeId?: string;
  floor?: number;
  fromFloor?: number;
  saveSession?: boolean;
  useActivePosition?: boolean;
  sessionId?: string;
}): Promise<IndoorRouteResult> {
  const res = await api.post('/indoor-nav/route', body);
  return res.data.data;
}

export type NavigationSession = {
  id: string;
  buildingId: string;
  currentNodeId?: string | null;
  currentFloor?: number | null;
  stepIndex?: number;
  positionSource?: string;
  destinationNodeId?: string | null;
  routePayload?: IndoorRouteResult | null;
};

export async function postQrPosition(
  code: string,
  options?: { reroute?: boolean }
): Promise<{
  position: { nodeId: string; floor: number; label: string };
  session: NavigationSession;
  route?: IndoorRouteResult | null;
  stepIndex?: number;
  message: string;
}> {
  const res = await api.post('/indoor-nav/position/qr', {
    code,
    reroute: options?.reroute !== false,
  });
  return res.data.data;
}

export async function patchSessionStep(sessionId: string, stepIndex: number) {
  const res = await api.patch(`/indoor-nav/session/${sessionId}/step`, { stepIndex });
  return res.data.data;
}

export async function getActiveNavigationSession(buildingId?: string) {
  const res = await api.get('/indoor-nav/session/active', {
    params: buildingId ? { buildingId } : undefined,
  });
  return res.data.data;
}

export async function postIndoorNavigation(message: string, buildingId?: string) {
  const res = await api.post('/indoor-nav/navigation', { message, buildingId });
  return res.data.data;
}

export async function listQrCodes(buildingId: string) {
  const res = await api.get('/indoor-nav/qr', { params: { buildingId } });
  return res.data.data;
}

export async function createQrCode(body: {
  buildingId: string;
  navNodeId: string;
  label?: string;
  code?: string;
}) {
  const res = await api.post('/indoor-nav/qr', body);
  return res.data.data;
}

export async function deleteQrCode(id: string) {
  await api.delete(`/indoor-nav/qr/${id}`);
}

export async function postStoryGuide(body: {
  buildingId: string;
  destination?: string;
  from?: string;
  message?: string;
  floor?: number;
}) {
  const res = await api.post('/indoor-nav/story', body);
  return res.data.data;
}

export async function getGuidePlaces(buildingId: string, floor?: number) {
  const res = await api.get('/indoor-nav/places', {
    params: floor !== undefined ? { buildingId, floor } : { buildingId },
  });
  return res.data.data;
}

export interface SelectablePlace {
  id: string;
  name: string;
  floor: number;
  markerId?: string;
}

/** Guide places + approved map markers — same source as Find My Way. */
export async function loadBuildingPlaces(buildingId: string): Promise<SelectablePlace[]> {
  const [guidePlaces, markersRes] = await Promise.all([
    getGuidePlaces(buildingId).catch(() => []),
    api.get('/map/markers', { params: { buildingId } }).catch(() => ({ data: { data: [] } })),
  ]);

  const byKey = new Map<string, SelectablePlace>();

  for (const p of guidePlaces as SelectablePlace[]) {
    const key = p.markerId || p.id || `${p.floor}-${p.name}`;
    byKey.set(key, {
      id: p.id || key,
      name: p.name,
      floor: p.floor,
      markerId: p.markerId,
    });
  }

  for (const m of markersRes.data.data || []) {
    if (!byKey.has(m.id)) {
      byKey.set(m.id, {
        id: m.id,
        name: m.label,
        floor: m.floor,
        markerId: m.id,
      });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.floor - b.floor || a.name.localeCompare(b.name),
  );
}

export async function getBuildingsWithGuides(): Promise<
  Array<{ buildingId: string; buildingName: string; placeCount: number; floors: number[] }>
> {
  const res = await api.get('/indoor-nav/buildings-with-guides');
  return res.data.data || [];
}

export type TodayRouteLeg = {
  slotId: string;
  startTime: string;
  endTime: string;
  courseName: string;
  lecturerName: string;
  hall: { id: string; name: string; building: string; floor: number };
  mapBuildingId: string | null;
  route: IndoorRouteResult;
};

export type TodayRoutesResult = {
  legs: TodayRouteLeg[];
  deepLinkAll: string;
  hasCrossBuilding: boolean;
  date?: string;
  dayOfWeek?: string;
};

export async function getTodayIndoorRoutes(): Promise<TodayRoutesResult> {
  const res = await api.get('/map/indoor-route/today');
  return res.data.data;
}
