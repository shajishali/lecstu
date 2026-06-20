/** Percent region of floor-plan image that contains the architectural drawing (excludes legend/footer). */
export type FloorPlanDrawableRegion = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export const DEFAULT_DRAWABLE_REGION: FloorPlanDrawableRegion = {
  x0: 0,
  y0: 0,
  x1: 100,
  y1: 72,
};

export function parseDrawableRegion(raw: unknown): FloorPlanDrawableRegion {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DRAWABLE_REGION };
  const r = raw as Record<string, unknown>;
  const x0 = Number(r.x0 ?? 0);
  const y0 = Number(r.y0 ?? 0);
  const x1 = Number(r.x1 ?? 100);
  const y1 = Number(r.y1 ?? 72);
  if (x1 <= x0 || y1 <= y0) return { ...DEFAULT_DRAWABLE_REGION };
  return {
    x0: Math.max(0, Math.min(100, x0)),
    y0: Math.max(0, Math.min(100, y0)),
    x1: Math.max(0, Math.min(100, x1)),
    y1: Math.max(0, Math.min(100, y1)),
  };
}

/** Map drawable canvas coords (0–100) back to stored image coords (0–100 full JPG). */
export function displayToStorageCoord(
  x: number,
  y: number,
  region: FloorPlanDrawableRegion = DEFAULT_DRAWABLE_REGION
): { x: number; y: number } {
  const w = region.x1 - region.x0;
  const h = region.y1 - region.y0;
  return {
    x: region.x0 + (x / 100) * w,
    y: region.y0 + (y / 100) * h,
  };
}

/**
 * Numbered directory-board room centers (display coords within drawable region).
 * Layout: open lobby on the right, rooms 1–9 in the centre, #3 cafeteria on the left.
 */
export const LEGEND_NUMBER_DISPLAY_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 58, y: 54 },
  2: { x: 40, y: 52 },
  3: { x: 14, y: 40 },
  4: { x: 46, y: 28 },
  5: { x: 60, y: 66 },
  6: { x: 50, y: 70 },
  7: { x: 40, y: 72 },
  8: { x: 30, y: 74 },
  9: { x: 20, y: 76 },
  10: { x: 10, y: 78 },
};

/** "You are here" — open lobby area on the right of the floor plan. */
export const ENTRANCE_DISPLAY_POSITION = { x: 78, y: 48 };

/** Walkable corridor spine (right → left), matching typical indoor paths. */
export const CORRIDOR_SPINE_DISPLAY: Array<{ x: number; y: number; label: string }> = [
  { x: 62, y: 48, label: 'East corridor' },
  { x: 48, y: 48, label: 'Central corridor' },
  { x: 32, y: 46, label: 'West corridor' },
];

/** Map stored image coords (0–100 full JPG) to drawable canvas coords (0–100). */
export function storageToDisplayCoord(
  x: number,
  y: number,
  region: FloorPlanDrawableRegion = DEFAULT_DRAWABLE_REGION
): { x: number; y: number; inRegion: boolean } {
  const w = region.x1 - region.x0;
  const h = region.y1 - region.y0;
  const inRegion = x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
  return {
    x: ((x - region.x0) / w) * 100,
    y: ((y - region.y0) / h) * 100,
    inRegion,
  };
}

export function transformPolylineForDisplay(
  points: Array<{ x: number; y: number }>,
  region: FloorPlanDrawableRegion = DEFAULT_DRAWABLE_REGION
): string {
  return points
    .map((p) => {
      const d = storageToDisplayCoord(p.x, p.y, region);
      return `${d.x},${d.y}`;
    })
    .join(' ');
}

/** Strip legend prefixes like "3. CAFETERIA" → "CAFETERIA" for search matching. */
export function normalizeRoomLabelForSearch(label: string): string {
  return label
    .replace(/^\d{1,2}\s*[\.\):\-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}
