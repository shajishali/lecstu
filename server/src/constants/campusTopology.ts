import type { FacultyBuildingCode } from './facultyBuildings';
import { getNeighborBuildingCodes } from './buildingConnections';

/** Buildings that may connect when at least one same-floor link exists. ACAD is the hub. */
export const FACULTY_BUILDING_ADJACENCY: Record<FacultyBuildingCode, FacultyBuildingCode[]> = {
  ADMIN: ['ACAD'],
  ACAD: ['ADMIN', 'LAB'],
  LAB: ['ACAD'],
};

export const FACULTY_BUILDING_CODES: FacultyBuildingCode[] = ['ADMIN', 'ACAD', 'LAB'];

export function isFacultyBuildingCode(code: string): code is FacultyBuildingCode {
  return code === 'ADMIN' || code === 'ACAD' || code === 'LAB';
}

/** Building-level path for hints (actual routing uses the full nav graph). */
export function findBuildingPath(
  fromCode: string,
  toCode: string
): FacultyBuildingCode[] | null {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  if (from === to) {
    return isFacultyBuildingCode(from) ? [from] : null;
  }
  if (!isFacultyBuildingCode(from) || !isFacultyBuildingCode(to)) return null;

  const queue: FacultyBuildingCode[][] = [[from]];
  const visited = new Set<string>([from]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const neighbor of FACULTY_BUILDING_ADJACENCY[last]) {
      if (neighbor === to) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return null;
}

export function isDirectBuildingLinkAllowed(fromCode: string, toCode: string): boolean {
  const from = fromCode.toUpperCase();
  const to = toCode.toUpperCase();
  if (from === to) return false;
  if (!isFacultyBuildingCode(from) || !isFacultyBuildingCode(to)) return false;
  return FACULTY_BUILDING_ADJACENCY[from].includes(to);
}

/** Neighbors reachable on a specific floor (for admin matrix). */
export function neighborsOnFloor(code: string, floor: number): FacultyBuildingCode[] {
  return getNeighborBuildingCodes(code, floor);
}
