"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKER_TYPE_COLORS = exports.MANUAL_PLACE_MARKER_TYPES = exports.OFFICE_LINK_MARKER_TYPES = exports.HALL_LINK_MARKER_TYPES = exports.MAP_MARKER_TYPE_LABELS = exports.MAP_MARKER_TYPES = void 0;
exports.markerTypeLinksToHall = markerTypeLinksToHall;
exports.markerTypeLinksToOffice = markerTypeLinksToOffice;
exports.isMapMarkerType = isMapMarkerType;
exports.formatMarkerTypeLabel = formatMarkerTypeLabel;
/** Common place types for faculty indoor maps (buildings, floor plans, markers). */
exports.MAP_MARKER_TYPES = [
    'ENTRANCE',
    'EXIT',
    'LOBBY',
    'STAIRS',
    'LIFT',
    'STAIRS_LIFT',
    'PARKING',
    'LECTURE_HALL',
    'SEMINAR_ROOM',
    'AUDITORIUM',
    'CONFERENCE_ROOM',
    'ROOM',
    'HALL',
    'LAB',
    'WORKSHOP',
    'LIBRARY',
    'OFFICE',
    'COUNTER',
    'CAFETERIA',
    'STORE',
    'CLINIC',
    'TOILET',
    'PRAYER_ROOM',
    'SPORTS',
    'AMENITY',
];
exports.MAP_MARKER_TYPE_LABELS = {
    ENTRANCE: 'Entrance',
    EXIT: 'Exit',
    LOBBY: 'Lobby / waiting area',
    STAIRS: 'Staircase',
    LIFT: 'Lift / elevator',
    STAIRS_LIFT: 'Stairs & lift (same spot)',
    PARKING: 'Parking',
    LECTURE_HALL: 'Lecture hall',
    SEMINAR_ROOM: 'Seminar room',
    AUDITORIUM: 'Auditorium',
    CONFERENCE_ROOM: 'Conference room',
    ROOM: 'Room',
    HALL: 'Hall (general)',
    LAB: 'Laboratory',
    WORKSHOP: 'Workshop',
    LIBRARY: 'Library',
    OFFICE: 'Office',
    COUNTER: 'Counter / reception',
    CAFETERIA: 'Cafeteria / canteen',
    STORE: 'Store / supplies',
    CLINIC: 'Medical / clinic',
    TOILET: 'Toilet / washroom',
    PRAYER_ROOM: 'Prayer room',
    SPORTS: 'Sports / gym',
    AMENITY: 'Other amenity',
};
exports.HALL_LINK_MARKER_TYPES = new Set([
    'HALL',
    'LECTURE_HALL',
    'SEMINAR_ROOM',
    'AUDITORIUM',
    'CONFERENCE_ROOM',
    'LAB',
    'WORKSHOP',
]);
exports.OFFICE_LINK_MARKER_TYPES = new Set(['OFFICE']);
function markerTypeLinksToHall(type) {
    return exports.HALL_LINK_MARKER_TYPES.has(type);
}
function markerTypeLinksToOffice(type) {
    return exports.OFFICE_LINK_MARKER_TYPES.has(type);
}
function isMapMarkerType(type) {
    return exports.MAP_MARKER_TYPES.includes(type);
}
/** Types shown first when admin adds a place manually on the floor plan. */
exports.MANUAL_PLACE_MARKER_TYPES = [
    'ROOM',
    'LAB',
    'LECTURE_HALL',
    'OFFICE',
    'HALL',
    'STAIRS_LIFT',
    'STAIRS',
    'LIFT',
    'TOILET',
    'ENTRANCE',
    'LOBBY',
    'EXIT',
    'CAFETERIA',
    'STORE',
    'COUNTER',
    'AMENITY',
];
function formatMarkerTypeLabel(type) {
    if (isMapMarkerType(type))
        return exports.MAP_MARKER_TYPE_LABELS[type];
    return type
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
exports.MARKER_TYPE_COLORS = {
    ENTRANCE: '#ef4444',
    EXIT: '#dc2626',
    LOBBY: '#94a3b8',
    STAIRS: '#78716c',
    LIFT: '#57534e',
    STAIRS_LIFT: '#78716c',
    PARKING: '#64748b',
    LECTURE_HALL: '#2563eb',
    SEMINAR_ROOM: '#3b82f6',
    AUDITORIUM: '#1d4ed8',
    CONFERENCE_ROOM: '#60a5fa',
    ROOM: '#6366f1',
    HALL: '#3b82f6',
    LAB: '#10b981',
    WORKSHOP: '#059669',
    LIBRARY: '#8b5cf6',
    OFFICE: '#22c55e',
    COUNTER: '#a855f7',
    CAFETERIA: '#f59e0b',
    STORE: '#d97706',
    CLINIC: '#ec4899',
    TOILET: '#06b6d4',
    PRAYER_ROOM: '#14b8a6',
    SPORTS: '#84cc16',
    AMENITY: '#6b7280',
};
//# sourceMappingURL=mapMarkerTypes.js.map