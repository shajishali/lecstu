/**
 * FCT faculty — three main buildings for indoor navigation (Phase 6.4).
 * Each building includes **Ground floor (G)** as floor **0**, then upper floors.
 *
 * Floor plan files: ACAD_floor0.jpg or ACAD_ground.jpg (ground), ACAD_floor1.jpg, …
 * `floors` = total levels **including ground** (e.g. 10 = Ground + Floor 1–9).
 */
export const FACULTY_MAP_BUILDINGS = [
  {
    name: 'Academic Building',
    code: 'ACAD',
    latitude: 6.97025,
    longitude: 79.90512,
    floors: 10,
    description: 'Ground + 9 upper levels (Floors 1–9) — lecture halls and classrooms',
    roomTypes: ['Lecture halls', 'Classrooms', 'Tutorial rooms', 'Seminar rooms'],
    hallBuildingLabel: 'Academic Building',
  },
  {
    name: 'Administration Building',
    code: 'ADMIN',
    latitude: 6.97045,
    longitude: 79.90508,
    floors: 10,
    description: 'Ground + 9 upper levels (Floors 1–9) — offices and meeting rooms',
    roomTypes: [
      'Lecturer offices',
      'Department offices',
      'Meeting rooms',
      'Admin & support rooms',
    ],
    hallBuildingLabel: 'Administration Building',
  },
  {
    name: 'Laboratory Building',
    code: 'LAB',
    latitude: 6.97005,
    longitude: 79.90528,
    floors: 12,
    description: 'Ground + 11 upper levels (Floors 1–11) — computer and engineering labs (12 levels total)',
    roomTypes: [
      'Computer labs',
      'Engineering labs',
      'Practical / workshop labs',
      'Lab prep rooms',
    ],
    hallBuildingLabel: 'Laboratory Building',
  },
] as const;

export type FacultyBuildingCode = (typeof FACULTY_MAP_BUILDINGS)[number]['code'];

/** Ground + First floor in current Phase 11.1 rollout; more floors added via admin only. */
export const PHASE_11_ACTIVE_FLOORS = [0, 1] as const;

export function getFacultyBuildingByCode(code: string) {
  return FACULTY_MAP_BUILDINGS.find((b) => b.code === code.toUpperCase());
}

export function getTotalExpectedFloorPlans(): number {
  return FACULTY_MAP_BUILDINGS.reduce((sum, b) => sum + b.floors, 0);
}
