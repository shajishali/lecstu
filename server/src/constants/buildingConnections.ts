import type { FacultyBuildingCode } from './facultyBuildings';

export const CROSS_BUILDING_EDGE_LABEL = 'cross-building';

const FACULTY_ADJACENCY: Record<FacultyBuildingCode, FacultyBuildingCode[]> = {
  ADMIN: ['ACAD'],
  ACAD: ['ADMIN', 'LAB'],
  LAB: ['ACAD'],
};

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

/** Four connection points: ADMIN↔ACAD and ACAD↔LAB (ADMIN↔LAB only via ACAD). */
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
    hostBuildingCode: 'ACAD',
    targetBuildingCode: 'LAB',
    markerType: 'EXIT',
    label: 'Exit to Laboratory Building',
  },
  {
    hostBuildingCode: 'LAB',
    targetBuildingCode: 'ACAD',
    markerType: 'ENTRANCE',
    label: 'Entrance from Academic Building',
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

  if (c === 'ADMIN') return ['ACAD'];
  if (c === 'ACAD') return ['ADMIN', 'LAB'];
  if (c === 'LAB') return ['ACAD'];
  return [];
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

  // No direct ADMIN ↔ LAB — cross-building routes use Academic as hub.
  if (
    (from === 'ADMIN' && to === 'LAB') ||
    (from === 'LAB' && to === 'ADMIN')
  ) {
    return false;
  }

  return true;
}
