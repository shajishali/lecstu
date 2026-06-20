export type RouteStepDetail = {
  instruction: string;
  floor: number;
  polylineIndex?: number;
  buildingId?: string;
};

export type RoutePoint = { x: number; y: number };

type PolylinePoint = { x: number; y: number; floor: number; buildingId?: string };

/** Map global polyline index → index within a single building/floor path. */
function floorLocalIndex(
  fullPolyline: PolylinePoint[],
  viewFloor: number,
  globalIndex: number,
  viewBuildingId?: string
): number {
  let local = 0;
  for (let i = 0; i <= globalIndex && i < fullPolyline.length; i++) {
    const p = fullPolyline[i];
    if (p.floor !== viewFloor) continue;
    if (viewBuildingId && p.buildingId && p.buildingId !== viewBuildingId) continue;
    if (i === globalIndex) return local;
    local++;
  }
  return Math.max(0, local);
}

function stepOnView(
  step: RouteStepDetail,
  viewFloor: number,
  viewBuildingId?: string
): boolean {
  if (step.floor !== viewFloor) return false;
  if (viewBuildingId && step.buildingId && step.buildingId !== viewBuildingId) return false;
  return true;
}

/** Split a floor's route polyline: red = steps already passed (before current), yellow = full route. */
export function splitRoutePathByStep(
  routePath: RoutePoint[],
  stepDetails: RouteStepDetail[],
  stepIndex: number,
  viewFloor: number,
  fullPolyline?: PolylinePoint[],
  viewBuildingId?: string
): { traveled: RoutePoint[]; ahead: RoutePoint[] } {
  if (routePath.length < 2 || stepDetails.length === 0) {
    return { traveled: [], ahead: routePath };
  }

  const floorSteps = stepDetails
    .map((step, index) => ({ ...step, index }))
    .filter((step) => stepOnView(step, viewFloor, viewBuildingId));

  if (floorSteps.length === 0) {
    return { traveled: [], ahead: routePath };
  }

  const firstFloorStepIndex = floorSteps[0].index;
  const lastFloorStepIndex = floorSteps[floorSteps.length - 1].index;

  if (stepIndex < firstFloorStepIndex) {
    return { traveled: [], ahead: routePath };
  }

  // All steps on this floor finished — entire segment is completed.
  if (stepIndex > lastFloorStepIndex) {
    return { traveled: routePath, ahead: [] };
  }

  // Red line ends at the previous step on this floor — current step is dot only until Next.
  let prevOnFloorIndex = -1;
  for (let i = stepIndex - 1; i >= 0; i--) {
    if (stepOnView(stepDetails[i], viewFloor, viewBuildingId)) {
      prevOnFloorIndex = i;
      break;
    }
  }

  if (prevOnFloorIndex < 0) {
    return { traveled: [], ahead: routePath };
  }

  const prevStep = stepDetails[prevOnFloorIndex];
  let splitAt: number;

  if (fullPolyline?.length && prevStep.polylineIndex != null) {
    splitAt = floorLocalIndex(
      fullPolyline,
      viewFloor,
      prevStep.polylineIndex,
      viewBuildingId
    );
  } else {
    const completedFloorSteps = floorSteps.filter((step) => step.index < stepIndex).length;
    const totalFloorSteps = floorSteps.length;
    splitAt = Math.ceil((completedFloorSteps / totalFloorSteps) * (routePath.length - 1));
  }

  splitAt = Math.max(0, Math.min(routePath.length - 1, splitAt));

  if (splitAt === 0) {
    return {
      traveled: routePath.length > 0 ? [routePath[0]] : [],
      ahead: routePath,
    };
  }

  return {
    traveled: routePath.slice(0, splitAt + 1),
    ahead: routePath,
  };
}

/** Map position for the active step (current dot on the route). */
export function routePointForStep(
  stepDetails: RouteStepDetail[],
  stepIndex: number,
  routePath: RoutePoint[],
  viewFloor: number,
  fullPolyline?: PolylinePoint[],
  viewBuildingId?: string
): RoutePoint | null {
  if (!stepDetails.length || stepIndex < 0 || stepIndex >= stepDetails.length) {
    return null;
  }

  const step = stepDetails[stepIndex];
  if (!stepOnView(step, viewFloor, viewBuildingId)) {
    return null;
  }

  if (fullPolyline?.length && step.polylineIndex != null) {
    const local = floorLocalIndex(
      fullPolyline,
      viewFloor,
      step.polylineIndex,
      viewBuildingId
    );
    if (local >= 0 && local < routePath.length) {
      return routePath[local];
    }
  }

  const floorSteps = stepDetails
    .map((s, index) => ({ ...s, index }))
    .filter((s) => stepOnView(s, viewFloor, viewBuildingId));
  const posInFloor = floorSteps.findIndex((s) => s.index === stepIndex);
  if (posInFloor < 0) return null;
  const idx = Math.round((posInFloor / Math.max(1, floorSteps.length - 1)) * (routePath.length - 1));
  return routePath[Math.max(0, Math.min(routePath.length - 1, idx))];
}

/** First step index that belongs to a building/floor segment (for floor tab clicks). */
export function firstStepIndexForFloor(
  stepDetails: RouteStepDetail[],
  floor: number,
  buildingId?: string,
  polyline?: PolylinePoint[]
): number {
  if (!stepDetails.length) return 0;

  for (let i = 0; i < stepDetails.length; i++) {
    const step = stepDetails[i];
    if (step.buildingId && buildingId && step.buildingId === buildingId && step.floor === floor) {
      return i;
    }
    if (step.floor !== floor) continue;
    if (buildingId && polyline?.length) {
      const idx = step.polylineIndex ?? 0;
      const pt = polyline[idx];
      if (pt?.buildingId && pt.buildingId !== buildingId) continue;
    }
    return i;
  }

  return stepDetails.findIndex((s) => s.floor === floor);
}

/** Best drawable segment per building for cross-campus route tabs. */
export function crossBuildingRouteViews(
  segments: Array<{ buildingId: string; floor: number; polyline: [number, number][] }>,
  buildingPath: string[],
  buildings: Array<{ id: string; name: string; code: string }>,
  floorLabelFn: (f: number) => string
): Array<{ buildingId: string; floor: number; label: string }> {
  const drawable = segments.filter((s) => s.polyline.length >= 2);
  const views: Array<{ buildingId: string; floor: number; label: string }> = [];

  for (const code of buildingPath) {
    const building = buildings.find((b) => b.code === code);
    if (!building) continue;
    const buildingSegs = drawable.filter((s) => s.buildingId === building.id);
    if (buildingSegs.length === 0) continue;
    const best = buildingSegs.reduce((a, b) =>
      b.polyline.length > a.polyline.length ? b : a
    );
    views.push({
      buildingId: building.id,
      floor: best.floor,
      label: `${building.name} · ${floorLabelFn(best.floor)}`,
    });
  }

  return views;
}

