export type FacultyBuildingCode = 'ACAD' | 'ADMIN' | 'LAB';

export type VerticalShaftDef = {
  name: string;
  buildingCodes: FacultyBuildingCode[];
  /** Highest floor index (inclusive). Ground = 0, Floor 9 = 9. */
  maxFloor: number;
};

export const VERTICAL_SHAFT_DEFINITIONS: VerticalShaftDef[] = [
  { name: 'STAIRCASE & LIFT 1', buildingCodes: ['ACAD'], maxFloor: 9 },
  { name: 'STAIRCASE & LIFT 2', buildingCodes: ['ACAD'], maxFloor: 9 },
  { name: 'STAIRCASE & LIFT 3', buildingCodes: ['ADMIN'], maxFloor: 9 },
  { name: 'STAIRCASE & LIFT 4', buildingCodes: ['LAB'], maxFloor: 11 },
  { name: 'STAIRCASE & LIFT 5', buildingCodes: ['LAB'], maxFloor: 11 },
];

export const VERTICAL_SHAFT_BUILDING_GUIDE: Array<{
  code: FacultyBuildingCode;
  label: string;
  shafts: string;
  floors: string;
}> = [
  {
    code: 'ACAD',
    label: 'Academic Building',
    shafts: 'STAIRCASE & LIFT 1, STAIRCASE & LIFT 2',
    floors: 'Ground (G) through Floor 9',
  },
  {
    code: 'ADMIN',
    label: 'Administration Building',
    shafts: 'STAIRCASE & LIFT 3',
    floors: 'Ground (G) through Floor 9',
  },
  {
    code: 'LAB',
    label: 'Laboratory Building',
    shafts: 'STAIRCASE & LIFT 4, STAIRCASE & LIFT 5',
    floors: 'Ground (G) through Floor 11',
  },
];

export function getVerticalShaftDef(name: string): VerticalShaftDef | undefined {
  return VERTICAL_SHAFT_DEFINITIONS.find((d) => d.name === name);
}

export function verticalShaftsForBuilding(code: string): VerticalShaftDef[] {
  const upper = code.toUpperCase() as FacultyBuildingCode;
  return VERTICAL_SHAFT_DEFINITIONS.filter((d) => d.buildingCodes.includes(upper));
}

export function verticalShaftAllowedInBuilding(shaftName: string, buildingCode: string): boolean {
  const def = getVerticalShaftDef(shaftName);
  if (!def) return false;
  return def.buildingCodes.includes(buildingCode.toUpperCase() as FacultyBuildingCode);
}

export function expectedFloorsForShaft(shaftName: string): number[] {
  const def = getVerticalShaftDef(shaftName);
  if (!def) return [];
  return Array.from({ length: def.maxFloor + 1 }, (_, i) => i);
}

const BUILDING_LABELS: Record<FacultyBuildingCode, string> = {
  ACAD: 'Academic',
  ADMIN: 'Administration',
  LAB: 'Laboratory',
};

export function shaftHomeBuildingLabel(def: VerticalShaftDef): string {
  return def.buildingCodes.map((c) => BUILDING_LABELS[c]).join(' & ');
}
