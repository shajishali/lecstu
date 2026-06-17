import {
  connectorDisplayName,
  isVerticalConnectorType,
  verticalConnectorKey,
} from '../utils/verticalConnectorLabels';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';

export type PathNodeLite = {
  label: string;
  x: number;
  y: number;
  floor: number;
  type: string;
  mapMarkerId?: string | null;
  buildingId?: string;
  buildingName?: string;
  buildingCode?: string;
};

export type TurnStep = { instruction: string; floor: number; polylineIndex: number };

function segmentBearingDeg(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return 0;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

function normalizeDeg(d: number): number {
  let x = d % 360;
  if (x > 180) x -= 360;
  if (x < -180) x += 360;
  return x;
}

function turnPhrase(deltaDeg: number): string {
  if (deltaDeg > 28 && deltaDeg < 152) return 'Turn right';
  if (deltaDeg < -28 && deltaDeg > -152) return 'Turn left';
  if (Math.abs(deltaDeg) >= 152) return 'Turn around';
  return 'Go straight';
}

function firstLegDirection(bearingDeg: number): string {
  const b = normalizeDeg(bearingDeg);
  if (b >= -35 && b <= 35) return 'Go straight ahead';
  if (b > 35 && b < 145) return 'Go to your right';
  if (b < -35 && b > -145) return 'Go to your left';
  return 'Turn around';
}

function stepTargetLabel(node: PathNodeLite): string {
  if (node.type === 'CORRIDOR') return 'the corridor';
  if (node.type === 'ENTRANCE') return 'the entrance';
  if (isVerticalConnectorType(node.type)) {
    return connectorDisplayName(node.type, node.label);
  }
  return node.label;
}

function verticalNodeOnFloor(node: PathNodeLite): PathNodeLite | null {
  return isVerticalConnectorType(node.type) ? node : null;
}

function shaftKeyForVerticalHop(hopPrev: PathNodeLite, hopCur: PathNodeLite): string | null {
  const keys = [hopPrev, hopCur]
    .map(verticalNodeOnFloor)
    .filter((n): n is PathNodeLite => n != null)
    .map((n) => verticalConnectorKey(n.type, n.label))
    .filter((k): k is string => k != null);
  if (keys.length === 0) return null;
  if (keys.length === 2 && keys[0] !== keys[1]) return null;
  return keys[0];
}

function extendVerticalShaftRun(
  pathNodes: PathNodeLite[],
  firstHopIdx: number,
  shaftKey: string
): { endFloor: number; lastIdx: number; exitNode: PathNodeLite } {
  let endFloor = pathNodes[firstHopIdx].floor;
  let lastIdx = firstHopIdx;
  let exitNode = verticalNodeOnFloor(pathNodes[firstHopIdx]) ?? pathNodes[firstHopIdx];

  let searchFrom = firstHopIdx + 1;
  while (searchFrom < pathNodes.length) {
    let nextHopIdx = -1;
    for (let k = searchFrom; k < pathNodes.length; k++) {
      if (pathNodes[k - 1].floor !== pathNodes[k].floor) {
        nextHopIdx = k;
        break;
      }
    }
    if (nextHopIdx < 0) break;

    const hopKey = shaftKeyForVerticalHop(pathNodes[nextHopIdx - 1], pathNodes[nextHopIdx]);
    if (shaftKey && hopKey && hopKey === shaftKey) {
      endFloor = pathNodes[nextHopIdx].floor;
      lastIdx = nextHopIdx;
      exitNode = verticalNodeOnFloor(pathNodes[nextHopIdx]) ?? pathNodes[nextHopIdx];
      searchFrom = nextHopIdx + 1;
    } else {
      break;
    }
  }

  return { endFloor, lastIdx, exitNode };
}

function floorLabelShort(floor: number): string {
  return floor === 0 ? 'Ground floor' : `Floor ${floor}`;
}

function buildingShortLabel(code?: string, name?: string): string {
  const def = code ? getFacultyBuildingByCode(code) : undefined;
  const full = (name || def?.name || code || 'building').trim();
  return full.replace(/\s+Building$/i, '').trim();
}

export function buildTurnByTurnSteps(
  pathNodes: PathNodeLite[],
  destinationLabel: string,
  finalMarker?: { label: string; floor: number }
): TurnStep[] {
  const steps: TurnStep[] = [];
  if (pathNodes.length === 0) return steps;

  const start = pathNodes[0];
  const destFloor = finalMarker?.floor ?? pathNodes[pathNodes.length - 1]?.floor ?? 0;

  steps.push({
    instruction: `Start at ${start.label} on ${floorLabelShort(start.floor)}${
      start.buildingName ? ` (${start.buildingName})` : ''
    }`,
    floor: start.floor,
    polylineIndex: 0,
  });

  for (let i = 1; i < pathNodes.length; i++) {
    const prev = pathNodes[i - 1];
    const cur = pathNodes[i];

    if (prev.buildingId && cur.buildingId && prev.buildingId !== cur.buildingId) {
      const exitLabel = buildingShortLabel(prev.buildingCode, prev.buildingName);
      const enterLabel = buildingShortLabel(cur.buildingCode, cur.buildingName);
      steps.push({
        instruction: `Exit ${exitLabel}`,
        floor: prev.floor,
        polylineIndex: Math.max(0, i - 1),
      });
      steps.push({
        instruction: `Enter ${enterLabel}`,
        floor: cur.floor,
        polylineIndex: i,
      });
    }

    if (prev.floor !== cur.floor) {
      const enterNode = verticalNodeOnFloor(prev) ?? verticalNodeOnFloor(cur);
      if (!enterNode) {
        steps.push({
          instruction: `Go to ${floorLabelShort(cur.floor)}`,
          floor: cur.floor,
          polylineIndex: i,
        });
        continue;
      }

      const shaftKey = verticalConnectorKey(enterNode.type, enterNode.label);
      const enterName = connectorDisplayName(enterNode.type, enterNode.label);

      const { endFloor, lastIdx, exitNode } = extendVerticalShaftRun(
        pathNodes,
        i,
        shaftKey || ''
      );

      const vertical = endFloor > prev.floor ? 'up' : 'down';
      const exitName = connectorDisplayName(exitNode.type, exitNode.label);

      steps.push({
        instruction: `Walk to ${enterName}`,
        floor: prev.floor,
        polylineIndex: Math.max(0, i - 1),
      });
      steps.push({
        instruction: `Take ${enterName} ${vertical} to ${floorLabelShort(endFloor)}`,
        floor: prev.floor,
        polylineIndex: Math.max(0, i - 1),
      });
      steps.push({
        instruction: `Exit at ${exitName} on ${floorLabelShort(endFloor)} and continue`,
        floor: endFloor,
        polylineIndex: lastIdx,
      });

      i = lastIdx;
      continue;
    }

    const bearing = segmentBearingDeg(prev, cur);
    const target = stepTargetLabel(cur);
    const isLast = i === pathNodes.length - 1;
    let instruction: string;

    if (i === 1) {
      instruction = `${firstLegDirection(bearing)} toward ${target}`;
    } else {
      const prevBearing = segmentBearingDeg(pathNodes[i - 2], prev);
      const turn = normalizeDeg(bearing - prevBearing);
      if (Math.abs(turn) > 22) {
        instruction = `${turnPhrase(turn)}, then continue toward ${target}`;
      } else {
        instruction = `Go straight toward ${target}`;
      }
    }

    if (isLast && cur.type === 'ROOM' && cur.label.toLowerCase() === destinationLabel.toLowerCase()) {
      const t = normalizeDeg(segmentBearingDeg(prev, cur));
      if (t > 25 && t < 155) instruction = `Turn right into ${cur.label}`;
      else if (t < -25 && t > -155) instruction = `Turn left into ${cur.label}`;
      else instruction = `Go straight into ${cur.label}`;
    }

    steps.push({ instruction, floor: cur.floor, polylineIndex: i });
  }

  const lastMotion = steps[steps.length - 1]?.instruction ?? '';

  if (finalMarker && !lastMotion.toLowerCase().includes(finalMarker.label.toLowerCase())) {
    steps.push({
      instruction: `Enter ${finalMarker.label}`,
      floor: finalMarker.floor,
      polylineIndex: pathNodes.length - 1,
    });
  }

  if (!steps.some((s) => s.instruction.toLowerCase().includes('arrived'))) {
    steps.push({
      instruction: `You have arrived at ${destinationLabel}`,
      floor: destFloor,
      polylineIndex: pathNodes.length - 1,
    });
  }

  return steps;
}
