import type { FacultyBuildingCode } from './facultyBuildings';
import { parseMarkerMetadata, type BuildingConnectionMeta } from '../utils/markerMetadata';

export const CROSS_BUILDING_EDGE_LABEL = 'cross-building';

/** Same-floor horizontal link neighbors (admin dropdown + routing adjacency). */
export const FACULTY_SAME_FLOOR_NEIGHBORS: Record<FacultyBuildingCode, FacultyBuildingCode[]> = {
  ADMIN: ['ACAD', 'LAB'],
  ACAD: ['ADMIN'],
  LAB: ['ADMIN'],
};

const FACULTY_ADJACENCY = FACULTY_SAME_FLOOR_NEIGHBORS;

function isFacultyCode(code: string): code is FacultyBuildingCode {
  return code === 'ADMIN' || code === 'ACAD' || code === 'LAB';
}

/** One marker per building side at an inter-building doorway. */
export type BuildingConnectionDef = {
  hostBuildingCode: FacultyBuildingCode;
  targetBuildingCode: FacultyBuildingCode;
  markerType: 'ENTRANCE' | 'EXIT';
  label: string;
};

/** Doorway markers: ADMIN↔ACAD and ADMIN↔LAB (no direct ACAD↔LAB). */
export const FACULTY_BUILDING_CONNECTIONS: BuildingConnectionDef[] = [
  {
    hostBuildingCode: 'ADMIN',
    targetBuildingCode: 'ACAD',
    markerType: 'EXIT',
    label: 'Exit to Academic Building',
  },
  {
    hostBuildingCode: 'ACAD',
    targetBuildingCode: 'ADMIN',
    markerType: 'ENTRANCE',
    label: 'Entrance from Administration Building',
  },
  {
    hostBuildingCode: 'ADMIN',
    targetBuildingCode: 'LAB',
    markerType: 'EXIT',
    label: 'Exit to Laboratory Building',
  },
  {
    hostBuildingCode: 'LAB',
    targetBuildingCode: 'ADMIN',
    markerType: 'ENTRANCE',
    label: 'Entrance from Administration Building',
  },
];

export function getConnectionsForBuilding(code: string): BuildingConnectionDef[] {
  const upper = code.toUpperCase();
  return FACULTY_BUILDING_CONNECTIONS.filter((c) => c.hostBuildingCode === upper);
}

/** Building-level adjacency (same-floor doorway may still be blocked per floor rules). */
export function isDirectBuildingLinkAllowed(fromCode: string, toCode: string): boolean {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  if (from === to) return false;
  if (!isFacultyCode(from) || !isFacultyCode(to)) return false;
  return FACULTY_ADJACENCY[from].includes(to);
}

/** Which neighbor buildings may have a doorway on this floor number. */
export function getNeighborBuildingCodes(code: string, _floor: number): FacultyBuildingCode[] {
  const c = code.toUpperCase();
  if (!isFacultyCode(c)) return [];
  return [...FACULTY_SAME_FLOOR_NEIGHBORS[c]];
}

/** Floors where a same-floor link between two buildings is allowed. */
export function floorsForBuildingPair(
  codeA: string,
  codeB: string,
  floorsA: number,
  floorsB: number
): number[] {
  const a = codeA.toUpperCase();
  const b = codeB.toUpperCase();
  if (a === b) return [];

  const shared = Math.min(floorsA, floorsB);
  const floors: number[] = [];
  for (let f = 0; f < shared; f++) {
    if (isSameFloorLinkAllowed(a, b, f)) floors.push(f);
  }
  return floors;
}

/** Whether a cross-building edge may exist on this floor. */
export function isSameFloorLinkAllowed(
  fromCode: string,
  toCode: string,
  floor: number
): boolean {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  if (from === to) return false;
  if (!isFacultyCode(from) || !isFacultyCode(to)) return false;
  if (!isDirectBuildingLinkAllowed(from, to)) return false;

  return true;
}

/** Which neighbor building a doorway marker faces (metadata first, then label heuristics). */
export function inferDoorwayTargetBuilding(
  hostBuildingCode: string,
  label: string,
  metadata?: unknown
): FacultyBuildingCode | null {
  const meta = parseMarkerMetadata(metadata);
  const conn = meta.buildingConnection as BuildingConnectionMeta | undefined;
  if (conn?.targetBuildingCode && isFacultyCode(conn.targetBuildingCode)) {
    return conn.targetBuildingCode;
  }

  const host = hostBuildingCode.toUpperCase();
  const L = label.toUpperCase();

  if (host === 'ADMIN') {
    if (L.includes('ACADEMIC') || /\bACAD\b/.test(L)) return 'ACAD';
    if (L.includes('LABORATORY') || /\bLAB\b/.test(L)) return 'LAB';
    if (L.includes('FACULTY') && !L.includes('ACADEMIC') && !L.includes('LABORATORY')) return 'ACAD';
  }
  if (host === 'ACAD') {
    if (L.includes('ADMIN') || L.includes('ADMINISTRATION')) return 'ADMIN';
    if (L.includes('FACULTY')) return 'ADMIN';
  }
  if (host === 'LAB') {
    if (L.includes('ADMIN') || L.includes('ADMINISTRATION')) return 'ADMIN';
  }

  return null;
}

/** Cross-building edge must connect matching doorway pairs (ADMIN ACAD door ↔ ACAD, not ADMIN ACAD door ↔ LAB). */
export function isValidCrossBuildingDoorwayPair(
  fromCode: string,
  toCode: string,
  fromLabel: string,
  toLabel: string,
  fromMetadata?: unknown,
  toMetadata?: unknown
): boolean {
  if (!isDirectBuildingLinkAllowed(fromCode, toCode)) return false;

  const fromTarget = inferDoorwayTargetBuilding(fromCode, fromLabel, fromMetadata);
  const toTarget = inferDoorwayTargetBuilding(toCode, toLabel, toMetadata);

  if (fromTarget && toTarget) {
    return fromTarget === toCode.toUpperCase() && toTarget === fromCode.toUpperCase();
  }

  // Legacy markers without metadata: require topology only (admin should add metadata).
  return fromTarget == null && toTarget == null;
}
