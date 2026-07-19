import { AppError } from '../middleware/errorHandler';
import prisma from '../config/database';
import { detectNavigationIntent, type NavigationIntentResult } from './navigationIntentService';
import {
  parseSourceDestinationQuery,
  pickBestMapSearchResult,
  searchMapEntities,
} from './mapSearchService';
import { computeRouteRequest } from '../modules/indoor-navigation/services/route.service';
import { getStudentTodayNextClass } from './studentTodayCampusService';
import type { formatIndoorRouteResponse } from './indoorNavigationService';

type FormattedRoute = ReturnType<typeof formatIndoorRouteResponse>;

export type UnifiedNavigationQueryResult = {
  routed: boolean;
  intent: NavigationIntentResult;
  found?: boolean;
  message?: string;
  action?: 'guide_to_next_class';
  sourceQuery?: string | null;
  destinationQuery?: string | null;
  roomLabel?: string;
  storySupplement?: string[];
  classContext?: {
    courseName: string;
    lecturerName: string;
    hallName: string;
    when: string;
    isCurrent: boolean;
  };
  confidence?: number;
  directionEngine?: string;
  suggestedBuildingId?: string;
  suggestedBuildingName?: string;
} & Partial<FormattedRoute>;

export type UnifiedNavigationQueryOptions = {
  message: string;
  buildingId?: string;
  fromNodeId?: string;
  userId?: string;
  userRole?: string;
};

function formatAmpm(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

async function tryStorySupplement(
  buildingId: string,
  destinationQuery: string,
  fromQuery?: string,
  floor?: number
): Promise<string[] | undefined> {
  try {
    const { getStoryDirections } = await import('./floorNavigationStoryService');
    const story = await getStoryDirections({
      buildingId,
      destinationQuery,
      fromQuery: fromQuery,
      floor,
    });
    if (story.found && story.steps?.length) return story.steps;
  } catch {
    /* optional supplement */
  }
  return undefined;
}

async function routeToNextClass(
  userId: string,
  intent: NavigationIntentResult
): Promise<UnifiedNavigationQueryResult> {
  const data = await getStudentTodayNextClass(userId);
  const target = data.current || data.next;

  if (!target) {
    const slots = data.slots || [];
    return {
      routed: true,
      intent,
      action: 'guide_to_next_class',
      found: false,
      message:
        slots.length === 0
          ? 'You have no classes left today.'
          : 'No class in progress right now. Check Today on campus for the full list.',
      steps: [],
      segments: [],
      deepLink: '/navigate?today=1',
    };
  }

  if (!target.mapBuildingId) {
    return {
      routed: true,
      intent,
      action: 'guide_to_next_class',
      found: false,
      message: `Your next class is **${target.course.name}** in **${target.hall.name}**, but that room is not on the indoor map yet.`,
      steps: [],
      segments: [],
      deepLink: null,
      classContext: {
        courseName: target.course.name,
        lecturerName: target.lecturerName,
        hallName: target.hall.name,
        when: data.current ? 'now' : `at ${formatAmpm(target.startTime)}`,
        isCurrent: Boolean(data.current),
      },
    };
  }

  const { formatted } = await computeRouteRequest({
    buildingId: target.mapBuildingId,
    toHallId: target.hall.id,
    toMarkerId: target.markerId || undefined,
    floor: target.floor,
    forAdmin: false,
  });

  const storySupplement = formatted.found
    ? await tryStorySupplement(target.mapBuildingId, target.hall.name, undefined, target.floor)
    : undefined;

  return {
    routed: true,
    intent,
    action: 'guide_to_next_class',
    sourceQuery: null,
    destinationQuery: target.hall.name,
    roomLabel: target.hall.name,
    storySupplement,
    classContext: {
      courseName: target.course.name,
      lecturerName: target.lecturerName,
      hallName: target.hall.name,
      when: data.current ? 'now' : `at ${formatAmpm(target.startTime)}`,
      isCurrent: Boolean(data.current),
    },
    ...formatted,
  };
}

async function routeToResolvedRoom(
  intent: NavigationIntentResult,
  message: string,
  options: UnifiedNavigationQueryOptions
): Promise<UnifiedNavigationQueryResult> {
  const parsed = parseSourceDestinationQuery(message);
  const destQuery = parsed.destinationQuery || intent.destinationQuery || message;
  const sourceQ = parsed.sourceQuery;
  const sourceHint = parsed.sourceHint;
  const destHint = parsed.destinationHint;

  const buildings = await prisma.mapBuilding.findMany({
    where: { code: { in: ['ADMIN', 'ACAD', 'LAB'] } },
    select: { id: true, name: true, code: true },
  });
  const byCode = new Map(buildings.map((b) => [b.code.toUpperCase(), b]));

  const fromBuilding = sourceHint?.buildingCode
    ? byCode.get(sourceHint.buildingCode)
    : undefined;
  const toBuilding = destHint?.buildingCode
    ? byCode.get(destHint.buildingCode)
    : undefined;

  const searchResults = await searchMapEntities(destQuery);
  let room = pickBestMapSearchResult(destQuery, searchResults);
  if (!room?.buildingId && sourceQ) {
    const sourceResults = await searchMapEntities(sourceQ);
    room = pickBestMapSearchResult(destQuery, sourceResults);
  }
  if (!room?.buildingId) {
    const broadResults = await searchMapEntities(message);
    room = pickBestMapSearchResult(destQuery, broadResults);
  }

  // Building + floor guide (no specific room name) → open Find My Way with fields filled
  if (!room?.buildingId && (toBuilding || fromBuilding)) {
    const toId = toBuilding?.id || fromBuilding?.id;
    const fromId = fromBuilding?.id || toId;
    const fromFloor = sourceHint?.floor ?? 0;
    const toFloor = destHint?.floor ?? 0;
    const params = new URLSearchParams();
    if (fromId) params.set('fromBuildingId', fromId);
    if (toId) params.set('toBuildingId', toId);
    params.set('fromFloor', String(fromFloor));
    params.set('floor', String(toFloor));
    params.set('auto', '1');
    // Prefer an entrance / floor landmark search on the destination floor
    params.set('q', toFloor === 0 ? 'entrance' : `floor ${toFloor}`);
    if (sourceQ) params.set('fromQuery', sourceHint?.label || sourceQ);

    const startLabel = sourceHint?.label || 'your start point';
    const endLabel = destHint?.label || destQuery;
    return {
      routed: true,
      intent,
      found: true,
      message:
        `Starting point: **${startLabel}**.\n` +
        `Destination: **${endLabel}**.\n\n` +
        `Open Find My Way to see the route on the map.`,
      steps: [],
      segments: [],
      deepLink: `/navigate?${params.toString()}`,
      sourceQuery: sourceQ,
      destinationQuery: destQuery,
      destinationLabel: endLabel,
      confidence: intent.confidence,
      suggestedBuildingId: toId,
      suggestedBuildingName: toBuilding?.name || fromBuilding?.name,
    };
  }

  if (!room?.buildingId) {
    return {
      routed: true,
      intent,
      found: false,
      message: `Could not find "${destQuery}" on the indoor map. Try a room name (for example ELV ROOM), or say from which building/floor to which building/floor.`,
      steps: [],
      segments: [],
      deepLink: '/navigate',
      sourceQuery: sourceQ,
      destinationQuery: destQuery,
      confidence: intent.confidence,
    };
  }

  if (options.buildingId && room.buildingId !== options.buildingId) {
    throw new AppError('Room not found in the specified building', 404);
  }

  const { formatted } = await computeRouteRequest({
    buildingId: room.buildingId,
    toMarkerId: room.markerId,
    toHallId: room.hallId,
    toOfficeId: room.kind === 'office' ? room.id : undefined,
    q: destQuery,
    sourceQ: sourceQ ?? undefined,
    floor: room.floor,
    fromNodeId: options.fromNodeId,
    forAdmin: options.userRole === 'ADMIN',
  });

  if (formatted.found && formatted.polyline?.length) {
    const storySupplement = await tryStorySupplement(
      room.buildingId,
      destQuery,
      sourceQ ?? undefined,
      room.floor
    );
    return {
      routed: true,
      intent,
      sourceQuery: sourceQ,
      destinationQuery: destQuery,
      roomLabel: room.label,
      storySupplement,
      confidence: intent.confidence,
      directionEngine: (formatted as Record<string, unknown>).directionEngine as string | undefined,
      ...formatted,
    };
  }

  try {
    const { getStoryDirections } = await import('./floorNavigationStoryService');
    const story = await getStoryDirections({
      buildingId: room.buildingId,
      destinationQuery: destQuery,
      fromQuery: sourceQ ?? undefined,
      floor: room.floor,
    });
    if (story.found) {
      const deepLink = `/navigate?buildingId=${room.buildingId}&q=${encodeURIComponent(story.destinationLabel || room.label)}`;
      return {
        routed: true,
        intent,
        found: true,
        sourceQuery: sourceQ,
        destinationQuery: destQuery,
        roomLabel: room.label,
        building: story.building,
        destinationLabel: story.destinationLabel,
        steps: story.steps.map((instruction) => ({
          instruction,
          floor: story.floor ?? room.floor ?? 0,
        })),
        stepDetails: story.steps.map((instruction) => ({
          instruction,
          floor: story.floor ?? room.floor ?? 0,
        })),
        polyline: story.polyline ?? [],
        segments: [],
        deepLink,
        message: formatted.found ? undefined : story.message,
        confidence: intent.confidence,
      };
    }
    if (story.suggestedBuildingId) {
      return {
        routed: true,
        intent,
        found: false,
        message: story.message,
        suggestedBuildingId: story.suggestedBuildingId,
        suggestedBuildingName: story.suggestedBuildingName,
        deepLink: `/navigate?buildingId=${story.suggestedBuildingId}&q=${encodeURIComponent(story.destinationLabel || destQuery)}`,
        steps: [],
        segments: [],
        sourceQuery: sourceQ,
        destinationQuery: destQuery,
        confidence: intent.confidence,
      };
    }
  } catch (storyErr) {
    if (!(storyErr instanceof AppError && storyErr.statusCode === 404)) throw storyErr;
  }

  return {
    routed: true,
    intent,
    sourceQuery: sourceQ,
    destinationQuery: destQuery,
    roomLabel: room.label,
    confidence: intent.confidence,
    ...formatted,
  };
}

/** Shared NL navigation pipeline for chatbot, voice, and web UI. */
export async function executeUnifiedNavigationQuery(
  options: UnifiedNavigationQueryOptions
): Promise<UnifiedNavigationQueryResult> {
  const message = options.message.trim();
  if (!message) throw new AppError('message is required', 400);

  const intent = await detectNavigationIntent(message);
  if (!intent.isNavigation) {
    return {
      routed: false,
      intent,
      message: 'Not a navigation query.',
    };
  }

  if (intent.intent === 'guide_to_next_class') {
    if (!options.userId || options.userRole !== 'STUDENT') {
      return {
        routed: true,
        intent,
        action: 'guide_to_next_class',
        found: false,
        message: 'Log in as a student to get directions to your next class, or open Today on campus.',
        deepLink: '/navigate?today=1',
        steps: [],
        segments: [],
      };
    }
    try {
      return await routeToNextClass(options.userId, intent);
    } catch {
      return {
        routed: true,
        intent,
        action: 'guide_to_next_class',
        found: false,
        message: 'Could not load your timetable. Open My Timetable and try again.',
        deepLink: '/navigate?today=1',
        steps: [],
        segments: [],
      };
    }
  }

  return routeToResolvedRoom(intent, message, options);
}
