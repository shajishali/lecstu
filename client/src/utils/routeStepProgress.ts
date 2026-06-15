export type RouteStepDetail = {
  instruction: string;
  floor: number;
  polylineIndex?: number;
};

export type RoutePoint = { x: number; y: number };

type PolylinePoint = { x: number; y: number; floor: number; buildingId?: string };

/** Map global polyline index → index within a single floor's filtered path. */
function floorLocalIndex(
  fullPolyline: PolylinePoint[],
  viewFloor: number,
  globalIndex: number
): number {
  let local = 0;
  for (let i = 0; i <= globalIndex && i < fullPolyline.length; i++) {
    if (fullPolyline[i].floor === viewFloor) {
      if (i === globalIndex) return local;
      local++;
    }
  }
  return Math.max(0, local);
}

/** Split a floor's route polyline into traveled (red) and ahead (yellow) by step index. */
export function splitRoutePathByStep(
  routePath: RoutePoint[],
  stepDetails: RouteStepDetail[],
  stepIndex: number,
  viewFloor: number,
  fullPolyline?: PolylinePoint[]
): { traveled: RoutePoint[]; ahead: RoutePoint[] } {
  if (routePath.length < 2 || stepDetails.length === 0) {
    return { traveled: [], ahead: routePath };
  }

  const floorSteps = stepDetails
    .map((step, index) => ({ ...step, index }))
    .filter((step) => step.floor === viewFloor);

  if (floorSteps.length === 0) {
    return { traveled: [], ahead: routePath };
  }

  const firstFloorStepIndex = floorSteps[0].index;
  const lastFloorStepIndex = floorSteps[floorSteps.length - 1].index;

  if (stepIndex < firstFloorStepIndex) {
    return { traveled: [], ahead: routePath };
  }

  if (stepIndex >= lastFloorStepIndex) {
    return { traveled: routePath, ahead: [] };
  }

  const currentStep = stepDetails[stepIndex];
  let splitAt: number;

  if (fullPolyline?.length && currentStep?.polylineIndex != null) {
    splitAt = floorLocalIndex(fullPolyline, viewFloor, currentStep.polylineIndex);
  } else {
    const completedFloorSteps = floorSteps.filter((step) => step.index <= stepIndex).length;
    const totalFloorSteps = floorSteps.length;
    splitAt = Math.ceil((completedFloorSteps / totalFloorSteps) * (routePath.length - 1));
  }

  splitAt = Math.max(1, Math.min(routePath.length - 1, splitAt));

  return {
    traveled: routePath.slice(0, splitAt + 1),
    ahead: routePath.slice(splitAt),
  };
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
    if (stepDetails[i].floor !== floor) continue;
    if (buildingId && polyline?.length) {
      const idx = stepDetails[i].polylineIndex ?? 0;
      const pt = polyline[idx];
      if (pt?.buildingId && pt.buildingId !== buildingId) continue;
    }
    return i;
  }

  return stepDetails.findIndex((s) => s.floor === floor);
}
