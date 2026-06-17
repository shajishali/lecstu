export type RouteStepLite = {
  instruction: string;
  floor: number;
  polylineIndex?: number;
};

/** Pick the best step index after anchoring at a nav node on the path. */
export function resolveStepIndexForPathNode(
  steps: RouteStepLite[],
  pathNodeIds: string[],
  nodeId: string,
  floor: number
): number {
  if (!steps.length) return 0;

  const pathIdx = pathNodeIds.indexOf(nodeId);
  if (pathIdx >= 0 && pathNodeIds.length > 1) {
    const ratio = pathIdx / (pathNodeIds.length - 1);
    let candidate = Math.round(ratio * (steps.length - 1));
    candidate = Math.max(0, Math.min(steps.length - 1, candidate));

    for (let i = candidate; i >= 0; i--) {
      if (steps[i].floor === floor) return i;
    }
    for (let i = candidate; i < steps.length; i++) {
      if (steps[i].floor === floor) return i;
    }
    return candidate;
  }

  const onFloor = steps
    .map((s, index) => ({ ...s, index }))
    .filter((s) => s.floor === floor);
  if (onFloor.length) return onFloor[0].index;

  return 0;
}

/** Advance step when the user moves to a new floor along the route. */
export function stepIndexForFloorTransition(
  steps: RouteStepLite[],
  currentStepIndex: number,
  newFloor: number
): number {
  if (!steps.length) return 0;
  if (steps[currentStepIndex]?.floor === newFloor) return currentStepIndex;

  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    if (steps[i].floor === newFloor) return i;
  }
  for (let i = currentStepIndex; i >= 0; i--) {
    if (steps[i].floor === newFloor) return i;
  }
  return currentStepIndex;
}
