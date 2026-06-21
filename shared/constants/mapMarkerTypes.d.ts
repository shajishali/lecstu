/** Common place types for faculty indoor maps (buildings, floor plans, markers). */
export declare const MAP_MARKER_TYPES: readonly ["ENTRANCE", "EXIT", "LOBBY", "STAIRS", "LIFT", "STAIRS_LIFT", "PARKING", "LECTURE_HALL", "SEMINAR_ROOM", "AUDITORIUM", "CONFERENCE_ROOM", "ROOM", "HALL", "LAB", "WORKSHOP", "LIBRARY", "OFFICE", "COUNTER", "CAFETERIA", "STORE", "CLINIC", "TOILET", "PRAYER_ROOM", "SPORTS", "AMENITY"];
export type MapMarkerTypeValue = (typeof MAP_MARKER_TYPES)[number];
export declare const MAP_MARKER_TYPE_LABELS: Record<MapMarkerTypeValue, string>;
export declare const HALL_LINK_MARKER_TYPES: Set<"WORKSHOP" | "LAB" | "HALL" | "ROOM" | "STAIRS" | "LIFT" | "ENTRANCE" | "EXIT" | "STAIRS_LIFT" | "TOILET" | "LOBBY" | "PARKING" | "LECTURE_HALL" | "SEMINAR_ROOM" | "AUDITORIUM" | "CONFERENCE_ROOM" | "LIBRARY" | "OFFICE" | "COUNTER" | "CAFETERIA" | "STORE" | "CLINIC" | "PRAYER_ROOM" | "SPORTS" | "AMENITY">;
export declare const OFFICE_LINK_MARKER_TYPES: Set<"WORKSHOP" | "LAB" | "HALL" | "ROOM" | "STAIRS" | "LIFT" | "ENTRANCE" | "EXIT" | "STAIRS_LIFT" | "TOILET" | "LOBBY" | "PARKING" | "LECTURE_HALL" | "SEMINAR_ROOM" | "AUDITORIUM" | "CONFERENCE_ROOM" | "LIBRARY" | "OFFICE" | "COUNTER" | "CAFETERIA" | "STORE" | "CLINIC" | "PRAYER_ROOM" | "SPORTS" | "AMENITY">;
export declare function markerTypeLinksToHall(type: string): boolean;
export declare function markerTypeLinksToOffice(type: string): boolean;
export declare function isMapMarkerType(type: string): type is MapMarkerTypeValue;
/** Types shown first when admin adds a place manually on the floor plan. */
export declare const MANUAL_PLACE_MARKER_TYPES: MapMarkerTypeValue[];
export declare function formatMarkerTypeLabel(type: string): string;
export declare const MARKER_TYPE_COLORS: Record<string, string>;
//# sourceMappingURL=mapMarkerTypes.d.ts.map