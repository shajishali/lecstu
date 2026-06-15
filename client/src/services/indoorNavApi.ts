import api from './api';

export type IndoorRouteResult = {
  found: boolean;
  destinationLabel?: string;
  startLabel?: string;
  startFloor?: number;
  steps?: Array<{ instruction: string; floor: number; polylineIndex?: number } | string>;
  polyline?: Array<{ x: number; y: number; floor: number; buildingId?: string; label?: string }>;
  distanceMeters?: number;
  estimatedMinutes?: number;
  pathfindingAlgorithm?: string;
  crossBuilding?: boolean;
  buildingPath?: string[];
  fromBuilding?: { id: string; name: string; code: string };
  building?: { id: string; name: string; code: string };
  marker?: { id: string; label: string; floor: number } | null;
  segments?: Array<{ buildingId: string; floor: number; polyline: [number, number][] }>;
  pathNodeIds?: string[];
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
}): Promise<IndoorRouteResult> {
  const res = await api.post('/indoor-nav/route', body);
  return res.data.data;
}

export async function postQrPosition(code: string): Promise<{
  position: { nodeId: string; floor: number; label: string };
  session: { id: string; buildingId: string };
  message: string;
}> {
  const res = await api.post('/indoor-nav/position/qr', { code });
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

export async function getBuildingsWithGuides(): Promise<
  Array<{ buildingId: string; buildingName: string; placeCount: number; floors: number[] }>
> {
  const res = await api.get('/indoor-nav/buildings-with-guides');
  return res.data.data || [];
}
