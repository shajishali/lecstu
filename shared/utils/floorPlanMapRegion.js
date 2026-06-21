"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CORRIDOR_SPINE_DISPLAY = exports.ENTRANCE_DISPLAY_POSITION = exports.LEGEND_NUMBER_DISPLAY_POSITIONS = exports.DEFAULT_DRAWABLE_REGION = void 0;
exports.parseDrawableRegion = parseDrawableRegion;
exports.displayToStorageCoord = displayToStorageCoord;
exports.storageToDisplayCoord = storageToDisplayCoord;
exports.transformPolylineForDisplay = transformPolylineForDisplay;
exports.normalizeRoomLabelForSearch = normalizeRoomLabelForSearch;
exports.DEFAULT_DRAWABLE_REGION = {
    x0: 0,
    y0: 0,
    x1: 100,
    y1: 72,
};
function parseDrawableRegion(raw) {
    if (!raw || typeof raw !== 'object')
        return { ...exports.DEFAULT_DRAWABLE_REGION };
    const r = raw;
    const x0 = Number(r.x0 ?? 0);
    const y0 = Number(r.y0 ?? 0);
    const x1 = Number(r.x1 ?? 100);
    const y1 = Number(r.y1 ?? 72);
    if (x1 <= x0 || y1 <= y0)
        return { ...exports.DEFAULT_DRAWABLE_REGION };
    return {
        x0: Math.max(0, Math.min(100, x0)),
        y0: Math.max(0, Math.min(100, y0)),
        x1: Math.max(0, Math.min(100, x1)),
        y1: Math.max(0, Math.min(100, y1)),
    };
}
/** Map drawable canvas coords (0–100) back to stored image coords (0–100 full JPG). */
function displayToStorageCoord(x, y, region = exports.DEFAULT_DRAWABLE_REGION) {
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
exports.LEGEND_NUMBER_DISPLAY_POSITIONS = {
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
exports.ENTRANCE_DISPLAY_POSITION = { x: 78, y: 48 };
/** Walkable corridor spine (right → left), matching typical indoor paths. */
exports.CORRIDOR_SPINE_DISPLAY = [
    { x: 62, y: 48, label: 'East corridor' },
    { x: 48, y: 48, label: 'Central corridor' },
    { x: 32, y: 46, label: 'West corridor' },
];
/** Map stored image coords (0–100 full JPG) to drawable canvas coords (0–100). */
function storageToDisplayCoord(x, y, region = exports.DEFAULT_DRAWABLE_REGION) {
    const w = region.x1 - region.x0;
    const h = region.y1 - region.y0;
    const inRegion = x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
    return {
        x: ((x - region.x0) / w) * 100,
        y: ((y - region.y0) / h) * 100,
        inRegion,
    };
}
function transformPolylineForDisplay(points, region = exports.DEFAULT_DRAWABLE_REGION) {
    return points
        .map((p) => {
        const d = storageToDisplayCoord(p.x, p.y, region);
        return `${d.x},${d.y}`;
    })
        .join(' ');
}
/** Strip legend prefixes like "3. CAFETERIA" → "CAFETERIA" for search matching. */
function normalizeRoomLabelForSearch(label) {
    return label
        .replace(/^\d{1,2}\s*[\.\):\-]\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();
}
//# sourceMappingURL=floorPlanMapRegion.js.map