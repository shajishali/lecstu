import prisma from '../config/database';
import type { Prisma } from '../generated/prisma/client';
import { getFacultyBuildingByCode } from '../constants/facultyBuildings';
import type { MapSearchResult } from '../controllers/mapController';
import { normalizeRoomLabelForSearch } from '../utils/floorPlanMapRegion';

const OFFSET = 0.00003;

const GUIDE_PREFIXES = [
  /^guide\s+me\s+to\s+/i,
  /^how\s+do\s+i\s+(?:go|get|reach|find)\s+to\s+/i,
  /^how\s+to\s+(?:go|get|reach|find)\s+to\s+/i,
  /^take\s+me\s+to\s+/i,
  /^directions\s+to\s+/i,
  /^navigate\s+to\s+/i,
  /^walk\s+me\s+to\s+/i,
  /^show\s+me\s+(?:the\s+)?way\s+to\s+/i,
  /^where\s+is\s+(?:the\s+)?/i,
  /^find\s+(?:the\s+)?/i,
  /^i\s+want\s+to\s+go\s+to\s+/i,
  /^get\s+me\s+to\s+/i,
  /^can\s+you\s+guide\s+(?:me\s+)?(?:to\s+)?(?:go\s+for\s+the\s+)?/i,
  /^please\s+guide\s+(?:me\s+)?to\s+/i,
];

/** Strip chatbot phrasing; return room search terms + optional building hint */
export function parseNavigationQuery(raw: string): {
  roomTerms: string[];
  buildingHint: string | null;
} {
  let text = raw.trim();
  let buildingHint: string | null = null;

  for (const p of GUIDE_PREFIXES) {
    text = text.replace(p, '');
  }

  const inBuildingMatches = [...text.matchAll(/\bin\s+(?:the\s+)?(.+?)\s+building\b/gi)];
  if (inBuildingMatches.length > 0) {
    buildingHint = inBuildingMatches[inBuildingMatches.length - 1][1].trim();
    text = text.replace(/\bin\s+(?:the\s+)?.+?\s+building\b/gi, ' ').trim();
  }

  if (buildingHint) {
    buildingHint = buildingHint
      .replace(/\b(?:on\s+)?ground\s+floor\b/gi, ' ')
      .replace(/\bfloor\s+\d+\b/gi, ' ')
      .replace(/\bin\s+the\s+/gi, ' ')
      .replace(/^(?:in\s+)?(?:the\s+)?/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!buildingHint) buildingHint = null;
  }

  const namedBuilding = text.match(
    /\b(administration|academic|laboratory|admin|acad|lab)\s+building\b/i
  );
  if (namedBuilding) {
    buildingHint = buildingHint || namedBuilding[1];
    text = text.replace(namedBuilding[0], ' ').trim();
  }

  text = text.replace(/\b(?:on\s+)?ground\s+floor\b/gi, ' ').trim();
  text = text.replace(/\bfloor\s+\d+\b/gi, ' ').trim();
  text = text.replace(/\s+/g, ' ').trim();

  const roomTerms: string[] = [];
  if (text.length >= 2) roomTerms.push(text);

  const roomPatterns = [
    /\b(ELECTRICAL\s+ROOM)\b/i,
    /\b(ELV\s*ROOM)\b/i,
    /\b(MEETING\s+ROOM)\b/i,
    /\b(CAFETERIA)\b/i,
    /\b([A-Z]{2,}\s*ROOM)\b/i,
    /\b(room\s+\d+[A-Z]?)\b/i,
  ];
  for (const pat of roomPatterns) {
    const m = text.match(pat);
    if (m && m[1]) {
      const term = m[1].replace(/\s+/g, ' ').trim();
      if (/^elv/i.test(term) && /electrical/i.test(text)) continue;
      if (!roomTerms.some((t) => t.toLowerCase() === term.toLowerCase())) {
        roomTerms.unshift(term);
      }
    }
  }

  if (roomTerms.length === 0 && raw.trim().length >= 2) {
    roomTerms.push(raw.trim());
  }

  return { roomTerms, buildingHint };
}

/** Parse "from X to Y" / "guide me from reception to cafeteria" style queries. */
export function parseSourceDestinationQuery(raw: string): {
  sourceQuery: string | null;
  destinationQuery: string | null;
  buildingHint: string | null;
} {
  let text = raw.trim();
  let buildingHint: string | null = null;

  const fromTo = text.match(
    /\b(?:from|starting\s+(?:at|from))\s+(.+?)\s+(?:to|towards|until|into)\s+(.+?)(?:[?.!]|$)/i
  );
  if (fromTo) {
    const parsed = parseNavigationQuery(raw);
    buildingHint = parsed.buildingHint;
    return {
      sourceQuery: fromTo[1].replace(/[?.!]+$/, '').trim() || null,
      destinationQuery: fromTo[2].replace(/[?.!]+$/, '').trim() || null,
      buildingHint,
    };
  }

  const guideFrom = text.match(/\bguide\s+me\s+from\s+(.+?)\s+to\s+(.+?)(?:[?.!]|$)/i);
  if (guideFrom) {
    const parsed = parseNavigationQuery(raw);
    return {
      sourceQuery: guideFrom[1].trim() || null,
      destinationQuery: guideFrom[2].trim() || null,
      buildingHint: parsed.buildingHint,
    };
  }

  const parsed = parseNavigationQuery(text);
  return {
    sourceQuery: null,
    destinationQuery: parsed.roomTerms[0] || null,
    buildingHint: parsed.buildingHint,
  };
}

const SEARCH_STOP_WORDS = new Set(['the', 'a', 'an', 'to', 'for', 'in', 'on', 'at']);
const GENERIC_ROOM_TOKENS = new Set(['room', 'hall', 'floor', 'building', 'ground']);

/** Distinctive query tokens must appear in the label (prevents "electrical room" → ELV ROOM). */
const TOKEN_CONFLICTS: Array<[string, string]> = [
  ['electrical', 'elv'],
  ['elv', 'electrical'],
  ['cafeteria', 'elv'],
  ['meeting', 'elv'],
];

/** Score how well a marker/hall label matches the user's room query (0–100). */
export function scoreMapSearchMatch(query: string, label: string): number {
  const variants = [query.toLowerCase().trim()];
  if (/\s+room$/i.test(query)) {
    variants.push(query.replace(/\s+room$/i, '').trim().toLowerCase());
  }

  let best = 0;
  for (const q of variants) {
    best = Math.max(best, scoreSingleMatch(q, label));
  }
  return best;
}

function scoreSingleMatch(query: string, label: string): number {
  const q = query.toLowerCase().trim();
  const l = normalizeRoomLabelForSearch(label).toLowerCase();
  if (!q || !l) return 0;

  for (const [need, forbid] of TOKEN_CONFLICTS) {
    if (q.includes(need) && l.includes(forbid) && !l.includes(need)) return 0;
  }

  if (l === q) return 100;
  if (l.includes(q)) return 92;
  if (q.includes(l) && l.length >= 4) return 88;

  const qTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  const meaningful = qTokens.filter((t) => !SEARCH_STOP_WORDS.has(t));
  const tokens = meaningful.length > 0 ? meaningful : qTokens;
  if (tokens.length === 0) return 0;

  const distinctive = tokens.filter((t) => !GENERIC_ROOM_TOKENS.has(t));
  if (distinctive.length > 0) {
    for (const t of distinctive) {
      if (!l.includes(t)) return 0;
    }
  }

  let matched = 0;
  for (const t of tokens) {
    if (l.includes(t)) matched++;
  }
  if (matched === 0) return 0;

  if (tokens.length === 1 && tokens[0] === 'room') {
    return l.includes('room') ? 25 : 0;
  }

  let score = (matched / tokens.length) * 75;
  if (matched === tokens.length) score += 20;
  if (tokens.every((t) => l.includes(t))) score += 5;

  return Math.min(99, Math.round(score));
}

export function pickBestMapSearchResult(
  query: string,
  results: MapSearchResult[],
  minScore = 45
): MapSearchResult | null {
  const roomLike = results.filter((r) => r.kind === 'marker' || r.kind === 'hall' || r.kind === 'office');
  if (roomLike.length === 0) return null;

  let best: MapSearchResult | null = null;
  let bestScore = 0;
  for (const r of roomLike) {
    const score = scoreMapSearchMatch(query, r.label);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  return bestScore >= minScore ? best : null;
}

export async function resolveBuildingIdFromHint(hint: string | null): Promise<string | null> {
  if (!hint) return null;
  const h = hint.toLowerCase();
  const buildings = await prisma.mapBuilding.findMany({
    select: { id: true, name: true, code: true },
  });

  for (const b of buildings) {
    const def = getFacultyBuildingByCode(b.code);
    const labels = [b.name, b.code, def?.hallBuildingLabel, def?.name].filter(Boolean) as string[];
    for (const label of labels) {
      const l = label.toLowerCase();
      if (h.includes(l) || l.includes(h)) return b.id;
    }
    if (h.includes('admin') && b.code === 'ADMIN') return b.id;
    if (h.includes('acad') && b.code === 'ACAD') return b.id;
    if (h.includes('lab') && b.code === 'LAB') return b.id;
  }
  return null;
}

type MarkerRow = {
  id: string;
  label: string;
  floor: number;
  x: number;
  y: number;
  hallId: string | null;
  building: { id: string; name: string; code: string; latitude: number; longitude: number };
  hall: { id: string; name: string } | null;
};

function markerToResult(m: MarkerRow): MapSearchResult {
  return {
    kind: 'marker',
    id: m.id,
    label: m.label,
    sublabel: `${m.building.name} • ${m.floor === 0 ? 'Ground' : `Floor ${m.floor}`}`,
    latitude: m.building.latitude + (m.y - 50) * OFFSET,
    longitude: m.building.longitude + (m.x - 50) * OFFSET,
    buildingId: m.building.id,
    floor: m.floor,
    markerId: m.id,
    hallId: m.hallId || undefined,
  };
}

export async function searchMapEntities(q: string): Promise<MapSearchResult[]> {
  const trimmed = q.trim();
  if (trimmed.length < 2) return [];

  const { roomTerms, buildingHint } = parseNavigationQuery(trimmed);
  const buildingFilterId = await resolveBuildingIdFromHint(buildingHint);
  const results: MapSearchResult[] = [];
  const seenMarker = new Set<string>();
  const seenHall = new Set<string>();
  const seenOffice = new Set<string>();

  const markerInclude = {
    building: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
    hall: { select: { id: true, name: true } },
  } as const;

  type MarkerWithRelations = Prisma.MapMarkerGetPayload<{ include: typeof markerInclude }>;

  const pushMarkers = (markers: MarkerWithRelations[]) => {
    for (const m of markers) {
      if (!m.building || seenMarker.has(m.id)) continue;
      seenMarker.add(m.id);
      results.push(markerToResult(m));
    }
  };

  // 1) Search by parsed room terms — collect all matches, do not stop at first
  for (const term of roomTerms) {
    if (term.length < 2) continue;
    const markers = await prisma.mapMarker.findMany({
      where: {
        label: { contains: term, mode: 'insensitive' },
        ...(buildingFilterId ? { buildingId: buildingFilterId } : {}),
      },
      include: markerInclude,
      take: 20,
    });
    pushMarkers(markers);
  }

  // 2) Token search — skip generic "room" alone; require distinctive tokens
  if (results.length === 0) {
    const tokens = [
      ...new Set(
        roomTerms
          .join(' ')
          .split(/\s+/)
          .filter((t) => t.length >= 3 && !GENERIC_ROOM_TOKENS.has(t.toLowerCase()))
      ),
    ];
    for (const token of tokens) {
      const markers = await prisma.mapMarker.findMany({
        where: {
          label: { contains: token, mode: 'insensitive' },
          ...(buildingFilterId ? { buildingId: buildingFilterId } : {}),
        },
        include: markerInclude,
        take: 20,
      });
      pushMarkers(markers);
    }
  }

  // 3) Original full-string + building/hall search (fallback)
  const legacyQ = roomTerms[0] || trimmed;

  const buildings = await prisma.mapBuilding.findMany({
    where: {
      OR: [
        { name: { contains: legacyQ, mode: 'insensitive' } },
        { code: { contains: legacyQ, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, code: true, latitude: true, longitude: true },
    take: 5,
  });
  for (const b of buildings) {
    results.push({
      kind: 'building',
      id: b.id,
      label: b.name,
      sublabel: `Code: ${b.code}`,
      latitude: b.latitude,
      longitude: b.longitude,
      buildingId: b.id,
    });
  }

  if (results.every((r) => r.kind === 'building')) {
    const mapMarkers = await prisma.mapMarker.findMany({
      where: {
        label: { contains: legacyQ, mode: 'insensitive' },
        ...(buildingFilterId ? { buildingId: buildingFilterId } : {}),
      },
      include: markerInclude,
      take: 12,
    });
    for (const m of mapMarkers) {
      if (!m.building || seenMarker.has(m.id)) continue;
      seenMarker.add(m.id);
      results.push(markerToResult(m));
    }
  }

  const halls = await prisma.lectureHall.findMany({
    where: { name: { contains: legacyQ, mode: 'insensitive' } },
    select: { id: true, name: true },
    take: 10,
  });
  const hallIds = halls.map((h) => h.id);
  if (hallIds.length) {
    const hallMarkers = await prisma.mapMarker.findMany({
      where: {
        hallId: { in: hallIds },
        ...(buildingFilterId ? { buildingId: buildingFilterId } : {}),
      },
      include: { building: { select: { id: true, name: true, latitude: true, longitude: true } } },
    });
    for (const m of hallMarkers) {
      if (!m.hallId || !m.building || seenHall.has(m.hallId)) continue;
      const hall = halls.find((h) => h.id === m.hallId);
      if (!hall) continue;
      seenHall.add(m.hallId);
      results.push({
        kind: 'hall',
        id: hall.id,
        label: hall.name,
        sublabel: `Hall • ${m.building.name}`,
        latitude: m.building.latitude + ((m.y - 50) * OFFSET),
        longitude: m.building.longitude + ((m.x - 50) * OFFSET),
        buildingId: m.building.id,
        floor: m.floor,
        markerId: m.id,
        hallId: m.hallId,
      });
    }
  }

  const officeTerms = [...roomTerms, legacyQ].filter((t, i, arr) => t.length >= 2 && arr.indexOf(t) === i);
  for (const term of officeTerms) {
    const offices = await prisma.lecturerOffice.findMany({
      where: {
        OR: [
          { roomNumber: { contains: term, mode: 'insensitive' } },
          {
            lecturer: {
              OR: [
                { firstName: { contains: term, mode: 'insensitive' } },
                { lastName: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      include: {
        lecturer: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 10,
    });
    if (offices.length === 0) continue;

    const officeIds = offices.map((o) => o.id);
    const officeMarkers = await prisma.mapMarker.findMany({
      where: {
        officeId: { in: officeIds },
        ...(buildingFilterId ? { buildingId: buildingFilterId } : {}),
      },
      include: {
        building: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      },
    });

    for (const m of officeMarkers) {
      if (!m.officeId || !m.building || seenOffice.has(m.officeId)) continue;
      const office = offices.find((o) => o.id === m.officeId);
      if (!office) continue;
      seenOffice.add(m.officeId);
      results.push({
        kind: 'office',
        id: office.id,
        label: `Room ${office.roomNumber}`,
        sublabel: `${office.lecturer.firstName} ${office.lecturer.lastName} • ${m.building.name}`,
        latitude: m.building.latitude + ((m.y - 50) * OFFSET),
        longitude: m.building.longitude + ((m.x - 50) * OFFSET),
        buildingId: m.building.id,
        floor: m.floor,
        markerId: m.id,
        officeId: office.id,
        lecturerId: office.lecturer.id,
      });
    }
  }

  // Prefer markers/halls/offices over buildings — rank by match quality
  const roomLike = results.filter((r) => r.kind !== 'building');
  if (roomLike.length > 0) {
    const ranked = [...roomLike].sort(
      (a, b) => scoreMapSearchMatch(trimmed, b.label) - scoreMapSearchMatch(trimmed, a.label)
    );
    return ranked.slice(0, 15);
  }

  return results.slice(0, 15);
}
