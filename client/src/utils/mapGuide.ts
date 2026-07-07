/** Deep link to the indoor guide page (floor plan + walking story). */
export function buildCampusMapUrl(params: {
  buildingId: string;
  floor?: number;
  hallId?: string;
  markerId?: string;
  destination?: string;
  guide?: string;
  q?: string;
}): string {
  const search = new URLSearchParams({ buildingId: params.buildingId });
  if (params.floor !== undefined) search.set('floor', String(params.floor));
  if (params.hallId) search.set('hallId', params.hallId);
  if (params.markerId) search.set('markerId', params.markerId);
  const label = params.q || params.destination || params.guide;
  if (label) search.set('q', label);
  return `/navigate?${search.toString()}`;
}

/** Multi-leg “guide all today” on the unified navigate page. */
export function buildGuideAllTodayUrl(): string {
  return '/navigate?today=1';
}

/** @deprecated Use buildCampusMapUrl - kept for imports that pass `today` / `leg`. */
export function buildGuideUrl(params: {
  buildingId: string;
  floor: number;
  hallId?: string;
  markerId?: string;
  destination?: string;
  today?: boolean;
  leg?: number;
}): string {
  if (params.today) {
    const q = new URLSearchParams({ today: '1' });
    if (params.leg !== undefined) q.set('leg', String(params.leg));
    return `/navigate?${q.toString()}`;
  }
  return buildCampusMapUrl({
    buildingId: params.buildingId,
    floor: params.floor,
    hallId: params.hallId,
    markerId: params.markerId,
    destination: params.destination,
    guide: params.destination,
  });
}

/** Normalize legacy /map? and /map/guide? links to /navigate?. */
export function normalizeMapLink(path: string): string {
  if (path.startsWith('/navigate?') || path === '/navigate') return path;

  if (path.startsWith('/map/guide?')) {
    const qs = path.slice('/map/guide?'.length);
    return qs ? `/navigate?${qs}` : '/navigate';
  }

  if (path.startsWith('/map?')) {
    const params = new URLSearchParams(path.slice('/map?'.length));
    const next = new URLSearchParams();
    const buildingId = params.get('buildingId');
    const label =
      params.get('q') || params.get('destination') || params.get('guide') || params.get('markerId');
    if (buildingId) next.set('buildingId', buildingId);
    if (params.get('hallId')) next.set('hallId', params.get('hallId')!);
    if (params.get('toHallId')) next.set('toHallId', params.get('toHallId')!);
    if (params.get('markerId')) next.set('markerId', params.get('markerId')!);
    if (params.get('toMarkerId')) next.set('toMarkerId', params.get('toMarkerId')!);
    if (params.get('floor')) next.set('floor', params.get('floor')!);
    if (label && !label.match(/^[0-9a-f-]{36}$/i)) next.set('q', label);
    else if (params.get('destination')) next.set('q', params.get('destination')!);
    const qs = next.toString();
    return qs ? `/navigate?${qs}` : '/navigate';
  }

  return path;
}
