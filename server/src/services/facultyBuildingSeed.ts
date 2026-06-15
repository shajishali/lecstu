import type { PrismaClient } from '../generated/prisma/client';
import {
  FACULTY_MAP_BUILDINGS,
  getTotalExpectedFloorPlans,
  PHASE_11_ACTIVE_FLOORS,
} from '../constants/facultyBuildings';

export async function upsertFacultyMapBuildings(prisma: PrismaClient) {
  const results = [];
  for (const b of FACULTY_MAP_BUILDINGS) {
    const row = await prisma.mapBuilding.upsert({
      where: { code: b.code },
      create: {
        name: b.name,
        code: b.code,
        latitude: b.latitude,
        longitude: b.longitude,
        floors: b.floors,
        metadata: {
          description: b.description,
          phase: '11.1',
          roomTypes: b.roomTypes,
          hallBuildingLabel: b.hallBuildingLabel,
        },
      },
      update: {
        name: b.name,
        latitude: b.latitude,
        longitude: b.longitude,
        floors: b.floors,
        metadata: {
          description: b.description,
          phase: '11.1',
          roomTypes: b.roomTypes,
          hallBuildingLabel: b.hallBuildingLabel,
        },
      },
    });
    results.push(row);
  }
  return results;
}

export async function getFacultySetupStatus(prisma: PrismaClient) {
  const codes = FACULTY_MAP_BUILDINGS.map((b) => b.code);
  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: [...codes] } },
    include: {
      floorPlans: {
        select: {
          id: true,
          floor: true,
          imagePath: true,
          publishStatus: true,
          scaleMetersPerUnit: true,
        },
        orderBy: { floor: 'asc' },
      },
    },
    orderBy: { code: 'asc' },
  });

  const byCode = Object.fromEntries(buildings.map((b) => [b.code, b]));
  const expected = FACULTY_MAP_BUILDINGS.map((def) => {
    const b = byCode[def.code];
    const uploadedFloors = b?.floorPlans.map((fp) => fp.floor) ?? [];
    const missingFloors: number[] = [];
    for (let f = 0; f < def.floors; f++) {
      if (!uploadedFloors.includes(f)) missingFloors.push(f);
    }
    const phase11Missing: number[] = [];
    for (const f of PHASE_11_ACTIVE_FLOORS) {
      if (!uploadedFloors.includes(f)) phase11Missing.push(f);
    }
    const publishedInPhase = (b?.floorPlans ?? []).filter(
      (fp) =>
        (PHASE_11_ACTIVE_FLOORS as readonly number[]).includes(fp.floor) &&
        fp.publishStatus === 'PUBLISHED'
    ).length;
    return {
      code: def.code,
      name: def.name,
      exists: !!b,
      buildingId: b?.id ?? null,
      floors: def.floors,
      uploadedCount: uploadedFloors.length,
      missingFloors,
      phase11MissingFloors: phase11Missing,
      phase11PublishedCount: publishedInPhase,
      floorPlans: b?.floorPlans ?? [],
      description: def.description,
      roomTypes: [...def.roomTypes],
    };
  });

  const allBuildingsExist = expected.every((e) => e.exists);
  const totalExpectedFloors = getTotalExpectedFloorPlans();
  const totalUploaded = expected.reduce((s, e) => s + e.uploadedCount, 0);
  const phase11Target = FACULTY_MAP_BUILDINGS.length * PHASE_11_ACTIVE_FLOORS.length;
  const phase11Uploaded = expected.reduce(
    (s, e) => s + PHASE_11_ACTIVE_FLOORS.length - e.phase11MissingFloors.length,
    0
  );
  const phase11Published = expected.reduce((s, e) => s + e.phase11PublishedCount, 0);

  return {
    phase: '11.1',
    activeFloors: [...PHASE_11_ACTIVE_FLOORS],
    allBuildingsExist,
    totalExpectedFloors,
    totalUploaded,
    phase11Target,
    phase11Uploaded,
    phase11Published,
    buildings: expected,
    ready: allBuildingsExist && phase11Uploaded >= phase11Target,
  };
}
