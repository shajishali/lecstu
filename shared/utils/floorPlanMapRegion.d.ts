/** Percent region of floor-plan image that contains the architectural drawing (excludes legend/footer). */
export type FloorPlanDrawableRegion = {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
export declare const DEFAULT_DRAWABLE_REGION: FloorPlanDrawableRegion;
export declare function parseDrawableRegion(raw: unknown): FloorPlanDrawableRegion;
/** Map drawable canvas coords (0–100) back to stored image coords (0–100 full JPG). */
export declare function displayToStorageCoord(x: number, y: number, region?: FloorPlanDrawableRegion): {
    x: number;
    y: number;
};
/**
 * Numbered directory-board room centers (display coords within drawable region).
 * Layout: open lobby on the right, rooms 1–9 in the centre, #3 cafeteria on the left.
 */
export declare const LEGEND_NUMBER_DISPLAY_POSITIONS: Record<number, {
    x: number;
    y: number;
}>;
/** "You are here" — open lobby area on the right of the floor plan. */
export declare const ENTRANCE_DISPLAY_POSITION: {
    x: number;
    y: number;
};
/** Walkable corridor spine (right → left), matching typical indoor paths. */
export declare const CORRIDOR_SPINE_DISPLAY: Array<{
    x: number;
    y: number;
    label: string;
}>;
/** Map stored image coords (0–100 full JPG) to drawable canvas coords (0–100). */
export declare function storageToDisplayCoord(x: number, y: number, region?: FloorPlanDrawableRegion): {
    x: number;
    y: number;
    inRegion: boolean;
};
export declare function transformPolylineForDisplay(points: Array<{
    x: number;
    y: number;
}>, region?: FloorPlanDrawableRegion): string;
/** Strip legend prefixes like "3. CAFETERIA" → "CAFETERIA" for search matching. */
export declare function normalizeRoomLabelForSearch(label: string): string;
//# sourceMappingURL=floorPlanMapRegion.d.ts.map