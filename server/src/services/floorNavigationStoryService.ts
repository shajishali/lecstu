import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { getBuildingOrThrow } from './indoorMarkerService';
import { publishedFloorPlanFilter } from '../utils/floorPlanPublish';
import { isValidFloorIndex } from './floorPlanStorage';
import { processFloorPlanWithVision } from './floorPlanVisionService';
import {
  CORRIDOR_SPINE_DISPLAY,
  displayToStorageCoord,
  ENTRANCE_DISPLAY_POSITION,
  LEGEND_NUMBER_DISPLAY_POSITIONS,
  parseDrawableRegion,
  type FloorPlanDrawableRegion,
} from '../utils/floorPlanMapRegion';
import type { MapMarkerType } from '../generated/prisma/client';

export type GuidePlace = {
  id: string;
  name: string;
  aliases: string[];
  description?: string;
  directions?: string;
  floor: number;
  legendNumber?: number;
  x?: number;
  y?: number;
  markerId?: string;
};

export type FloorNavigationGuide = {
  version: 1;
  buildingId: string;
  floor: number;
  entranceName: string;
  places: GuidePlace[];
  updatedAt: string;
};

const SKIP_PLACE_NAMES =
  /^(ground\s+floor|floor\s+\d+|floor\s+information|navigation\s+knowledge|walking\s+directions|legend|you\s+are\s+here|description|floor\s+name|room\s+directory|facilities|relative\s+location|accessibility|navigation\s+response|important\s+note|example|question|answer|purpose|location|nearby\s+locations?|connected\s+to|navigation\s+landmark|directions|facilities\s+available|wheelchair\s+accessible|primary\s+arrival|main\s+navigation\s+hub|largest\s+room|vertical\s+transportation|public\s+restroom|male\s+toilet|female\s+toilet|accessible\s+toilet)$/i;

const SKIP_SECTION_HEADERS =
  /^(ground\s+floor\s+navigation\s+knowledge\s+base|floor\s+information|room\s+directory|facilities|relative\s+location\s+knowledge|accessibility\s+rules|navigation\s+response\s+rules)$/i;

const SKIP_FIELD_PREFIX =
  /^(purpose|location|nearby|connected|navigation\s+landmark|directions|facilities\s+available|accessibility|floor\s+name|description|important\s+note|when\s+answering|mention\s+the|provide\s+step|use\s+reception|example|question|answer)\b/i;

function markerTypeForGuidePlace(name: string): MapMarkerType {
  const n = name.toLowerCase();
  if (/^exit\b/.test(n)) return 'EXIT';
  if (/stair/.test(n)) return 'STAIRS';
  if (/lift|elevator/.test(n)) return 'LIFT';
  if (/toilet|washroom|restroom/.test(n)) return 'TOILET';
  if (/cafeteria|canteen/.test(n)) return 'CAFETERIA';
  if (/library/.test(n)) return 'LIBRARY';
  if (/auditorium/.test(n)) return 'AUDITORIUM';
  if (/seminar/.test(n)) return 'SEMINAR_ROOM';
  if (/conference/.test(n)) return 'CONFERENCE_ROOM';
  if (/lecture\s+hall/.test(n)) return 'LECTURE_HALL';
  if (/workshop/.test(n)) return 'WORKSHOP';
  if (/prayer|mosque|chapel/.test(n)) return 'PRAYER_ROOM';
  if (/clinic|medical|dispensary/.test(n)) return 'CLINIC';
  if (/parking/.test(n)) return 'PARKING';
  if (/gym|sports/.test(n)) return 'SPORTS';
  if (/store|supplies/.test(n)) return 'STORE';
  if (/reception|counter|shroff/.test(n)) return 'COUNTER';
  if (/office|affairs|security/.test(n)) return 'OFFICE';
  if (/\blab\b/.test(n)) return 'LAB';
  if (
    /changing\s+room|staff\s+room|store\s+room|\broom\b/.test(n) &&
    !/restroom|washroom|prayer|lecture|seminar|conference|classroom/.test(n)
  ) {
    return 'ROOM';
  }
  if (/\bhall\b/.test(n) && !/waiting\s+lobby/i.test(n)) return 'HALL';
  if (/lobby|waiting/.test(n)) return 'LOBBY';
  if (/entrance/.test(n)) return 'ENTRANCE';
  return 'AMENITY';
}

function cleanPlaceName(raw: string): string {
  return raw
    .replace(/^#+\s*/, '')
    .replace(/^\*+|\*+$/g, '')
    .replace(/^[_]+|[_]+$/g, '')
    .replace(/[.:,;]+$/g, '')
    .trim();
}

function splitNameDescription(raw: string): { name: string; description?: string } {
  const parts = raw.split(/\s*[-–—:|]\s+/);
  const name = cleanPlaceName(parts[0]);
  const description = parts.slice(1).join(' — ').trim() || undefined;
  return { name, description };
}

/** Parse numbered/bulleted/markdown locations from admin notes (incl. ChatGPT output). */
export function parsePlacesFromNotes(notes: string, floor: number): GuidePlace[] {
  const places: GuidePlace[] = [];
  const seen = new Set<string>();

  const addPlace = (rawName: string, description?: string, legendNumber?: number) => {
    const name = cleanPlaceName(rawName);
    if (name.length < 2 || SKIP_PLACE_NAMES.test(name) || SKIP_SECTION_HEADERS.test(name)) return;

    const key = normalizeToken(name);
    if (!key || seen.has(key)) return;
    seen.add(key);

    const aliases = new Set([name.toLowerCase(), key]);
    if (/\belv\b/i.test(name)) {
      aliases.add('elv');
      aliases.add('elv room');
    }
    if (/\belectrical\b/i.test(name)) {
      aliases.add('electrical');
      aliases.add('electrical room');
    }

    places.push({
      id: `place-${places.length + 1}`,
      name,
      aliases: [...aliases],
      description,
      floor,
      legendNumber,
    });
  };

  const lines = notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    if (line === '---') continue;

    const stripped = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    if (!stripped) continue;

    if (SKIP_SECTION_HEADERS.test(stripped)) continue;
    if (SKIP_FIELD_PREFIX.test(stripped)) continue;

    const roomHeader = stripped.match(/^room\s+(\d+)\s*[-–—:]\s*(.+)$/i);
    if (roomHeader) {
      const { name, description } = splitNameDescription(roomHeader[2]);
      addPlace(name, description, parseInt(roomHeader[1], 10));
      continue;
    }

    const facility = stripped.match(/^(lift|staircase|toilets?)$/i);
    if (facility) {
      addPlace(facility[1]);
      continue;
    }

    if (/^#+\s/.test(line)) continue;

    const numbered = stripped.match(/^(\d+)[\).\]]\s*(.+)$/i);
    if (numbered) {
      const { name, description } = splitNameDescription(numbered[2]);
      addPlace(name, description, parseInt(numbered[1], 10));
      continue;
    }

    const table = stripped.match(/^\|?\s*\d+\s*\|([^|]+)/);
    if (table) {
      addPlace(table[1].trim());
      continue;
    }

    const labeled = stripped.match(/^([A-Za-z][A-Za-z0-9\s&/]{2,})\s*:\s*(.+)$/);
    if (labeled) {
      const label = labeled[1].trim();
      if (!SKIP_FIELD_PREFIX.test(label) && !/^(floor|description|building)/i.test(label)) {
        addPlace(label, labeled[2].trim());
      }
      continue;
    }

    if (
      /^[A-Z][A-Z0-9\s&/]{2,}$/.test(stripped) &&
      /\b(ROOM|LOBBY|OFFICE|CAFETERIA|RECEPTION|AREA|HALL|LAB)\b/i.test(stripped)
    ) {
      addPlace(stripped);
    }
  }

  return places;
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const GENERIC_PLACE_TOKENS = new Set(['room', 'hall', 'floor', 'building', 'ground', 'the', 'area']);

function distinctiveQueryTokens(query: string): string[] {
  return normalizeToken(query)
    .split(' ')
    .filter((t) => t.length >= 2 && !GENERIC_PLACE_TOKENS.has(t));
}

function tokensMatch(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const ta = na.split(' ').filter((t) => t.length >= 2 && !GENERIC_PLACE_TOKENS.has(t));
  const tb = nb.split(' ').filter((t) => t.length >= 2 && !GENERIC_PLACE_TOKENS.has(t));
  if (ta.length === 0 || tb.length === 0) return false;

  return ta.every((t) => nb.includes(t)) || tb.every((t) => na.includes(t));
}

function isInDrawableRegion(x: number, y: number, region: FloorPlanDrawableRegion): boolean {
  return x >= region.x0 && x <= region.x1 && y >= region.y0 && y <= region.y1;
}

function clampToDrawable(
  x: number,
  y: number,
  region: FloorPlanDrawableRegion
): { x: number; y: number } {
  return {
    x: Math.max(region.x0, Math.min(region.x1, x)),
    y: Math.max(region.y0, Math.min(region.y1, y)),
  };
}

/** Walk right-to-left through corridor spine, then into the destination room. */
function buildSpineFallbackPolyline(
  destination: GuidePlace,
  floor: number,
  region: FloorPlanDrawableRegion
): Array<{ x: number; y: number; floor: number; label?: string }> {
  const lobby = displayToStorageCoord(
    ENTRANCE_DISPLAY_POSITION.x,
    ENTRANCE_DISPLAY_POSITION.y,
    region
  );
  const destX = destination.x ?? lobby.x;
  const points: Array<{ x: number; y: number; floor: number; label?: string }> = [
    { ...clampToDrawable(lobby.x, lobby.y, region), floor, label: 'Main lobby' },
  ];

  for (const wp of CORRIDOR_SPINE_DISPLAY) {
    const pos = displayToStorageCoord(wp.x, wp.y, region);
    const clamped = clampToDrawable(pos.x, pos.y, region);
    points.push({ ...clamped, floor, label: wp.label });
    if (clamped.x <= destX + 8) break;
  }

  if (destination.x != null && destination.y != null) {
    points.push({
      ...clampToDrawable(destination.x, destination.y, region),
      floor,
      label: destination.name,
    });
  }

  return points;
}

function clampPolylineToDrawable<T extends { x: number; y: number }>(
  points: T[],
  region: FloorPlanDrawableRegion
): T[] {
  return points.map((p) => {
    const c = clampToDrawable(p.x, p.y, region);
    return { ...p, x: c.x, y: c.y };
  });
}

function positionFromLegendNumber(
  legendNumber: number | undefined,
  region: FloorPlanDrawableRegion
): { x: number; y: number } | null {
  if (!legendNumber) return null;
  const display = LEGEND_NUMBER_DISPLAY_POSITIONS[legendNumber];
  if (!display) return null;
  return displayToStorageCoord(display.x, display.y, region);
}

/** Place rooms on the floor plan using legend numbers (e.g. #3 = Cafeteria on the left). */
export async function resolvePlacePositions(
  buildingId: string,
  floor: number,
  places: GuidePlace[],
  drawableRegion?: unknown
): Promise<GuidePlace[]> {
  const region = parseDrawableRegion(drawableRegion);
  const markers = await prisma.mapMarker.findMany({
    where: { buildingId, floor },
    select: { id: true, label: true, x: true, y: true },
  });

  return places.map((p) => {
    const legendPos = positionFromLegendNumber(p.legendNumber, region);
    if (legendPos) {
      return { ...p, x: legendPos.x, y: legendPos.y };
    }

    const marker = markers.find((m) => tokensMatch(m.label, p.name));
    if (marker && isInDrawableRegion(marker.x, marker.y, region)) {
      return {
        ...p,
        x: marker.x,
        y: marker.y,
        markerId: marker.id,
        aliases: [...new Set([...p.aliases, marker.label.toLowerCase()])],
      };
    }

    return p;
  });
}

async function upsertGuideMarker(
  buildingId: string,
  floor: number,
  place: GuidePlace,
  type: MapMarkerType = 'AMENITY'
) {
  if (place.x == null || place.y == null) return null;

  const label = place.name.trim();
  const existing = await prisma.mapMarker.findFirst({
    where: {
      buildingId,
      floor,
      label: { equals: label, mode: 'insensitive' },
      type,
    },
  });

  const data = {
    x: Math.max(0, Math.min(100, place.x)),
    y: Math.max(0, Math.min(100, place.y)),
    type,
    metadata: { source: 'navigation-guide', legendNumber: place.legendNumber ?? null },
  };

  if (existing) {
    return prisma.mapMarker.update({ where: { id: existing.id }, data: { ...data, label } });
  }

  return prisma.mapMarker.create({
    data: { buildingId, floor, label, ...data },
  });
}

/** Sync guide places to map markers + corridor-spine graph (stays inside floor plan). */
export async function syncGuideMarkersAndGraph(
  buildingId: string,
  floor: number,
  places: GuidePlace[],
  _entranceName: string,
  drawableRegion?: unknown
) {
  const region = parseDrawableRegion(drawableRegion);
  const lobbyPos = displayToStorageCoord(
    ENTRANCE_DISPLAY_POSITION.x,
    ENTRANCE_DISPLAY_POSITION.y,
    region
  );

  await prisma.mapMarker.deleteMany({
    where: {
      buildingId,
      floor,
      type: 'ENTRANCE',
      NOT: { label: { equals: 'Main lobby', mode: 'insensitive' } },
    },
  });

  await upsertGuideMarker(
    buildingId,
    floor,
    {
      id: 'entrance',
      name: 'Main lobby',
      aliases: ['you are here', 'entrance', 'start'],
      floor,
      x: lobbyPos.x,
      y: lobbyPos.y,
    },
    'ENTRANCE'
  );

  for (const place of places) {
    const marker = await upsertGuideMarker(
      buildingId,
      floor,
      place,
      markerTypeForGuidePlace(place.name)
    );
    if (marker) place.markerId = marker.id;
  }

  const { buildCorridorSpineGraph } = await import('./floorPlanVisionService');
  await buildCorridorSpineGraph(buildingId, floor, drawableRegion);
}

function detectEntrance(places: GuidePlace[]): string {
  const entrance = places.find((p) =>
    /reception|entrance|main\s+door|lobby/i.test(p.name)
  );
  return entrance?.name || places[0]?.name || 'the main entrance';
}

/** Build guide JSON from notes + optional vision markers. */
export async function buildFloorNavigationGuide(
  buildingId: string,
  floor: number,
  notes: string,
  options?: { runVision?: boolean; imagePath?: string }
): Promise<FloorNavigationGuide> {
  const building = await getBuildingOrThrow(buildingId);
  if (!isValidFloorIndex(floor, building.floors)) {
    throw new AppError(`Invalid floor ${floor}`, 400);
  }
  if (!notes.trim()) throw new AppError('Navigation notes are required', 400);

  if (options?.runVision && options.imagePath) {
    try {
      await processFloorPlanWithVision(buildingId, floor, options.imagePath);
    } catch {
      /* vision optional — notes still work */
    }
  }

  const floorPlan = await prisma.floorPlan.findUnique({
    where: { buildingId_floor: { buildingId, floor } },
    select: { drawableRegion: true },
  });

  let places = parsePlacesFromNotes(notes, floor);
  if (places.length === 0) {
    throw new AppError(
      'Could not find any room names in your notes. Add a numbered list like "1. RECEPTION — at the main entrance" or "3. CAFETERIA — turn left after the lobby".',
      400
    );
  }
  places = await resolvePlacePositions(
    buildingId,
    floor,
    places,
    floorPlan?.drawableRegion
  );
  attachDirectionsToPlaces(places, notes);

  const entranceName = 'Main lobby';
  await syncGuideMarkersAndGraph(
    buildingId,
    floor,
    places,
    entranceName,
    floorPlan?.drawableRegion
  );

  const guide: FloorNavigationGuide = {
    version: 1,
    buildingId,
    floor,
    entranceName,
    places,
    updatedAt: new Date().toISOString(),
  };

  await prisma.floorPlan.update({
    where: { buildingId_floor: { buildingId, floor } },
    data: { navigationNotes: notes.trim(), navigationGuide: guide as object },
  });

  return guide;
}

export function findPlaceInGuide(
  guide: FloorNavigationGuide,
  query: string
): GuidePlace | null {
  const q = normalizeToken(query);
  if (!q) return null;

  const numMatch = query.trim().match(/^#?(\d{1,2})$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    const byNumber = guide.places.find((p) => p.legendNumber === n);
    if (byNumber) return byNumber;
  }

  for (const p of guide.places) {
    if (tokensMatch(p.name, q)) return p;
    if (p.aliases.some((a) => tokensMatch(a, q))) return p;
  }

  const words = distinctiveQueryTokens(query);
  if (words.length === 0) return null;

  let best: GuidePlace | null = null;
  let bestScore = 0;
  for (const p of guide.places) {
    const placeNorm = normalizeToken(p.name);
    const matched = words.filter((w) => placeNorm.includes(w)).length;
    if (matched > bestScore) {
      bestScore = matched;
      best = p;
    }
  }
  return bestScore >= 1 && bestScore === words.length ? best : null;
}

const MAX_STORY_STEPS = 5;

const DIRECTION_NOISE =
  /nearby locations|connected to|navigation landmark|purpose:|^room \d|^\*\s|^##|example|question:|answer:|important note|wheelchair accessible|facilities available|main navigation hub|primary arrival|vertical transportation|relative location|accessibility rules|navigation response/i;

function cleanDirectionText(raw: string): string {
  return raw
    .replace(/\*\s*/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCleanDirectionSentence(s: string): boolean {
  const t = s.trim();
  if (t.length < 10 || t.length > 180) return false;
  return !DIRECTION_NOISE.test(t);
}

function splitIntoDirectionSteps(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(isCleanDirectionSentence);
}

/** Pull the Directions paragraph for a room/facility from ChatGPT-style notes. */
export function extractDirectionsForRoom(notes: string, roomName: string): string | null {
  const roomBlocks = notes.split(/\n(?=##\s+Room\s+\d+\s*[-–—:])/i);
  for (const block of roomBlocks) {
    const headerMatch = block.match(/^##\s+Room\s+\d+\s*[-–—:]\s*([^\n]+)/i);
    if (!headerMatch) continue;
    const blockName = cleanPlaceName(headerMatch[1]);
    if (!tokensMatch(blockName, roomName)) continue;
    const m = block.match(/\nDirections:\s*\n?\s*([\s\S]+?)(?=\n---|\n##|$)/i);
    if (m) return cleanDirectionText(m[1]);
  }

  const blocks = notes.split(/\n(?=##\s+(?!Room\s+\d))/i);
  for (const block of blocks) {
    const headerMatch = block.match(/^##\s+([^\n]+)/i);
    if (!headerMatch) continue;
    const blockName = cleanPlaceName(headerMatch[1]);
    if (!tokensMatch(blockName, roomName)) continue;
    const m = block.match(/\nDirections:\s*\n?\s*([\s\S]+?)(?=\n---|\n##|$)/i);
    if (m) return cleanDirectionText(m[1]);
  }

  const token = roomName.split(/\s/)[0];
  const qa = notes.match(
    new RegExp(
      `Question:\\s*\\n?"How do I get to (?:the )?[^"]*${token}[^"]*"\\s*\\n\\s*Answer:\\s*\\n?"([^"]+)"`,
      'i'
    )
  );
  if (qa) return cleanDirectionText(qa[1]);

  return null;
}

function attachDirectionsToPlaces(places: GuidePlace[], notes: string): void {
  for (const place of places) {
    const d = extractDirectionsForRoom(notes, place.name);
    if (d) place.directions = d;
  }
}

/** Short plain-language walking steps — no metadata dumps. */
export function generateWalkingStory(
  notes: string,
  guide: FloorNavigationGuide,
  destination: GuidePlace,
  _fromName?: string
): string[] {
  const steps: string[] = ['Start at the main lobby (you are here).'];

  const directions =
    destination.directions || extractDirectionsForRoom(notes, destination.name);

  if (directions) {
    const parts = splitIntoDirectionSteps(directions);
    for (const part of parts.slice(0, 2)) steps.push(part);
  } else {
    const lobby = guide.places.find((p) => /waiting\s+lobby/i.test(p.name));
    if (lobby && !tokensMatch(destination.name, lobby.name)) {
      steps.push(`Walk through the Student Waiting Lobby toward ${destination.name}.`);
    } else {
      steps.push(`Head toward ${destination.name}.`);
    }
  }

  steps.push(`You have arrived at ${destination.name}.`);
  return steps.slice(0, MAX_STORY_STEPS);
}

export async function getStoryDirections(input: {
  buildingId: string;
  destinationQuery: string;
  fromQuery?: string;
  floor?: number;
}) {
  const building = await getBuildingOrThrow(input.buildingId);
  const plans = await prisma.floorPlan.findMany({
    where: {
      buildingId: input.buildingId,
      ...(input.floor !== undefined ? { floor: input.floor } : {}),
      navigationGuide: { not: null },
      ...publishedFloorPlanFilter(),
    },
    orderBy: { floor: 'asc' },
  });

  if (plans.length === 0) {
    const alt = await findDestinationInOtherBuildings(input.buildingId, input.destinationQuery);
    if (alt) {
      return {
        found: false,
        message: `No navigation guide for ${building.name}. "${alt.destinationLabel}" is available in ${alt.buildingName} — switch building and try again.`,
        suggestedBuildingId: alt.buildingId,
        suggestedBuildingName: alt.buildingName,
        building: { id: building.id, name: building.name, code: building.code },
        steps: [] as string[],
      };
    }
    throw new AppError(
      `No navigation guide for ${building.name}. Admin must upload a floor plan, paste notes, and click "Build navigation from notes".`,
      404
    );
  }

  let matchedPlan = plans[0];
  let guide = matchedPlan.navigationGuide as unknown as FloorNavigationGuide;
  let destination = findPlaceInGuide(guide, input.destinationQuery);

  if (!destination) {
    for (const plan of plans) {
      const g = plan.navigationGuide as unknown as FloorNavigationGuide;
      const d = findPlaceInGuide(g, input.destinationQuery);
      if (d) {
        destination = d;
        guide = g;
        matchedPlan = plan;
        break;
      }
    }
  }

  if (!destination) {
    return {
      found: false,
      message: `I could not find "${input.destinationQuery}" in the building guide. Check the name in admin navigation notes.`,
      building: { id: building.id, name: building.name, code: building.code },
      steps: [] as string[],
    };
  }

  const notes = matchedPlan.navigationNotes || '';
  let fromPlace: GuidePlace | undefined;
  if (input.fromQuery) {
    fromPlace = findPlaceInGuide(guide, input.fromQuery) ?? undefined;
  }

  const steps = generateWalkingStory(notes, guide, destination, fromPlace?.name);

  return {
    found: true,
    building: { id: building.id, name: building.name, code: building.code },
    floor: guide.floor,
    destinationLabel: destination.name,
    destination,
    imagePath: matchedPlan.imagePath,
    bounds: matchedPlan.bounds,
    drawableRegion: matchedPlan.drawableRegion,
    steps,
    polyline: [] as Array<{ x: number; y: number; floor: number; label?: string }>,
    guide,
  };
}

/** Find destination in another building's guide (wrong building selected). */
export async function findDestinationInOtherBuildings(
  excludeBuildingId: string,
  destinationQuery: string
): Promise<{ buildingId: string; buildingName: string; destinationLabel: string } | null> {
  const plans = await prisma.floorPlan.findMany({
    where: {
      navigationGuide: { not: null },
      buildingId: { not: excludeBuildingId },
      ...publishedFloorPlanFilter(),
    },
    include: { building: { select: { id: true, name: true } } },
  });

  for (const plan of plans) {
    const guide = plan.navigationGuide as unknown as FloorNavigationGuide;
    if (!guide?.places?.length) continue;
    const dest = findPlaceInGuide(guide, destinationQuery);
    if (dest) {
      return {
        buildingId: plan.building.id,
        buildingName: plan.building.name,
        destinationLabel: dest.name,
      };
    }
  }
  return null;
}

export async function listBuildingsWithGuides(): Promise<
  Array<{ buildingId: string; buildingName: string; placeCount: number; floors: number[] }>
> {
  const plans = await prisma.floorPlan.findMany({
    where: { navigationGuide: { not: null }, ...publishedFloorPlanFilter() },
    select: {
      floor: true,
      navigationGuide: true,
      building: { select: { id: true, name: true } },
    },
  });

  const byBuilding = new Map<
    string,
    { buildingId: string; buildingName: string; placeCount: number; floors: number[] }
  >();

  for (const plan of plans) {
    const guide = plan.navigationGuide as unknown as FloorNavigationGuide;
    const count = guide?.places?.length ?? 0;
    if (count === 0) continue;

    const existing = byBuilding.get(plan.building.id);
    if (existing) {
      existing.placeCount += count;
      if (!existing.floors.includes(plan.floor)) existing.floors.push(plan.floor);
    } else {
      byBuilding.set(plan.building.id, {
        buildingId: plan.building.id,
        buildingName: plan.building.name,
        placeCount: count,
        floors: [plan.floor],
      });
    }
  }

  return [...byBuilding.values()].sort((a, b) => a.buildingName.localeCompare(b.buildingName));
}

export async function listGuidePlaces(buildingId: string) {
  const plans = await prisma.floorPlan.findMany({
    where: { buildingId, navigationGuide: { not: null }, ...publishedFloorPlanFilter() },
    select: { floor: true, navigationGuide: true, navigationNotes: true },
    orderBy: { floor: 'asc' },
  });

  const places: Array<GuidePlace & { floor: number }> = [];
  for (const p of plans) {
    const guide = p.navigationGuide as unknown as FloorNavigationGuide;
    if (!guide?.places) continue;
    for (const place of guide.places) {
      places.push({ ...place, floor: guide.floor });
    }
  }
  return places;
}
